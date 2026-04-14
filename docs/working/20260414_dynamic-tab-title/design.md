# 設計書 - dynamic-tab-title（P2: OSC 0/1/2 による動的タブタイトル）

## アーキテクチャ

### 対象コンポーネント

```
PTY 出力バイト列
    │
    ▼
alacritty_terminal のパーサ (ansi::Processor::advance)
    │
    │  OSC 0 / OSC 1 / OSC 2 を検出
    │  Event::Title(String) または Event::ResetTitle を発火
    ▼
TermEventHandler::send_event  （← 本フェーズで no-op から脱却）
    │  AppHandle と pty_id を保持
    │  TitleChangedPayload { pty_id, title: Option<String> } を構築
    ▼
Tauri event emit  "terminal-title-changed"
    │
    ▼
Frontend: tauriApi.onTerminalTitleChanged
    │
    ▼
useTerminalStore.setOscTitle(ptyId, rawTitle)
    │  sanitizeTitle で制御文字除去
    │  直前値と同一ならスキップ
    │
    ▼
TerminalTab.oscTitle 更新
    │
    ├─────────────────────────────────────────────┐
    ▼                                             ▼
TerminalTabs.tsx 再描画                        Zustand subscribe
computeDisplayTitle(tab) を参照                  │
（oscTitle ?? fallbackTitle）                    │  (tab.ptyId, displayTitle)
                                                 │   の変化を検知
                                                 ▼
                                   tauriApi.setPtyDisplayTitle(ptyId, title)
                                                 │ (Phase 1 で追加済)
                                                 ▼
                                          Rust DisplayTitleCache
                                                 │
                                                 ▼
                                 OSC 9 通知発火時のタイトル差し込みに利用
```

### 影響範囲

- **フロントエンド**:
  - `src/stores/terminalStore.ts` — `TerminalTab` 型拡張、`computeDisplayTitle`、`sanitizeTitle`、`setOscTitle`、`findTabByPtyId`
  - `src/lib/tauriApi.ts` — `onTerminalTitleChanged` リスナー追加
  - `src/components/TerminalPanel/TerminalTabs.tsx` — ラベル取得を `computeDisplayTitle(tab)` に変更、ツールチップ
  - `src/App.tsx`（またはアプリ初期化の妥当な箇所）— イベント購読と Zustand subscribe 起動
- **バックエンド（Rust）**:
  - `src-tauri/src/terminal/event.rs` — `TermEventHandler` 刷新
  - `src-tauri/src/terminal/instance.rs` — `TerminalInstance::new` シグネチャ変更
  - `src-tauri/src/commands/pty.rs` — 呼び出し更新

## 実装方針

### 概要

OSC 0/1/2 由来の動的タイトルは alacritty-terminal のパーサが既に `Event::Title` に集約して発火する。現状 `TermEventHandler` がイベントを捨てているため、ここを「中継器」に改造する。

中継先はフロントの Zustand ストア。UI はストアの `TerminalTab.oscTitle` を見てラベルを合成する。Rust 側 `DisplayTitleCache`（P1 で追加済み）への同期は **フロントの subscribe から経由** させる。こうすることで:

- 表示タイトルの合成ロジック（`computeDisplayTitle`）が唯一の真実となり、P3 以降の pinned / manualTitle 追加時も同じ経路で対応できる。
- Rust → Rust の閉じたループ（event → cache）を作らないため、後続フェーズで手動リネーム（フロント起点）と OSC 更新（Rust 起点）の競合ロジックをフロントに閉じ込められる。

### 詳細

1. **Rust: `TermEventHandler` 刷新**
   - ユニット構造体から `{ app: AppHandle, pty_id: String }` を保持する構造体に変更。
   - `send_event` で `Event::Title(s)` / `Event::ResetTitle` を捕捉し、`TitleChangedPayload { pty_id, title }` を emit。`title` は `Event::Title(s)` なら `Some(s.trim())`、空なら `None`、`ResetTitle` なら `None`。

2. **Rust: `TerminalInstance::new` シグネチャ変更**
   - `new(cols, lines)` → `new(cols, lines, app, pty_id)`。
   - 内部で `TermEventHandler { app, pty_id }` を生成して `Term::new` に渡す。

3. **Rust: `pty.rs` の呼び出し更新**
   - `terminal_manager.insert(id.clone(), TerminalInstance::new(80, 24))` を `TerminalInstance::new(80, 24, app.clone(), id.clone())` に。
   - `TerminalInstance` は `Term<TermEventHandler>` を保持するため、`TermEventHandler` の型シグネチャが変わっても既存コードは影響を受けない（ジェネリクス）。

4. **Front: `TerminalTab` 型拡張**
   - `title: string` を削除し、`fallbackTitle: string` / `oscTitle: string | null` を追加。
   - 既存コードで `tab.title` を参照している箇所を `computeDisplayTitle(tab)` に置換。

5. **Front: ユーティリティ関数**
   - `sanitizeTitle(raw: string): string | null` — 制御文字除去・trim・空 → null。
   - `computeDisplayTitle(tab: TerminalTab): string` — P2 スコープでは `tab.oscTitle ?? tab.fallbackTitle`（P3 で pinned 追加時に拡張）。

6. **Front: `setOscTitle` アクション**
   - `pty_id` → 該当タブを探索し、サニタイズ後の値で `oscTitle` を更新。
   - 直前値と同一ならストア更新をスキップ。

7. **Front: Tauri イベント購読**
   - `tauriApi.onTerminalTitleChanged` を追加。
   - アプリ初期化箇所で 1 回だけ購読。

8. **Front: Zustand subscribe で Rust 同期**
   - `(tab.ptyId, computeDisplayTitle(tab))` の組が変化したタブを検出し、`tauriApi.setPtyDisplayTitle` を呼ぶ。
   - 初期化時に全タブを走査して初回同期（P1 の `TerminalPanel` 側初回同期と重複するが冪等なので許容）。

9. **UI: タブラベルの省略表示**
   - Tailwind の `max-w-[12rem] truncate`（既存スタイルに合わせて調整）。
   - `title` 属性に完全な表示タイトルを入れ、ホバーでツールチップ表示。

## データ構造

### 型定義（TypeScript）

```typescript
// src/stores/terminalStore.ts

export interface TerminalTab {
  id: string
  ptyId: string | null
  fallbackTitle: string         // "Terminal 1" など、作成時に固定される名前
  oscTitle: string | null       // OSC 0/1/2 で受け取った最新タイトル（null = 未受信 or リセット）
}

// サニタイズ（制御文字除去・trim・空→null）
export function sanitizeTitle(raw: string | null | undefined): string | null {
  if (raw == null) return null
  // 制御文字 (C0 + DEL) を除去
  const cleaned = raw.replace(/[\x00-\x1F\x7F]/g, '').trim()
  return cleaned.length === 0 ? null : cleaned
}

// 表示タイトル合成（P2 スコープ）
export function computeDisplayTitle(tab: TerminalTab): string {
  return tab.oscTitle ?? tab.fallbackTitle
}
```

### Tauri イベントペイロード（Rust）

```rust
// src-tauri/src/terminal/event.rs

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use alacritty_terminal::event::{Event, EventListener};

#[derive(Serialize, Clone)]
pub struct TitleChangedPayload {
    pub pty_id: String,
    pub title: Option<String>,
}

pub struct TermEventHandler {
    app: AppHandle,
    pty_id: String,
}

impl TermEventHandler {
    pub fn new(app: AppHandle, pty_id: String) -> Self {
        Self { app, pty_id }
    }
}

impl EventListener for TermEventHandler {
    fn send_event(&self, event: Event) {
        match event {
            Event::Title(s) => {
                let trimmed = s.trim();
                let payload = TitleChangedPayload {
                    pty_id: self.pty_id.clone(),
                    title: if trimmed.is_empty() {
                        None
                    } else {
                        Some(trimmed.to_string())
                    },
                };
                let _ = self.app.emit("terminal-title-changed", payload);
            }
            Event::ResetTitle => {
                let payload = TitleChangedPayload {
                    pty_id: self.pty_id.clone(),
                    title: None,
                };
                let _ = self.app.emit("terminal-title-changed", payload);
            }
            _ => {} // 他のイベントは従来どおり無視
        }
    }
}
```

## API設計

### Tauriコマンド

本フェーズでは **新規追加なし**。P1 で追加した `set_pty_display_title` を引き続き利用する。

### Tauriイベント

| イベント名 | ペイロード | 説明 |
|-----------|-----------|------|
| `terminal-title-changed` | `{ pty_id: string, title: string \| null }` | OSC 0/1/2 由来のタイトル変化。`title = null` はリセットまたは空文字を意味する |

### フロント API

```typescript
// src/lib/tauriApi.ts に追記

export interface TerminalTitleChangedPayload {
  pty_id: string
  title: string | null
}

export const tauriApi = {
  // ...existing...
  onTerminalTitleChanged: (
    callback: (payload: TerminalTitleChangedPayload) => void,
  ): Promise<UnlistenFn> =>
    listen<TerminalTitleChangedPayload>("terminal-title-changed", (event) =>
      callback(event.payload),
    ),
}
```

## UI設計

### UIライブラリ

本フェーズでは新規ライブラリ追加なし（既存の `TerminalTabs.tsx` のタブ表示を改修するのみ）。

### カラーパレット

既存の CSS カスタムプロパティを踏襲（`--color-text-primary` / `--color-text-muted` 等）。本フェーズで新規色定義は行わない。

### 画面構成

- 対象: `src/components/TerminalPanel/TerminalTabs.tsx`
- タブラベルの最大幅を CSS で制限（例: `max-w-[12rem] truncate`）し、省略時は ellipsis（`...`）で表示。
- `<span title={display}>...</span>` でマウスホバー時にブラウザネイティブのツールチップで全文を表示。

### コンポーネント構成

既存のタブ構造は変更せず、ラベル取得ロジックのみ差し替える。

```tsx
// Before
<span>{tab.title}</span>

// After
const display = computeDisplayTitle(tab)
<span className="max-w-[12rem] truncate" title={display}>{display}</span>
```

## 状態管理

### Zustand ストア変更

```typescript
// src/stores/terminalStore.ts

export interface TerminalTab {
  id: string
  ptyId: string | null
  fallbackTitle: string
  oscTitle: string | null
}

interface TerminalState {
  // ...existing...
  setOscTitle: (ptyId: string, rawTitle: string | null) => void
  findTabByPtyId: (ptyId: string) => TerminalTab | null
}

// makeTab の変更
const makeTab = (index: number): TerminalTab => ({
  id: crypto.randomUUID(),
  ptyId: null,
  fallbackTitle: `Terminal ${index}`,
  oscTitle: null,
})

// 新規アクション
setOscTitle: (ptyId, rawTitle) =>
  set((state) => {
    const sanitized = sanitizeTitle(rawTitle)
    const updateGroup = (g: TerminalGroup): TerminalGroup => ({
      ...g,
      tabs: g.tabs.map((t) => {
        if (t.ptyId !== ptyId) return t
        if (t.oscTitle === sanitized) return t // 同一値 → no-op
        return { ...t, oscTitle: sanitized }
      }),
    })
    return { primary: updateGroup(state.primary), secondary: updateGroup(state.secondary) }
  }),
```

### 初期化箇所（`App.tsx` もしくは既存の App ブート処理）

```typescript
useEffect(() => {
  let unlistenFn: UnlistenFn | null = null
  tauriApi
    .onTerminalTitleChanged(({ pty_id, title }) => {
      useTerminalStore.getState().setOscTitle(pty_id, title)
    })
    .then((f) => { unlistenFn = f })
    .catch(console.error)

  // 表示タイトル変化を Rust キャッシュに同期
  const unsubscribe = useTerminalStore.subscribe((state, prev) => {
    const walk = (
      cur: TerminalGroup,
      old: TerminalGroup,
    ) => {
      for (const tab of cur.tabs) {
        if (!tab.ptyId) continue
        const oldTab = old.tabs.find((t) => t.id === tab.id)
        const newDisp = computeDisplayTitle(tab)
        const oldDisp = oldTab ? computeDisplayTitle(oldTab) : null
        if (newDisp !== oldDisp) {
          tauriApi.setPtyDisplayTitle(tab.ptyId, newDisp).catch(console.error)
        }
      }
    }
    walk(state.primary, prev.primary)
    walk(state.secondary, prev.secondary)
  })

  return () => {
    if (unlistenFn) unlistenFn()
    unsubscribe()
  }
}, [])
```

## テストコード

### Reactコンポーネント / ストアテスト例

```typescript
// src/stores/terminalStore.test.ts に追加

import { describe, it, expect, beforeEach } from 'vitest'
import { useTerminalStore, computeDisplayTitle, sanitizeTitle } from './terminalStore'

describe('sanitizeTitle', () => {
  it('trims whitespace', () => {
    expect(sanitizeTitle('  hello  ')).toBe('hello')
  })

  it('removes C0 control characters', () => {
    expect(sanitizeTitle('a\x00b\x1Fc')).toBe('abc')
  })

  it('returns null for empty after sanitize', () => {
    expect(sanitizeTitle('   \t\n')).toBeNull()
  })

  it('returns null for null/undefined', () => {
    expect(sanitizeTitle(null)).toBeNull()
    expect(sanitizeTitle(undefined)).toBeNull()
  })
})

describe('computeDisplayTitle', () => {
  it('returns fallbackTitle when oscTitle is null', () => {
    const tab = { id: '1', ptyId: null, fallbackTitle: 'Terminal 1', oscTitle: null }
    expect(computeDisplayTitle(tab)).toBe('Terminal 1')
  })

  it('prefers oscTitle over fallbackTitle', () => {
    const tab = { id: '1', ptyId: 'p', fallbackTitle: 'Terminal 1', oscTitle: 'vim foo.ts' }
    expect(computeDisplayTitle(tab)).toBe('vim foo.ts')
  })
})

describe('setOscTitle', () => {
  beforeEach(() => {
    // ストアをリセット
    useTerminalStore.setState(/* initial */)
  })

  it('updates oscTitle on the matching tab', () => {
    const { primary, setPtyId, setOscTitle } = useTerminalStore.getState()
    setPtyId(primary.tabs[0].id, 'pty-0')
    setOscTitle('pty-0', 'hello')
    const updated = useTerminalStore.getState().primary.tabs[0]
    expect(updated.oscTitle).toBe('hello')
  })

  it('skips update when value is unchanged', () => {
    // set 回数を spy して同一値で set が呼ばれないことを確認（Zustand は参照比較なので実用上は新オブジェクト化されない）
  })

  it('resets to null on empty input', () => {
    const { primary, setPtyId, setOscTitle } = useTerminalStore.getState()
    setPtyId(primary.tabs[0].id, 'pty-0')
    setOscTitle('pty-0', 'hello')
    setOscTitle('pty-0', '')
    expect(useTerminalStore.getState().primary.tabs[0].oscTitle).toBeNull()
  })

  it('does nothing for unknown ptyId', () => {
    useTerminalStore.getState().setOscTitle('unknown', 'hello')
    // すべてのタブで oscTitle は null のまま
    const { primary, secondary } = useTerminalStore.getState()
    expect(primary.tabs.every((t) => t.oscTitle === null)).toBe(true)
    expect(secondary.tabs.every((t) => t.oscTitle === null)).toBe(true)
  })
})
```

### Rustテスト例

```rust
// src-tauri/src/terminal/event.rs に追加

#[cfg(test)]
mod tests {
    use super::*;
    // AppHandle が必要なので emit の単体テストは mockall 等を使わない限り難しい。
    // ここでは TitleChangedPayload の構築ロジックだけ確認する純粋関数に切り出す
    // もしくは build_payload ヘルパーに抽出して単体テストする。

    fn build_payload(pty_id: &str, event: &Event) -> Option<TitleChangedPayload> {
        match event {
            Event::Title(s) => {
                let trimmed = s.trim();
                Some(TitleChangedPayload {
                    pty_id: pty_id.to_string(),
                    title: if trimmed.is_empty() { None } else { Some(trimmed.to_string()) },
                })
            }
            Event::ResetTitle => Some(TitleChangedPayload {
                pty_id: pty_id.to_string(),
                title: None,
            }),
            _ => None,
        }
    }

    #[test]
    fn title_event_produces_payload() {
        let p = build_payload("pty-0", &Event::Title("hello".into())).unwrap();
        assert_eq!(p.pty_id, "pty-0");
        assert_eq!(p.title.as_deref(), Some("hello"));
    }

    #[test]
    fn title_event_trims_whitespace() {
        let p = build_payload("pty-0", &Event::Title("  hi  ".into())).unwrap();
        assert_eq!(p.title.as_deref(), Some("hi"));
    }

    #[test]
    fn title_event_empty_becomes_none() {
        let p = build_payload("pty-0", &Event::Title("   ".into())).unwrap();
        assert!(p.title.is_none());
    }

    #[test]
    fn reset_title_produces_none() {
        let p = build_payload("pty-0", &Event::ResetTitle).unwrap();
        assert!(p.title.is_none());
    }

    #[test]
    fn other_events_are_ignored() {
        // Event::Bell など他のバリアントでは payload を作らない
        assert!(build_payload("pty-0", &Event::Bell).is_none());
    }
}
```

本実装では `build_payload` ヘルパーを `event.rs` に用意し、`send_event` の中でそれを呼ぶ形にする（テスト容易性のため）。

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| Rust → Front → Rust の経路で Rust キャッシュを更新 | 表示タイトル合成ロジックをフロントに一元化。P3 で pinned を追加するとき、OSC と手動リネームの競合解決をフロントに閉じ込められる | Rust 内で直接キャッシュ更新。P3 の競合解決が Rust/Front 両方に分散し複雑化 |
| `TermEventHandler` を pty ごとにインスタンス化 | `AppHandle::clone` は安価、`pty_id` を保持することで emit 側でタブ特定不要 | グローバル handler + `TerminalInstance` が pty_id をイベントに注入。`EventListener` trait が `&self` のみなので難しい |
| OSC タイトルのサニタイズをフロントで実施 | UI 表示に関わる整形ロジックはフロントにあるのが自然。ブラウザ側で表示される文字列の安全性を一箇所で保証 | Rust 側でサニタイズ。両方で実施するのはコスト増 |
| `TerminalTab.title` を削除し `fallbackTitle`/`oscTitle` に分解 | P3 で pinned/manualTitle を追加する前提で拡張性を確保 | `title` を残して OSC 上書き。P3 での状態管理が破綻する |
| `Event::Title` と `Event::ResetTitle` のみ処理 | 他の `Event` バリアント（`Bell`, `MouseCursorDirty` 等）は現状不要 | すべて emit。ノイズ増とパフォーマンス低下 |
| 表示タイトル変化を Zustand subscribe で検出し Rust 同期 | 単一の差分検出箇所で済む。subscribe のオーバーヘッドは小さい | OSC イベント受信ハンドラ内で直接 invoke。P3 の手動リネーム時に追加の分岐が必要 |

## 未解決事項

- [ ] alacritty_terminal v0.25.1 で OSC 0 / OSC 1 が `Event::Title` に集約されるか（OSC 1 は icon title で別扱いの可能性）。実装着手時に最小 POC（`cargo test` レベル）で要確認
- [ ] Zustand `subscribe` で全タブを走査する O(N) 処理のコスト。通常タブ数は数個〜十数個なので問題なしだが、30+ タブで確認すべきか
- [ ] `tab.title` を参照している既存コンポーネントの完全な洗い出し（`src/components/TerminalPanel/TerminalTabs.tsx:117` 以外に波及箇所がないか、実装時に grep で最終確認）
- [ ] `terminalStore.test.ts` の既存テストが `title` プロパティに依存している場合の更新要否（実装時に確認）
