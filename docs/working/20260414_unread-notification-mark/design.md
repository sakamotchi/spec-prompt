# 設計書 - unread-notification-mark（P4: 未読通知マーク / タブ強調表示）

## アーキテクチャ

### 対象コンポーネント

```
(1) 通知発火時の未読マーク付与
-------------------------------------------------
claude が OSC 9 出力
    │
    ▼ PTY 出力に含まれる
src-tauri/src/commands/pty.rs (リーダースレッド)
    │
    │ Osc9Detector が検出
    │ is_app_focused(&app) = false なら:
    │   - send_native_notification(...)  (既存)
    │   - ★ app.emit("claude-notification-fired", { pty_id })  (新規)
    ▼
Tauri event "claude-notification-fired"
    │
    ▼ AppLayout で購読
useTerminalStore.markUnread(pty_id)
    │
    │ pty_id から該当 TerminalTab を特定
    │ すでにアクティブ+document.hasFocus() なら skip
    │ そうでなければ hasUnreadNotification = true
    ▼
TerminalTab.hasUnreadNotification が true に

(2) UI 表示
-------------------------------------------------
TerminalTabs.tsx が再描画
    │
    │ tab.hasUnreadNotification が true なら:
    │   - ラベル先頭に ● を合成
    │   - 背景に薄いアクセントハイライト
    │   - 左ボーダー 2px のアクセント色
    ▼
視覚的にマーク付きタブが識別できる

(3) マーク解除
-------------------------------------------------
(a) タブクリック時:
    TerminalTabs の onClick
      ├ setActiveTab(tab.id, pane)
      └ document.hasFocus() なら clearUnread(tab.id)

(b) アプリフォーカス復帰時:
    AppLayout で getCurrentWindow().onFocusChanged を購読
      ├ focused=true を受信
      ├ 現在アクティブな primary/secondary のタブを取得
      └ そのタブが hasUnreadNotification なら clearUnread(tab.id)
```

### 影響範囲

- **フロントエンド**:
  - `src/stores/terminalStore.ts` — `TerminalTab.hasUnreadNotification` フィールド、`markUnread` / `clearUnread` アクション
  - `src/stores/terminalStore.test.ts` — ユニットテスト追加
  - `src/lib/tauriApi.ts` — `ClaudeNotificationFiredPayload` 型、`onClaudeNotificationFired` リスナー
  - `src/components/Layout/AppLayout.tsx` — 通知イベント購読、ウィンドウフォーカス復帰ハンドラ
  - `src/components/TerminalPanel/TerminalTabs.tsx` — ラベルへの `●` 合成、未読スタイル、クリック時 `clearUnread`
- **バックエンド（Rust）**:
  - `src-tauri/src/commands/pty.rs` — OSC 9 発火ブロックに emit を 1 行追加（既存 `is_app_focused` 判定内）

## 実装方針

### 概要

未読マークの発火は **Rust で既にフォーカス判定をしている箇所に emit を 1 行足すだけ** で成立する。Phase 1 のタイトル差し込み実装のすぐ後ろに置けばよい。フロントは `hasUnreadNotification: boolean` を 1 フィールド追加するだけで、残りは既存の Zustand パターンで吸収できる。

マーク解除のトリガーは 2 つ:
- **(a) タブクリック**: シングルクリックで `setActiveTab` と同時に `document.hasFocus()` が true なら `clearUnread` を呼ぶ
- **(b) アプリフォーカス復帰**: Tauri の `getCurrentWindow().onFocusChanged` で `focused=true` を受けたら、現在アクティブなタブのマークを解除する

`document.hasFocus()` と Tauri の `onFocusChanged` は厳密に一致しない可能性があるが、**タブクリック時** は Web API のほうが自然（クリック発生時点で即座に判定できる）。**復帰時** は Tauri のイベントのほうが発火タイミングが明確。両方併用することで、ユーザーの「見た」タイミングを確実に捕らえる。

### 詳細

1. **Rust: emit 追加**
   `pty.rs` の OSC 9 検出ブロック内、既存の `if !is_app_focused(&app)` 判定の中で通知を送った直後に `app.emit("claude-notification-fired", ...)` を追加する。Phase 1 で追加したキャッシュ参照の流れを崩さない。

2. **Front: 型拡張**
   ```typescript
   export interface TerminalTab {
     id: string
     ptyId: string | null
     fallbackTitle: string
     oscTitle: string | null
     manualTitle: string | null
     pinned: boolean
     hasUnreadNotification: boolean  // 新規
   }
   ```

3. **Front: アクション**
   ```typescript
   markUnread: (ptyId) => /* 該当 tab に true、アクティブ+フォーカス時はスキップ */
   clearUnread: (tabId) => /* 該当 tab に false */
   ```
   `markUnread` は `pty_id → tab` の検索、`clearUnread` は `tab_id` 直指定（呼び出し側は既に `tab.id` を持っている）。

4. **Front: イベント購読（AppLayout）**
   既存の P2 で追加した useEffect 内、もしくは新しい useEffect で:
   - `tauriApi.onClaudeNotificationFired` を購読し `markUnread(pty_id)` を呼ぶ
   - `getCurrentWindow().onFocusChanged` を購読し focused=true 時に現在アクティブのタブを走査、`hasUnreadNotification` ならクリア

5. **Front: UI**
   `TerminalTabs.tsx` の各タブボタンの `style` に未読時のハイライトを追加、ラベル先頭に `●` を合成する。`title`（ツールチップ）には `●` を含めない。

6. **Front: タブクリック時のクリア**
   既存の `onClick={() => setActiveTab(...)}` を `onClick={() => { setActiveTab(...); if (document.hasFocus() && tab.hasUnreadNotification) clearUnread(tab.id) }}` に拡張。

### レース条件の考察

- Rust で `is_app_focused=false` 判定 → emit → フロント購読 → `markUnread` の間に、ユーザーがアプリに戻ってくるケース。この間隔はミリ秒オーダーで、多くの場合無視できる。万一発生しても、すぐ続く「アプリフォーカス復帰 → 解除」で自然に clear されるため実害なし。
- `markUnread` 内で「該当タブがすでに active かつ `document.hasFocus()`=true ならスキップ」の防御を入れて、同時イベントで立ってすぐ消すのチラつきを抑える。

## データ構造

### 型定義（TypeScript）

```typescript
// src/stores/terminalStore.ts

export interface TerminalTab {
  id: string
  ptyId: string | null
  fallbackTitle: string
  oscTitle: string | null
  manualTitle: string | null
  pinned: boolean
  hasUnreadNotification: boolean
}

interface TerminalState {
  // ...existing...
  markUnread: (ptyId: string) => void
  clearUnread: (tabId: string) => void
}

// src/lib/tauriApi.ts

export interface ClaudeNotificationFiredPayload {
  pty_id: string
}
```

### 型定義（Rust）

本フェーズでは新規の構造体は追加しない。`pty.rs` 内で `serde_json::json!({ "pty_id": pty_id.clone() })` を emit するだけ。

```rust
// src-tauri/src/commands/pty.rs の既存ブロックに追記

for msg in osc9.feed(&buf[..n]) {
    if !notification::is_app_focused(&app) {
        let cache = app.state::<notification::DisplayTitleCache>();
        let title = cache
            .get(&pty_id)
            .map(|t| format!("Claude Code — {}", t))
            .unwrap_or_else(|| "SpecPrompt / Claude Code".to_string());
        notification::send_native_notification(&app, &title, &msg);

        // 追加: フロントに未読マーク指示
        let _ = app.emit(
            "claude-notification-fired",
            serde_json::json!({ "pty_id": pty_id.clone() }),
        );
    }
}
```

## API設計

### Tauriコマンド

新規なし。

### Tauriイベント

| イベント名 | ペイロード | 説明 |
|-----------|-----------|------|
| `claude-notification-fired` | `{ pty_id: string }` | OS 通知が **実際に発火した** タイミング（非フォーカス時）。フロントの未読マーク付与を駆動する |

### フロント API

```typescript
// src/lib/tauriApi.ts に追記

export interface ClaudeNotificationFiredPayload {
  pty_id: string
}

export const tauriApi = {
  // ...existing...
  onClaudeNotificationFired: (
    callback: (payload: ClaudeNotificationFiredPayload) => void,
  ): Promise<UnlistenFn> =>
    listen<ClaudeNotificationFiredPayload>("claude-notification-fired", (event) =>
      callback(event.payload),
    ),
}
```

## UI設計

### UIライブラリ

追加ライブラリなし（既存の React + Tailwind + lucide-react のみで完結）。

### カラーパレット

未読マークは **アクセント色とは別の色軸（警告系の琥珀色）** を採用する。アクティブタブのアクセント色（下線）と競合しないように意図的に色を分離する。Tailwind の `amber-500`（`rgb(245, 158, 11)`）相当を直接 RGB 指定で使う（dark/light 両テーマで同じ色が使えて視認性も確保できるため）。

- 背景: `rgba(245, 158, 11, 0.2)` — 琥珀 20% 合成
- 左ボーダー: `rgb(245, 158, 11)` 2px
- `●` ドット: `rgb(245, 158, 11)`

既存のアクティブタブ色（`--color-accent`）と未読マーク色は **別色軸で共存** できる。

### 画面構成

**通常タブ**:
```
[Terminal 1]
```

**未読タブ（非アクティブ）**:
```
[● Terminal 1]
 ^ 琥珀色ドット (rgb(245, 158, 11))
 背景: 琥珀 20% 合成
 左ボーダー 2px: 琥珀色
```

**未読タブ（アクティブ）**:
- アクティブ表示（下線）+ 未読マーク（`●` + 背景ハイライト）を併用
- 復帰時に clearUnread されることが多いので、このケースは一瞬しか見えない

### コンポーネント構成

`TerminalTabs.tsx` の既存タブ描画に 2 箇所差分を入れる:

```tsx
const display = computeDisplayTitle(tab)
const unread = tab.hasUnreadNotification

<button
  /* ...既存 props... */
  onClick={isEditing ? undefined : () => {
    setActiveTab(tab.id, pane)
    if (unread && document.hasFocus()) {
      useTerminalStore.getState().clearUnread(tab.id)
    }
  }}
  style={{
    color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
    borderBottom: isActive ? '2px solid var(--color-accent)' : '2px solid transparent',
    // 追加: 未読ハイライト（琥珀色）
    background: unread ? 'rgba(245, 158, 11, 0.2)' : undefined,
    borderLeft: unread ? '2px solid rgb(245, 158, 11)' : '2px solid transparent',
  }}
>
  {isEditing ? (
    <TabInlineRenameInput ... />
  ) : (
    <span className="flex items-center gap-1 max-w-[12rem] truncate">
      {unread && (
        <span
          aria-hidden="true"
          style={{ color: 'rgb(245, 158, 11)', fontSize: '0.7em', flexShrink: 0 }}
        >
          ●
        </span>
      )}
      <span className="truncate">{display}</span>
    </span>
  )}
</button>
```

### AppLayout での復帰時解除

```tsx
useEffect(() => {
  let unlistenFocus: (() => void) | null = null
  let unlistenNotif: (() => void) | null = null
  let disposed = false

  // 通知発火時のマーク付与
  tauriApi.onClaudeNotificationFired(({ pty_id }) => {
    useTerminalStore.getState().markUnread(pty_id)
  }).then((fn) => {
    if (disposed) fn()
    else unlistenNotif = fn
  }).catch(console.error)

  // アプリフォーカス復帰時の解除
  const win = getCurrentWindow()
  win.onFocusChanged(({ payload: focused }) => {
    if (!focused) return
    const state = useTerminalStore.getState()
    const panes: Array<'primary' | 'secondary'> = ['primary', 'secondary']
    for (const pane of panes) {
      const group = state[pane]
      const active = group.tabs.find((t) => t.id === group.activeTabId)
      if (active?.hasUnreadNotification) {
        state.clearUnread(active.id)
      }
    }
  }).then((fn) => {
    if (disposed) fn()
    else unlistenFocus = fn
  }).catch(console.error)

  return () => {
    disposed = true
    if (unlistenNotif) unlistenNotif()
    if (unlistenFocus) unlistenFocus()
  }
}, [])
```

## 状態管理

### Zustand ストア変更

```typescript
// makeTab 初期化
const makeTab = (index: number): TerminalTab => ({
  id: crypto.randomUUID(),
  ptyId: null,
  fallbackTitle: `Terminal ${index}`,
  oscTitle: null,
  manualTitle: null,
  pinned: false,
  hasUnreadNotification: false,   // 新規
})

// 新規アクション
markUnread: (ptyId) =>
  set((state) => {
    let changed = false
    const updateGroup = (g: TerminalGroup, isActivePane: boolean): TerminalGroup => {
      const tabs = g.tabs.map((t) => {
        if (t.ptyId !== ptyId) return t
        // アクティブ + document.hasFocus() ならユーザーが既に見ているので no-op
        const isActiveTab = isActivePane && g.activeTabId === t.id
        if (isActiveTab && typeof document !== 'undefined' && document.hasFocus()) return t
        if (t.hasUnreadNotification) return t
        changed = true
        return { ...t, hasUnreadNotification: true }
      })
      return changed ? { ...g, tabs } : g
    }
    const primary = updateGroup(state.primary, true)
    const secondary = updateGroup(state.secondary, true)
    if (!changed) return state
    return { primary, secondary }
  }),

clearUnread: (tabId) =>
  set((state) => {
    let changed = false
    const updateGroup = (g: TerminalGroup): TerminalGroup => {
      const tabs = g.tabs.map((t) => {
        if (t.id !== tabId) return t
        if (!t.hasUnreadNotification) return t
        changed = true
        return { ...t, hasUnreadNotification: false }
      })
      return changed ? { ...g, tabs } : g
    }
    const primary = updateGroup(state.primary)
    const secondary = updateGroup(state.secondary)
    if (!changed) return state
    return { primary, secondary }
  }),
```

**補足**: `markUnread` 内の「アクティブ+フォーカス判定」のために `document.hasFocus()` を呼ぶ。テスト環境（JSDOM）では常に true を返すため、`document.hasFocus()` を呼ぶ代わりにテストでは該当タブがアクティブの場合のみ検証する。あるいはテスト容易性のためにアクション引数に `isFocused` を受け取る設計も検討できるが、P4 ではシンプルさ優先で `document.hasFocus()` を直接使う。

## テストコード

### Reactコンポーネント / ストアテスト例

```typescript
// src/stores/terminalStore.test.ts に追加

describe('markUnread / clearUnread', () => {
  beforeEach(resetStore)

  it('該当 pty のタブに hasUnreadNotification=true がセットされる', () => {
    const { primary } = useTerminalStore.getState()
    const tabId = primary.tabs[0].id
    useTerminalStore.getState().setPtyId(tabId, 'pty-0')
    // 非アクティブにしてから markUnread（初期状態はアクティブなのでスキップされる）
    useTerminalStore.getState().addTab('primary')
    useTerminalStore.getState().markUnread('pty-0')
    expect(useTerminalStore.getState().primary.tabs[0].hasUnreadNotification).toBe(true)
  })

  it('clearUnread で false に戻る', () => {
    const { primary } = useTerminalStore.getState()
    const tabId = primary.tabs[0].id
    useTerminalStore.getState().setPtyId(tabId, 'pty-0')
    useTerminalStore.getState().addTab('primary')
    useTerminalStore.getState().markUnread('pty-0')
    useTerminalStore.getState().clearUnread(tabId)
    expect(useTerminalStore.getState().primary.tabs[0].hasUnreadNotification).toBe(false)
  })

  it('未知の pty_id では no-op', () => {
    useTerminalStore.getState().markUnread('unknown')
    const { primary, secondary } = useTerminalStore.getState()
    expect(primary.tabs.every((t) => !t.hasUnreadNotification)).toBe(true)
    expect(secondary.tabs.every((t) => !t.hasUnreadNotification)).toBe(true)
  })

  it('アクティブ + フォーカス中のタブには mark されない (JSDOM で hasFocus=true)', () => {
    const { primary } = useTerminalStore.getState()
    const tabId = primary.tabs[0].id
    useTerminalStore.getState().setPtyId(tabId, 'pty-0')
    // primary.tabs[0] が activeTabId に含まれる初期状態
    useTerminalStore.getState().markUnread('pty-0')
    // JSDOM では document.hasFocus() が true を返すためスキップされる
    expect(useTerminalStore.getState().primary.tabs[0].hasUnreadNotification).toBe(false)
  })

  it('同一 pty への連続 markUnread で state 参照が変わらない', () => {
    const { primary } = useTerminalStore.getState()
    const tabId = primary.tabs[0].id
    useTerminalStore.getState().setPtyId(tabId, 'pty-0')
    useTerminalStore.getState().addTab('primary')
    useTerminalStore.getState().markUnread('pty-0')
    const stateA = useTerminalStore.getState()
    useTerminalStore.getState().markUnread('pty-0')
    const stateB = useTerminalStore.getState()
    expect(stateA.primary).toBe(stateB.primary)
  })

  it('clearUnread はすでに false のタブで state 参照を変えない', () => {
    const { primary } = useTerminalStore.getState()
    const stateA = useTerminalStore.getState()
    useTerminalStore.getState().clearUnread(primary.tabs[0].id)
    const stateB = useTerminalStore.getState()
    expect(stateA.primary).toBe(stateB.primary)
  })
})
```

### Rustテスト例

本フェーズでは emit を 1 行追加するのみ。既存の `notification.rs` / `pty.rs` のユニットテストは emit のモックがないため追加せず、手動 E2E で検証する。既存 99 件のテストが全件パスすればよい。

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| Rust 側の emit を `is_app_focused=false` 判定内に配置 | 「OS 通知が実際に発火した」条件と一致させる。フォーカス時の無駄な emit を削る | 判定外で常に emit → フォーカス時のクリア処理をフロントで必要に応じて実装、複雑化 |
| マークはフロントの Zustand で完結 | Rust は emit のみで状態を持たない。ストア単一ソース | Rust にも未読状態を持つ → 同期コストとバグ源 |
| `markUnread` 内で「アクティブ+フォーカス時スキップ」防御 | レース条件（ユーザー復帰と emit 到着の同時発生）でチラつきを防ぐ | フロントで全ケース素通し + UI 側で即解除。体感で一瞬見える可能性 |
| 解除トリガーを 2 つ併用（クリック + onFocusChanged） | `document.hasFocus()` と Tauri の onFocusChanged は厳密一致しないため両方をカバーする | どちらか一方。どちらも欠点がある（クリックのみ: 復帰時アクティブタブ解除不可、onFocusChanged のみ: タブ切替時の即時解除不可） |
| `clearUnread` は `tabId` 指定 | 呼び出し側（タブクリックハンドラ / 復帰ハンドラ）で既に tab を特定している | `ptyId` 指定 → 再検索が無駄 |
| ラベル先頭の `●` を別 `<span>` で描画 | ツールチップ文字列（`title` 属性）に `●` を含めない、アクセント色を個別指定できる | ラベル文字列自体に `●` を結合 → ツールチップが汚れる、色変更困難 |
| 未読マーク色にアクセント色ではなく琥珀色（`rgb(245, 158, 11)`）を使用 | アクティブタブのアクセント色（下線）と未読タブの色が別色軸で独立し、両者が同時に付いても識別できる。琥珀は "注意喚起" のメンタルモデルに合致する | アクセント色を薄く合成する案。当初 15% で実装したが視認性が低く、濃くするとアクティブタブと混ざって識別性が落ちる |

## 未解決事項

- [ ] `persist` ミドルウェア導入時（将来）に `hasUnreadNotification` を永続化対象から除外するかの判断（基本セッション内のみでよい）
- [ ] 未読マーク解除を Cmd+番号 でのタブ切替（キーボードショートカット）でも発火させるか（`activateTabByIndex` 内でも clear するか）。P4 では単純化のためクリック経路のみで対応し、キーボードでのタブ切替でも `setActiveTab` が走るかを確認して必要なら追加する
- [ ] アクセシビリティ: `aria-label="unread"` を未読タブに付与するかどうか（スクリーンリーダー対応）。P4 では `●` を `aria-hidden="true"` として装飾扱いにし、別途 `data-unread` を付けておく案
