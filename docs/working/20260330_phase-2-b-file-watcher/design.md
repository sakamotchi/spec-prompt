# 設計書 - Phase 2-B: ファイル監視・自動更新

## アーキテクチャ

### データフロー

```
[ユーザーがプロジェクトを開く]
    │ setProjectRoot(path) → invoke('watch_fs', { path })
    ▼
Rust: watcher.rs が tauri-plugin-fs で監視開始
    │
    ▼ ファイル変更を検知
Rust → Frontend: Tauri Event "file-changed" { path: string }
    │
    ├── appStore が受信
    │   └── 変更パスがツリー内のパス → read_dir() を再呼び出し → fileTree 更新
    │
    └── ContentView が受信
        └── contentStore.filePath === path → read_file() を再呼び出し → content 更新
```

### 影響範囲

- **フロントエンド**: `appStore.ts`（監視開始 + ツリー更新）、`ContentView.tsx`（コンテンツ更新）
- **バックエンド（Rust）**: `watcher.rs`（新規）、`filesystem.rs`（`watch_fs` コマンド追加）、`lib.rs`（コマンド登録）

---

## 実装方針

### バックエンド（Rust）

`tauri-plugin-fs` の `watch` API を使って、指定ディレクトリを再帰的に監視する。変更イベントを受け取ったら `file-changed` Tauri イベントをフロントエンドに emit する。

除外ディレクトリ（`node_modules`, `.git`, `target` 等）のパスを含む変更は無視する。

### フロントエンド

**監視開始**: `appStore.setProjectRoot` 内で `invoke('watch_fs', { path })` を呼び出す。

**コンテンツ更新**: `ContentView.tsx` で `listen('file-changed', ...)` を登録し、`contentStore.filePath` と一致する場合に `read_file` を再呼び出す。

**ツリー更新**: `appStore` で `listen('file-changed', ...)` を登録し、`projectRoot` が設定されていれば `read_dir` を再呼び出して `fileTree` を更新する。

---

## データ構造

### Rust: `watcher.rs`

```rust
use tauri::{AppHandle, Emitter};
use tauri_plugin_fs::FsExt;

const IGNORE_DIRS: &[&str] = &["node_modules", ".git", "target", ".tauri", "dist"];

pub fn start_watching(app: AppHandle, path: String) -> Result<(), String> {
    let path_clone = path.clone();
    app.fs().watch(
        &path,
        tauri_plugin_fs::WatchOptions {
            recursive: Some(true),
            delay_ms: Some(300), // デバウンス 300ms
        },
        move |event| {
            // 除外ディレクトリのチェック
            let changed_path = event.paths.first()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();

            if IGNORE_DIRS.iter().any(|d| changed_path.contains(d)) {
                return;
            }

            let _ = app.emit("file-changed", serde_json::json!({ "path": changed_path }));
        },
    ).map_err(|e| e.to_string())
}
```

### Rust: `filesystem.rs` への追加

```rust
#[tauri::command]
pub fn watch_fs(app: tauri::AppHandle, path: String) -> Result<(), String> {
    crate::watcher::start_watching(app, path)
}
```

### TypeScript: `file-changed` イベントペイロード

```typescript
interface FileChangedPayload {
  path: string
}
```

---

## API設計

### Tauriコマンド（新規追加）

| コマンド名 | 引数 | 戻り値 | 説明 |
|-----------|------|--------|------|
| `watch_fs` | `{ path: string }` | `Result<(), String>` | 指定ディレクトリの監視を開始する |

### Tauriイベント（既存定義・新規実装）

| イベント名 | ペイロード | 説明 |
|-----------|-----------|------|
| `file-changed` | `{ path: string }` | ファイル変更検知をフロントエンドに通知 |

---

## UI設計

UI の変化はなし。バックグラウンドで自動更新されるのみ。

---

## 状態管理

### `appStore.ts` の変更

```typescript
// setProjectRoot に watch_fs 呼び出しを追加
setProjectRoot: async (path) => {
  set({ projectRoot: path })
  // ファイルツリー取得
  const tree = await invoke<FileNode[]>('read_dir', { path })
  set({ fileTree: tree })
  // 監視開始
  await invoke('watch_fs', { path }).catch(console.error)
  // file-changed イベントでツリー再取得
  listen<{ path: string }>('file-changed', async () => {
    const updated = await invoke<FileNode[]>('read_dir', { path })
    set({ fileTree: updated })
  })
},
```

### `ContentView.tsx` の変更

```typescript
// file-changed イベントでコンテンツ再読み込み
useEffect(() => {
  const unlisten = listen<{ path: string }>('file-changed', ({ payload }) => {
    if (payload.path === filePath) {
      invoke<string>('read_file', { path: filePath })
        .then((text) => setFile(filePath, text, viewMode))
        .catch(console.error)
    }
  })
  return () => { unlisten.then((fn) => fn()) }
}, [filePath, viewMode, setFile])
```

---

## テストコード

```rust
// src-tauri/src/watcher.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_should_ignore_node_modules() {
        let path = "/project/node_modules/foo/bar.js";
        assert!(IGNORE_DIRS.iter().any(|d| path.contains(d)));
    }

    #[test]
    fn test_should_not_ignore_src() {
        let path = "/project/src/main.ts";
        assert!(!IGNORE_DIRS.iter().any(|d| path.contains(d)));
    }
}
```

---

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| デバウンス 300ms | macOS FSEvents の短時間バースト対応 | デバウンスなし（大量イベントでパフォーマンス劣化） |
| `node_modules` 等をバックエンドで除外 | フロントエンドに余分なイベントを送らない | フロントエンド側でフィルタリング（通信コスト増） |
| ツリー再取得は `read_dir` 全体を再呼び出し | シンプルな実装、差分検出不要 | 差分更新（複雑だが高速） |
| 監視開始を `setProjectRoot` に内包 | プロジェクトを開いたら自動で監視が始まる UX | 別コマンドで明示的に開始（操作が増える） |

## 未解決事項

- [ ] `tauri-plugin-fs` の `watch` API の正確なシグネチャ確認（v2 のドキュメント参照）
- [ ] 監視の停止処理（プロジェクト切り替え時に前の監視を止める必要があるか）
