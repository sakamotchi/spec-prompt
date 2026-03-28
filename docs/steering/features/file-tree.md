# プロジェクトツリー機能仕様書

**バージョン**: 1.0
**作成日**: 2026年3月28日
**最終更新**: 2026年3月28日

---

## 1. 概要

プロジェクトツリーは、開いているプロジェクトのファイル・フォルダ構成を左ペインに階層表示します。ファイルをクリックするとコンテンツビューアに内容が表示されます。

**機能ID**: FR-01

---

## 2. 機能要件

### 2.1 ツリー表示

| 要件ID | 要件 | 詳細 |
|--------|------|------|
| FT-01 | ファイルツリー表示 | プロジェクトルート配下のファイル・フォルダを再帰的に取得して階層表示する |
| FT-02 | ソート | ディレクトリを先に表示し、その後ファイルをアルファベット順で表示する |
| FT-03 | 除外設定 | すべてのファイル・フォルダを表示する（除外なし） |
| FT-04 | アイコン | ファイルとディレクトリを異なるアイコンで視覚的に区別する |
| FT-05 | インデント | 階層の深さに応じてインデントを表示する |

### 2.2 インタラクション

| 要件ID | 要件 | 詳細 |
|--------|------|------|
| FT-06 | 展開/折りたたみ | ディレクトリをクリックで展開・折りたたみを切り替える |
| FT-07 | ファイル選択 | ファイルをクリックすると `selectedFile` が更新され、コンテンツビューアに表示される |
| FT-08 | 選択状態ハイライト | 選択中のファイルを視覚的にハイライトする |

### 2.3 プロジェクト操作

| 要件ID | 要件 | 詳細 |
|--------|------|------|
| FT-09 | プロジェクトを開く | フォルダ選択ダイアログでプロジェクトを指定し、ツリーを更新する |
| FT-10 | 最近開いたプロジェクト | 設定ファイルから最近開いたプロジェクト一覧を表示し、再オープンできる |

### 2.4 ファイル操作（Phase 2以降）

| 要件ID | 要件 | 詳細 |
|--------|------|------|
| FT-11 | ファイル新規作成 | 右クリックメニュー → 「新規ファイル」 |
| FT-12 | フォルダ新規作成 | 右クリックメニュー → 「新規フォルダ」 |
| FT-13 | リネーム | 右クリックメニュー → 「名前を変更」でインライン編集 |
| FT-14 | 削除 | 右クリックメニュー → 「削除」で確認ダイアログ後に削除 |

### 2.5 パス挿入連携

| 要件ID | 要件 | 詳細 |
|--------|------|------|
| FT-15 | Ctrl+クリック挿入 | ファイルをCtrl+クリックするとアクティブなターミナルにパスを挿入する |
| FT-16 | 右クリックメニュー挿入 | 「パスをターミナルに挿入」メニュー項目からパスを挿入する |
| FT-17 | 複数選択一括挿入 | 複数ファイルを選択した状態で一括挿入できる |

---

## 3. 技術仕様

### 3.1 フロントエンド

**コンポーネント**: `src/components/TreePanel/`

**カスタムフック**: `src/hooks/useFileTree.ts`

```typescript
// ファイルツリーを取得・管理するカスタムフック
function useFileTree(rootPath: string | null) {
  // invoke("read_dir", { path: rootPath }) でツリー取得
  // expandedDirs: Set<string> で展開状態管理
  // selectedFile: string | null で選択ファイル管理
}
```

### 3.2 バックエンド

**モジュール**: `src-tauri/src/commands/filesystem.rs`

**データ構造**:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileNode>>,
}
```

**Tauriコマンド**:

| コマンド名 | 引数 | 戻り値 | 説明 |
|-----------|------|--------|------|
| `read_dir` | `path: String` | `Result<Vec<FileNode>, String>` | ディレクトリを再帰取得してツリー構造で返す |
| `read_file` | `path: String` | `Result<String, String>` | ファイル内容を文字列で返す |

**除外ロジック**:

```rust
const EXCLUDED_DIRS: &[&str] = &["node_modules", ".git", "target", "dist"];

fn is_excluded(name: &str) -> bool {
    name.starts_with('.') || EXCLUDED_DIRS.contains(&name)
}
```

### 3.3 状態管理

**ストア**: `src/stores/appStore.ts`

```typescript
interface AppState {
  projectRoot: string | null
  fileTree: FileNode[]
  selectedFile: string | null
  expandedDirs: Set<string>
  recentProjects: string[]
}
```

---

## 4. パフォーマンス考慮事項

- 大量ファイル時は `@tanstack/react-virtual` による仮想スクロールを導入する（Phase 2以降）
- `read_dir` は初回表示時に1回呼び出し、以降はファイル監視イベントで差分更新
- ツリーデータはシリアライズ可能なため、Zustand persist でセッション間保持も検討

---

## 変更履歴

| 日付 | バージョン | 変更内容 | 作成者 |
|------|----------|---------|--------|
| 2026-03-28 | 1.0 | 初版作成 | - |
