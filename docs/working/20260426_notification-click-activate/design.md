# 設計書 - notification-click-activate

## アーキテクチャ

### 全体フロー

```
[Claude Code]
   │ OSC 9 / HTTP hook
   ▼
[Rust: pty.rs / notification.rs]
   │  ① ペイロードに window_label + pty_id を埋め込んで通知発火
   ▼
[OS Notification Center]
   │  ② ユーザーがクリック
   ▼
[Rust: notification.rs on_action]
   │  ③ ペイロードから (window_label, pty_id) を復元
   │  ④ WebviewWindow::set_focus / unminimize / show
   │  ⑤ そのウィンドウだけに `notification-activate` を emit
   ▼
[Frontend: AppLayout.tsx]
   │  ⑥ pty_id から (pane, tabId) を解決
   │  ⑦ terminalStore.setActiveTab + setFocusedPane + clearUnread
   │  ⑧ 必要なら appStore.setActiveMainTab('terminal')
   ▼
[ユーザー視点] 発信元のタブが即座に表示される
```

### 影響範囲

- **バックエンド（Rust）**:
  - `src-tauri/src/commands/notification.rs` — 通知発火 API の引数拡張、`on_action` ハンドラ追加、ウィンドウフォアグラウンド化ヘルパー
  - `src-tauri/src/commands/pty.rs` — OSC 9 検出時の発火呼び出しに `window_label` / `pty_id` を引き渡す
  - `src-tauri/src/lib.rs` — `tauri::Builder` の `notification` プラグイン初期化と `on_action` 配線

- **フロントエンド**:
  - `src/lib/tauriApi.ts` — `notification-activate` イベント型と `on...` ヘルパー
  - `src/components/Layout/AppLayout.tsx` — リスナー登録、タブ切替＋モード切替の橋渡し
  - `src/stores/terminalStore.ts` — `findTabByPtyId(ptyId)` セレクタ追加（必要に応じて）

## 実装方針

### 概要

1. **発火側で「戻り先」をメタデータとして通知に焼き込む**
   `Notification::builder()` の `extra()` / `data` 相当のフィールドへ `window_label` と `pty_id` を JSON 文字列で乗せる。Tauri が直接サポートしない場合は、通知 ID を一意発番してメモリ上の `ClickTargetMap`（`HashMap<NotificationId, ClickTarget>`）と紐付ける方式にフォールバックする。

2. **クリックハンドラから対象ウィンドウへ単一指定の emit を行う**
   `app.emit_to(WindowLabel, "notification-activate", payload)` を使い、全ウィンドウに撒かない。これにより複数ウィンドウ環境でも誤動作しない。

3. **既存の `is_app_focused` 単一ウィンドウ前提を解消する**
   `is_app_focused(app, label)` のように引数化し、OSC 9 抑制判定でも発信元ウィンドウのフォーカス状態を見るように改修する。

4. **フロントは「pty_id → (pane, tabId)」逆引きを 1 か所に集約する**
   `terminalStore` 内に `findLocationByPtyId(ptyId): { pane, tabId } | null` を追加し、AppLayout 側のロジックを薄く保つ。

### 詳細

1. `notification.rs` に `ClickTarget { window_label: String, pty_id: Option<String> }` 構造体を新設。
2. `send_native_notification` を `send_native_notification(app, title, body, target: Option<ClickTarget>)` に拡張。
3. クリックトラッキング用の `Mutex<HashMap<String, ClickTarget>>` ステート `NotificationClickTargets` を `tauri::Builder::manage()` で登録。
4. 発火時に `notification_id = Uuid::new_v4().to_string()` を発番、ステートに `(notification_id, target)` を挿入し、通知本文に `notification_id` を `Action` として埋め込む（プラグイン API の対応状況に応じて差し替え）。
5. `tauri-plugin-notification` の `on_action` ハンドラ内で `notification_id` を受け取り、ステートから `target` を取り出して `activate_target(app, target)` を呼ぶ。
6. `activate_target` は以下を直列実行:
   - `app.get_webview_window(&target.window_label)` で取得
   - `.unminimize()` → `.show()` → `.set_focus()`
   - `.emit_to(EventTarget::WebviewWindow(label), "notification-activate", json!({ "pty_id": target.pty_id }))`
7. フロント `AppLayout.tsx` で `tauriApi.onNotificationActivate(({ pty_id }) => { ... })` を listen し、`terminalStore` / `appStore` を更新。

## データ構造

### 型定義（TypeScript）

```typescript
// src/lib/tauriApi.ts

export interface NotificationActivatePayload {
  /** 発信元 PTY。HTTP hook 経由などで解決できなかった場合は null */
  pty_id: string | null
}

// tauriApi に追加
onNotificationActivate: (
  callback: (payload: NotificationActivatePayload) => void,
): Promise<UnlistenFn> =>
  listen<NotificationActivatePayload>('notification-activate', (event) =>
    callback(event.payload),
  ),
```

```typescript
// src/stores/terminalStore.ts に追加

interface TerminalState {
  // ...既存
  /** pty_id を逆引きしてタブ位置を返す。アクティブ化用 */
  findLocationByPtyId: (ptyId: string) => { pane: 'primary' | 'secondary'; tabId: string } | null
}
```

### 型定義（Rust）

```rust
// src-tauri/src/commands/notification.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClickTarget {
    pub window_label: String,
    pub pty_id: Option<String>,
}

#[derive(Default)]
pub struct NotificationClickTargets {
    map: Mutex<HashMap<String, ClickTarget>>,
}

impl NotificationClickTargets {
    pub fn register(&self, id: String, target: ClickTarget) {
        if let Ok(mut g) = self.map.lock() {
            g.insert(id, target);
        }
    }

    pub fn take(&self, id: &str) -> Option<ClickTarget> {
        self.map.lock().ok().and_then(|mut g| g.remove(id))
    }
}
```

## API 設計

### Tauri コマンド

| コマンド名 | 引数 | 戻り値 | 説明 |
|-----------|------|--------|------|
| `send_notification` | `title: String, body: String, target: Option<ClickTarget>` | `Result<(), String>` | 既存の引数に `target` を追加。クリック時の戻り先を指定可能にする |

### Tauri イベント

| イベント名 | ペイロード | 送信方向 | 説明 |
|-----------|-----------|----------|------|
| `claude-notification-fired` | `{ pty_id: string }` | Rust → 全ウィンドウ（既存） | 未読マーク用。本要件では変更しない |
| `notification-activate` | `{ pty_id: string \| null }` | Rust → **対象ウィンドウのみ**（新規） | 通知クリックで発信元タブをアクティブ化する指示 |

### 既存ロジックの修正点

| 関数 | 現状 | 変更後 |
|------|------|--------|
| `is_app_focused(app)` | `get_webview_window("main")` 決め打ち | `is_window_focused(app, label)` に改名し、引数のラベルで取得 |
| `send_native_notification(app, title, body)` | クリックハンドラなし | `target: Option<ClickTarget>` を受け取り、`Action` として埋め込む |
| `pty.rs` の OSC 9 通知発火箇所 | `is_app_focused(&app)` で抑制判定 | `is_window_focused(&app, &pty_window_label)` に変更し、発火時は `target = Some(ClickTarget { window_label, pty_id })` を渡す |

## UI 設計

本要件はバックエンド〜状態管理が中心であり、新規 UI コンポーネントは追加しない。既存の以下挙動を維持する:

- 通知タイトル: `Claude Code — {タブの表示タイトル}`
- 未読マーク: 琥珀色（#F59E0B）のドット＋左ボーダー＋薄い背景

クリック後の挙動として、ウィンドウフォーカス + タブ切替 + モード切替が連続して発生するため、**ターミナルパネルの xterm.js 描画再開**が遅延しないことを `useTerminal` 側で確認する（既存のフォーカス復帰時 `clearUnread` と整合性を取る）。

## 状態管理

### Zustand ストア変更

```typescript
// terminalStore.ts に追加

findLocationByPtyId: (ptyId) => {
  const state = get()
  for (const pane of ['primary', 'secondary'] as const) {
    const tab = state[pane].tabs.find((t) => t.ptyId === ptyId)
    if (tab) return { pane, tabId: tab.id }
  }
  return null
},
```

`appStore` 側はメソッド追加なし。既存の `setActiveMainTab('terminal')` を AppLayout から呼び出すのみ。

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| 通知 ID は UUID で発番し `NotificationClickTargets` ステートで保持 | `tauri-plugin-notification` の API が `extra` / `data` フィールドをペイロード化していない可能性に備える。take 方式にすればクリック後にメモリ自動解放 | 通知本文に JSON を埋め込む案。プラットフォーム依存が強く、表示文字列汚染リスクあり |
| `emit_to(label, ...)` で対象ウィンドウのみへ送信 | `menu-new-window` の二重発火問題（`docs/steering/features/window-tabs.md` § 4.2）と同種の事故を予防 | `app.emit(...)` ブロードキャスト + フロントで自ウィンドウ判定。判定漏れリスクあり |
| `is_app_focused` を `is_window_focused(label)` にリネーム | 単一ウィンドウ前提のシグネチャを引きずると将来事故源になる | 内部だけ修正し名前据え置き。将来読み手が誤解する |
| `findLocationByPtyId` は `terminalStore` のセレクタとして提供 | UI 側に逆引きロジックを撒くと test 困難 | AppLayout 内で直接 `useTerminalStore.getState()` を走査。テスト性低下 |
| HTTP hook 経由の `pty_id` 解決は本要件スコープ外 | Claude Code 側に hook payload で `pty_id` を渡す手段がなく、cwd 一致推定は別途設計が必要 | 本要件で全部対応。スコープ膨張・期間遅延 |

## 未解決事項

- [ ] `tauri-plugin-notification` v2 の `on_action` 相当 API の有無確認。なければ `notify-rust` への乗り換え or プラグインへ PR を出すかを判断
- [ ] macOS で通知権限ダイアログが再度トリガーされるか（実機検証）
- [ ] Linux 環境でのクリックハンドラ動作（`notify-send` ベースだとアクション未対応の可能性）
- [ ] 通知クリック時にウィンドウが既にフォーカス済みだった場合の挙動（タブ切替だけで足りるか、`set_focus` を呼んでも害がないかを確認）

## テストコード

### Reactコンポーネントテスト例

```typescript
// src/stores/terminalStore.test.ts

import { describe, it, expect } from 'vitest'
import { useTerminalStore } from './terminalStore'

describe('findLocationByPtyId', () => {
  it('returns location of the tab with matching pty_id in primary pane', () => {
    const store = useTerminalStore.getState()
    store.setPtyId(store.primary.tabs[0].id, 'pty-42')
    const result = useTerminalStore.getState().findLocationByPtyId('pty-42')
    expect(result).toEqual({ pane: 'primary', tabId: store.primary.tabs[0].id })
  })

  it('returns null when no tab matches', () => {
    expect(useTerminalStore.getState().findLocationByPtyId('pty-999')).toBeNull()
  })
})
```

### Rustテスト例

```rust
// src-tauri/src/commands/notification.rs

#[cfg(test)]
mod click_target_tests {
    use super::*;

    #[test]
    fn register_and_take_round_trip() {
        let store = NotificationClickTargets::default();
        let target = ClickTarget {
            window_label: "main".into(),
            pty_id: Some("pty-1".into()),
        };
        store.register("notif-1".into(), target.clone());
        let popped = store.take("notif-1").unwrap();
        assert_eq!(popped.window_label, "main");
        assert_eq!(popped.pty_id.as_deref(), Some("pty-1"));
        // take は消費するので 2 回目は None
        assert!(store.take("notif-1").is_none());
    }

    #[test]
    fn take_unknown_id_returns_none() {
        let store = NotificationClickTargets::default();
        assert!(store.take("unknown").is_none());
    }
}
```
