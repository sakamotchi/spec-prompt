# 設計書 - Phase 2-E: ファイル操作

## アーキテクチャ

### 対象コンポーネント

```
Frontend (React/TypeScript)
    ↓ invoke("create_file" / "create_dir" / "rename_path" / "delete_path")
Tauri IPC
    ↓
Rust Backend (src-tauri/src/commands/filesystem.rs)
    ↓
ファイルシステム (std::fs)
```

### 影響範囲

- **フロントエンド**: `TreePanel` コンポーネント群、`appStore`（ツリー再読み込み）、`contentStore`（削除・リネーム時のタブ更新）
- **バックエンド（Rust）**: `filesystem.rs` にコマンド 4 件追加、`lib.rs` にコマンド登録追加

---

## 実装方針

### 概要

1. Rust 側に `create_file`, `create_dir`, `rename_path`, `delete_path` の 4 コマンドを追加する
2. フロントエンドは操作完了後にツリーの対象ディレクトリを再読み込みしてツリーを更新する
3. インライン入力は `InlineInput` コンポーネントとして `TreeNode` 内に組み込む
4. 削除確認は `@radix-ui/react-alert-dialog` ベースの `DeleteDialog` コンポーネントを使用する

### ツリー更新戦略

ファイル操作後のツリー更新は以下の流れで行う：

```
コマンド成功
    ↓
操作対象の親ディレクトリを特定
    ↓
appStore.updateDirChildren(parentPath, children) を呼び出す
    ↓（updateDirChildren がない場合は readDir で取得してから呼ぶ）
TreeNode が再レンダリングされてツリーが更新される
```

`file-changed` イベントはコンテンツビューアの自動更新用であり、ツリー更新には使わない。

### インライン入力の表示制御

`TreeNode` に `editingNodePath: string | null` と `creatingIn: { parentPath: string, type: 'file' | 'dir' } | null` を `appStore` に追加し、編集中のノードを全ツリーで一意に管理する。

```
ContextMenu「新規ファイル」クリック
    ↓
appStore.setCreatingIn({ parentPath, type: 'file' })
    ↓
TreeNode が creatingIn を参照して InlineInput を表示
    ↓
Enter → tauriApi.createFile() → ツリー更新 → setCreatingIn(null)
Esc  → setCreatingIn(null)
```

---

## データ構造

### 型定義（TypeScript）

```typescript
// appStore.ts への追加
interface EditingState {
  type: 'rename'
  path: string    // 編集対象のパス
}

interface CreatingState {
  type: 'create'
  parentPath: string
  nodeType: 'file' | 'dir'
}

// AppState へ追加
editingState: EditingState | null
creatingState: CreatingState | null
setEditingState: (state: EditingState | null) => void
setCreatingState: (state: CreatingState | null) => void
```

### 型定義（Rust）

```rust
// filesystem.rs
#[derive(Debug, Serialize, Deserialize)]
pub struct RenameArgs {
    pub old_path: String,
    pub new_path: String,
}
```

---

## API設計

### Tauri コマンド（追加分）

| コマンド名 | 引数 | 戻り値 | 説明 |
|-----------|------|--------|------|
| `create_file` | `path: String` | `Result<(), String>` | 空ファイルを作成 |
| `create_dir` | `path: String` | `Result<(), String>` | ディレクトリを作成 |
| `rename_path` | `old_path: String, new_path: String` | `Result<(), String>` | ファイル/フォルダをリネーム |
| `delete_path` | `path: String` | `Result<(), String>` | ファイル/フォルダを削除（フォルダは再帰削除） |
| `open_in_editor` | `app: AppHandle, path: String` | `Result<(), String>` | OS デフォルトアプリで開く（`tauri-plugin-opener` 使用） |

### Rust 実装イメージ

```rust
// src-tauri/src/commands/filesystem.rs
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
pub fn open_in_editor(app: tauri::AppHandle, path: String) -> Result<(), String> {
    app.opener().open_path(path, None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_file(path: String) -> Result<(), String> {
    if std::path::Path::new(&path).exists() {
        return Err(format!("既に存在します: {}", path));
    }
    std::fs::File::create(&path).map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_dir(path: String) -> Result<(), String> {
    if std::path::Path::new(&path).exists() {
        return Err(format!("既に存在します: {}", path));
    }
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_path(old_path: String, new_path: String) -> Result<(), String> {
    if std::path::Path::new(&new_path).exists() {
        return Err(format!("既に存在します: {}", new_path));
    }
    std::fs::rename(&old_path, &new_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_path(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if p.is_dir() {
        std::fs::remove_dir_all(&path).map_err(|e| e.to_string())
    } else {
        std::fs::remove_file(&path).map_err(|e| e.to_string())
    }
}
```

### tauriApi.ts への追加

```typescript
// src/lib/tauriApi.ts
createFile: (path: string) => invoke<void>('create_file', { path }),
createDir: (path: string) => invoke<void>('create_dir', { path }),
renamePath: (oldPath: string, newPath: string) => invoke<void>('rename_path', { oldPath, newPath }),
deletePath: (path: string) => invoke<void>('delete_path', { path }),
openInEditor: (path: string) => invoke<void>('open_in_editor', { path }),
```

---

## UI設計

### UIライブラリ

| ライブラリ | 用途 | 備考 |
|-----------|------|------|
| `@radix-ui/react-alert-dialog` | 削除確認ダイアログ | 既存 Radix UI と同系列 |
| `lucide-react` | アイコン（FilePlus, FolderPlus, Pencil, Trash2） | tree-shaking対応 |

### カラーパレット

既存の CSS カスタムプロパティを使用する（変更なし）。

削除確認ボタンのみ赤系（`bg-red-600`）を使用する。

### コンポーネント構成

```
TreePanel/
├── TreeNode.tsx（変更: インライン編集対応、F2キー、コンテキストメニュー拡張）
├── InlineInput.tsx（新規）
├── ContextMenu.tsx（変更: メニュー項目追加）
└── DeleteDialog.tsx（新規）
```

#### InlineInput.tsx

```tsx
interface InlineInputProps {
  defaultValue?: string          // リネーム時の初期値
  placeholder?: string           // 新規作成時のプレースホルダ
  depth: number                  // インデント合わせ用
  onCommit: (name: string) => void
  onCancel: () => void
}
```

- `useRef` で `<input>` にフォーカス・全選択
- `onKeyDown`: Enter → `onCommit(value.trim())`, Esc → `onCancel()`
- `onBlur` → `onCancel()`（外クリックでキャンセル）
- 空文字列の Enter は無視する

#### DeleteDialog.tsx

```tsx
interface DeleteDialogProps {
  open: boolean
  path: string
  childCount?: number    // フォルダの場合の子要素数（0以上）
  onConfirm: () => void
  onCancel: () => void
}
```

- `@radix-ui/react-alert-dialog` を使用
- `childCount > 0` の場合「X 件のファイルを含むフォルダを削除します」と警告

### ContextMenu.tsx への追加項目

```
既存:
  パスをターミナルに挿入
  選択中 N 件をすべて挿入（条件付き）

追加（セパレーター後）:
  新規ファイル         FilePlus アイコン
  新規フォルダ         FolderPlus アイコン
  ──────────────
  外部エディタで開く   ExternalLink アイコン
  ──────────────
  リネーム             Pencil アイコン
  削除                 Trash2 アイコン（赤色テキスト）
```

---

## 状態管理

### appStore.ts の変更

```typescript
// 追加するフィールド
editingState: EditingState | null   // リネーム中のノード
creatingState: CreatingState | null // 新規作成中の状態

// 追加するアクション
setEditingState: (state: EditingState | null) => void
setCreatingState: (state: CreatingState | null) => void
```

`editingState` / `creatingState` は persist 対象外（画面リロード時にリセット）。

### contentStore との連携

- **削除時**: `contentStore.closeTab` をファイルパスで呼び出してタブを閉じる
- **リネーム時**: `contentStore` の全タブを走査し、一致する `path` を新パスに更新する（`renameTabPath` アクションを追加）

---

## テストコード

### appStore テスト

```typescript
describe('appStore file operation state', () => {
  it('setCreatingState で creatingState が更新される', () => {
    const { setCreatingState } = useAppStore.getState()
    setCreatingState({ type: 'create', parentPath: '/foo', nodeType: 'file' })
    expect(useAppStore.getState().creatingState?.parentPath).toBe('/foo')
  })

  it('setEditingState(null) でリセットされる', () => {
    const { setEditingState } = useAppStore.getState()
    setEditingState({ type: 'rename', path: '/foo/bar.md' })
    setEditingState(null)
    expect(useAppStore.getState().editingState).toBeNull()
  })
})
```

### Rust テスト

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_create_file() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("test.md").to_string_lossy().to_string();
        assert!(create_file(path.clone()).is_ok());
        assert!(fs::metadata(&path).unwrap().is_file());
    }

    #[test]
    fn test_create_file_already_exists() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("test.md").to_string_lossy().to_string();
        fs::File::create(&path).unwrap();
        assert!(create_file(path).is_err());
    }

    #[test]
    fn test_rename_path() {
        let dir = tempdir().unwrap();
        let old = dir.path().join("old.md").to_string_lossy().to_string();
        let new = dir.path().join("new.md").to_string_lossy().to_string();
        fs::File::create(&old).unwrap();
        assert!(rename_path(old.clone(), new.clone()).is_ok());
        assert!(!fs::metadata(&old).is_ok());
        assert!(fs::metadata(&new).unwrap().is_file());
    }

    #[test]
    fn test_delete_path_file() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("del.md").to_string_lossy().to_string();
        fs::File::create(&path).unwrap();
        assert!(delete_path(path.clone()).is_ok());
        assert!(!fs::metadata(&path).is_ok());
    }
}
```

---

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| `editingState` / `creatingState` を appStore で管理 | ツリー全体で一度に1つしか編集できないため、グローバル管理が適切 | 各 TreeNode のローカル state で管理（複数同時編集の懸念） |
| フォルダ削除は `remove_dir_all`（再帰削除） | UX 上、空でないフォルダも削除できる方が自然。確認ダイアログで警告する | 空フォルダのみ削除（`remove_dir`）を強制 |
| ツリー更新はコマンド成功後に明示的 readDir | `file-changed` はコンテンツビューア専用のため混在を避ける | `file-changed` をツリー更新にも流用 |
| `onBlur` でキャンセル | フォーカスが外れた場合に入力状態が残るのを防ぐ | Enter/Escのみでキャンセル |

## 未解決事項

- [ ] `tempfile` クレートが Cargo.toml の dev-dependencies に含まれているか確認
- [ ] `capabilities/default.json` に `fs:write-all` が含まれているか確認（Phase 2-D 以前に設定済みの可能性あり）
- [ ] `capabilities/default.json` に `opener:default` が含まれているか確認（`tauri-plugin-opener` の権限）
