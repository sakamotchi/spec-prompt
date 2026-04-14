# 設計書 - notification-tab-name（P1: 通知タイトルへのタブ識別子差し込み）

## アーキテクチャ

### 対象コンポーネント

```
Frontend (React/TypeScript)
  │
  │  ① spawnPty() が ptyId を返した直後
  │     TerminalTab.title を setPtyDisplayTitle で同期
  │
  ▼
Tauri IPC
  │  invoke("set_pty_display_title", { ptyId, title })
  ▼
Rust Backend
  │
  │  DisplayTitleCache (HashMap<pty_id, title>)
  │
  │  ② PTY リーダースレッドで OSC 9 検出
  │     キャッシュを参照して通知タイトル組み立て
  ▼
tauri-plugin-notification
  ▼
macOS デスクトップ通知 (タイトル: "Claude Code — Terminal 1")
```

### 影響範囲

- **フロントエンド**:
  - `src/lib/tauriApi.ts` — 新規メソッド `setPtyDisplayTitle`
  - `src/stores/terminalStore.ts` — `setPtyId` アクションから Rust 同期を発火（または呼び出し側で対応）
  - `src/components/TerminalPanel/TerminalPanel.tsx` — `spawnPty` 呼び出し後の初期同期追加（必要に応じて）
- **バックエンド（Rust）**:
  - `src-tauri/src/commands/notification.rs` — `DisplayTitleCache` 構造体、`set_pty_display_title` コマンド
  - `src-tauri/src/commands/pty.rs` — 通知送信時のタイトル合成、`close_pty` での掃除
  - `src-tauri/src/lib.rs` — `manage` 追加、コマンド登録

## 実装方針

### 概要

「通知に差し込むタイトル文字列」を Rust 側で保持するキャッシュ（`DisplayTitleCache`）を単一ソースとし、フロントはそのキャッシュへ `invoke` で書き込むだけ。OS 通知発火時は Rust 側が自己完結でキャッシュを参照し、IPC 往復なしでタイトルを組み立てる。

これにより、Phase 2 で OSC 0/1/2 由来の自動更新を追加する際も、更新源がフロントから Rust への 1 系統しかない状態を維持できる（Phase 2 でフロントは「OSC 経由で受け取ったタイトルを解決 → Rust へ再同期」の形を踏襲する）。

### 詳細

1. **Rust にキャッシュ構造体を追加**
   `DisplayTitleCache { map: Mutex<HashMap<String, String>> }` を定義し、`set` / `get` / `remove` を提供する。`tauri::State` として `manage` 登録する。

2. **Tauri コマンド追加**
   `set_pty_display_title(pty_id: String, title: String, cache: State<DisplayTitleCache>)` を追加し、`invoke_handler` に登録する。

3. **通知発火時にタイトル合成**
   `pty.rs` の OSC 9 検出ブロック（現 144-152 行）でキャッシュを参照し、値があれば `format!("Claude Code — {}", t)`、なければフォールバック `"SpecPrompt / Claude Code"` を使う。既存のフォーカス判定（`is_app_focused`）ロジックは変更しない。

4. **PTY クローズ時の掃除**
   `close_pty` で `cache.remove(&id)` を呼ぶ（`PtyManager::instances` / `TerminalManager` の removal と並ぶ 1 行追加）。

5. **フロント側 API**
   `tauriApi.setPtyDisplayTitle(ptyId, title)` を追加。

6. **フロント側 初期同期**
   `terminalStore.setPtyId(tabId, ptyId)` のタイミングで、該当 `tab.title` を `setPtyDisplayTitle(ptyId, title)` に流す。`setPtyId` の中でラッパーとして実装するか、呼び出し側（`TerminalPanel.tsx`）で `spawnPty` 成功後に直接呼ぶ。現行コードの最小侵襲を優先して呼び出し側で対応する。

## データ構造

### 型定義（TypeScript）

既存型の変更はなし。`tauriApi` に以下を追加するのみ。

```typescript
// src/lib/tauriApi.ts に追記
export const tauriApi = {
  // ...existing...
  setPtyDisplayTitle: (ptyId: string, title: string): Promise<void> =>
    invoke("set_pty_display_title", { ptyId, title }),
}
```

### 型定義（Rust）

```rust
// src-tauri/src/commands/notification.rs に追加

use std::collections::HashMap;
use std::sync::Mutex;

pub struct DisplayTitleCache {
    map: Mutex<HashMap<String, String>>,
}

impl DisplayTitleCache {
    pub fn new() -> Self {
        Self { map: Mutex::new(HashMap::new()) }
    }

    pub fn set(&self, pty_id: &str, title: &str) {
        if let Ok(mut guard) = self.map.lock() {
            guard.insert(pty_id.to_string(), title.to_string());
        }
    }

    pub fn get(&self, pty_id: &str) -> Option<String> {
        self.map.lock().ok().and_then(|g| g.get(pty_id).cloned())
    }

    pub fn remove(&self, pty_id: &str) {
        if let Ok(mut guard) = self.map.lock() {
            guard.remove(pty_id);
        }
    }
}
```

## API設計

### Tauriコマンド

| コマンド名 | 引数 | 戻り値 | 説明 |
|-----------|------|--------|------|
| `set_pty_display_title` | `{ ptyId: String, title: String }` | `Result<(), String>` | フロントから Rust 側 `DisplayTitleCache` へ表示タイトルを同期する |

```rust
#[tauri::command]
pub fn set_pty_display_title(
    pty_id: String,
    title: String,
    cache: tauri::State<DisplayTitleCache>,
) -> Result<(), String> {
    cache.set(&pty_id, &title);
    Ok(())
}
```

### Tauriイベント

本フェーズでは新規イベントを追加しない（Phase 2 で `terminal-title-changed` を追加予定）。

### 通知送信箇所の変更

```rust
// src-tauri/src/commands/pty.rs (現 144-152 行) 置換

for msg in osc9.feed(&buf[..n]) {
    if !crate::commands::notification::is_app_focused(&app) {
        let cache = app.state::<crate::commands::notification::DisplayTitleCache>();
        let title = cache
            .get(&pty_id)
            .map(|t| format!("Claude Code — {}", t))
            .unwrap_or_else(|| "SpecPrompt / Claude Code".to_string());

        crate::commands::notification::send_native_notification(
            &app,
            &title,
            &msg,
        );
    }
}
```

### `close_pty` の変更

```rust
#[tauri::command]
pub fn close_pty(
    id: String,
    manager: State<PtyManager>,
    terminal_manager: State<TerminalManager>,
    title_cache: State<crate::commands::notification::DisplayTitleCache>, // 追加
) -> Result<(), String> {
    manager.instances.lock().unwrap().remove(&id);
    terminal_manager.remove(&id);
    title_cache.remove(&id); // 追加
    Ok(())
}
```

## UI設計

本フェーズは UI 変更なし。

## 状態管理

### Zustand ストア変更

型変更は行わない。`setPtyId` アクションの挙動のみ拡張する（現行シグネチャを維持）。

**パターン A（ストア内でラップ）**:

```typescript
// src/stores/terminalStore.ts
setPtyId: (tabId, ptyId) => {
  set((state) => updateTabPtyId(state, tabId, ptyId))
  // 追加: Rust キャッシュに同期
  const tab = findTab(get(), tabId)
  if (tab && ptyId) {
    tauriApi.setPtyDisplayTitle(ptyId, tab.title).catch(() => {})
  }
},
```

**パターン B（呼び出し側で同期）**:

```typescript
// src/components/TerminalPanel/TerminalPanel.tsx の spawnPty 呼び出し直後
const ptyId = await tauriApi.spawnPty(shell, cwd, notificationEnabled)
setPtyId(tab.id, ptyId)
tauriApi.setPtyDisplayTitle(ptyId, tab.title).catch(() => {})
```

→ **パターン B を採用**（ストアを薄く保ち、副作用を UI 層に閉じる）。

## テストコード

### Rustテスト例

```rust
// src-tauri/src/commands/notification.rs の #[cfg(test)] に追加

#[test]
fn display_title_cache_set_and_get() {
    let cache = DisplayTitleCache::new();
    cache.set("pty-0", "Terminal 1");
    assert_eq!(cache.get("pty-0").as_deref(), Some("Terminal 1"));
}

#[test]
fn display_title_cache_overwrite() {
    let cache = DisplayTitleCache::new();
    cache.set("pty-0", "Terminal 1");
    cache.set("pty-0", "renamed");
    assert_eq!(cache.get("pty-0").as_deref(), Some("renamed"));
}

#[test]
fn display_title_cache_remove() {
    let cache = DisplayTitleCache::new();
    cache.set("pty-0", "Terminal 1");
    cache.remove("pty-0");
    assert_eq!(cache.get("pty-0"), None);
}

#[test]
fn display_title_cache_unknown_key_returns_none() {
    let cache = DisplayTitleCache::new();
    assert_eq!(cache.get("missing"), None);
}
```

### Reactコンポーネントテスト例

本フェーズの UI 変更なしのため、コンポーネントテストは追加しない。`tauriApi.setPtyDisplayTitle` の invoke 経路が呼ばれることは手動 E2E で確認する。

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| キャッシュを Rust に持つ（フロントに持たない） | 通知発火は Rust 側で完結するため、IPC 往復を避ける。後続の Phase 4（未読マーク判定）でも Rust 側に最新タイトルがある方が判定が軽い | フロントに持ち、通知発火を毎回フロント経由にする案。IPC 回数が増えるため不採用 |
| 同期は `Mutex<HashMap>` | タブ数が数個〜数十個のスケール。RwLock の最適化メリットなし | `RwLock` や `dashmap` は過剰 |
| Front → Rust の同期を `setPtyId` 呼び出し側に置く | `terminalStore` のピュアさを保つ。非同期副作用をストアから排除 | ストア内ラッパーで同期。副作用とロジックが混ざる |
| タイトル形式を `Claude Code — <name>` 固定 | 従来タイトル `SpecPrompt / Claude Code` から変更するが、UX として発火元が優先情報 | `SpecPrompt / Claude Code [<name>]` など。冗長のため不採用 |
| `set_pty_display_title` が未知の `ptyId` を受け入れる | PTY 登録より先にフロントが呼んでも問題が起きない順序非依存性を確保 | 未登録 ID を拒否する。順序競合のリスクが上がるため不採用 |

## 未解決事項

- [ ] `setPtyId` の呼び出し箇所が `TerminalPanel.tsx` か別の場所か、実コードで最終確認（実装時にコードリーディングで確定）
- [ ] タイトル文字列中に改行・制御文字が混入するルートが現状存在するか確認（Phase 1 時点では `Terminal N` のみなので影響なし、念のため実装時に `sanitize` を軽く入れるか検討）
- [ ] 通知プレビュー用のデバッグコマンド（任意のタブ名で通知発火）を開発補助として追加するか
