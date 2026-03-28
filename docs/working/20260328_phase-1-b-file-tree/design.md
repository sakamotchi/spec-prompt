# 設計書 - Phase 1-B: ファイルツリー（TreePanel）

## アーキテクチャ

### 対象コンポーネント

```
Frontend (React/TypeScript)
  AppLayout
    └── SplitPane（左ペイン）
          └── TreePanel               src/components/TreePanel/TreePanel.tsx
                ├── ヘッダー（プロジェクトを開くボタン）
                └── TreeNode（再帰）  src/components/TreePanel/TreeNode.tsx

  src/hooks/useFileTree.ts            read_dir 呼び出し・展開状態管理
  src/stores/appStore.ts              projectRoot / fileTree / selectedFile / expandedDirs 追加

    ↓ invoke("read_dir") / openDialog
Tauri IPC
    ↓
Rust Backend
  src-tauri/src/commands/filesystem.rs  read_dir（実装済み、dist 除外を追加）
  @tauri-apps/plugin-dialog             フォルダ選択ダイアログ
```

### 影響範囲

- **フロントエンド**: `appStore.ts`, `hooks/useFileTree.ts`, `TreePanel/`, `Layout/AppLayout.tsx`, `lib/tauriApi.ts`
- **バックエンド（Rust）**: `filesystem.rs`（`dist` 除外追加のみ）

---

## 実装方針

### 概要

Rust 側の `read_dir` は既に完成に近い状態（`dist` 除外が漏れているのみ）。フロントエンド側の実装が主な作業。`TreePanel` は再帰コンポーネント（`TreeNode`）で構成し、展開状態を `appStore.expandedDirs` で管理する。

### 詳細

1. **`filesystem.rs` 補完**: 除外リストに `"dist"` を追加する（1行変更）。

2. **`appStore` 拡張**: `projectRoot`, `fileTree`, `selectedFile`, `expandedDirs` を追加。Phase 1-A で先行実装した `activeMainTab` と同じファイルに統合する。

3. **`useFileTree` フック**: `projectRoot` が変わるたびに `tauriApi.readDir()` を呼び出し、`fileTree` を更新する。ローディング状態・エラー状態も管理する。

4. **`TreeNode` コンポーネント**: `FileNode` を受け取り、ディレクトリなら子を再帰レンダリングする。`React.memo` でラップして不要な再レンダリングを防ぐ。

5. **`TreePanel` コンポーネント**: ヘッダー（プロジェクト名 + 「開く」ボタン）と `TreeNode` のリストを表示。`@tauri-apps/plugin-dialog` の `open()` でフォルダ選択。

6. **`AppLayout` 更新**: プレースホルダーを `TreePanel` コンポーネントに置き換える。

---

## データ構造

### 型定義（TypeScript）

```typescript
// src/lib/tauriApi.ts（既存、変更なし）
export interface FileNode {
  name: string
  path: string
  is_dir: boolean
  children?: FileNode[]
}
```

```typescript
// src/stores/appStore.ts（追加分）
interface AppState {
  // Phase 1-A から存在
  activeMainTab: MainTab
  setActiveMainTab: (tab: MainTab) => void

  // Phase 1-B で追加
  projectRoot: string | null
  fileTree: FileNode[]
  selectedFile: string | null
  expandedDirs: Set<string>
  setProjectRoot: (root: string) => void
  setFileTree: (tree: FileNode[]) => void
  setSelectedFile: (path: string | null) => void
  toggleExpandedDir: (path: string) => void
}
```

### 型定義（Rust）

```rust
// src-tauri/src/commands/filesystem.rs（既存、変更なし）
#[derive(Serialize, Clone)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileNode>>,
}
```

---

## API設計

### Tauriコマンド

| コマンド名 | 引数 | 戻り値 | 説明 |
|-----------|------|--------|------|
| `read_dir` | `path: String` | `Result<Vec<FileNode>, String>` | 実装済み。除外リストに `dist` を追加 |

### Tauriイベント

Phase 1-B では Tauri イベントを使用しない。（ファイル監視は Phase 2-B）

### フォルダ選択ダイアログ

```typescript
// src/lib/tauriApi.ts に追加
import { open } from '@tauri-apps/plugin-dialog'

openFolderDialog: (): Promise<string | null> =>
  open({ directory: true, multiple: false }).then((result) =>
    typeof result === 'string' ? result : null
  ),
```

---

## UI設計

### UIライブラリ

| ライブラリ | 用途 |
|-----------|------|
| `lucide-react` | ファイル・フォルダ・矢印アイコン（既存） |

使用アイコン：
- `Folder` / `FolderOpen` — ディレクトリ
- `FileText` — テキスト・MD ファイル
- `File` — その他のファイル
- `ChevronRight` / `ChevronDown` — 展開/折りたたみ矢印
- `FolderOpen`（ヘッダー） — 「開く」ボタン

### カラーパレット

`src/index.css` で定義済みの CSS カスタムプロパティを使用：
- ツリーパネル背景: `--color-bg-panel`
- ホバー: `--color-bg-elevated`
- 選択ハイライト: `--color-bg-elevated` + 左ボーダー `--color-accent`
- テキスト（通常）: `--color-text-primary`
- テキスト（ミュート）: `--color-text-muted`

### 画面構成

```
┌──────────────────────┐
│ 📁 プロジェクト名  [⊕] │  ← ヘッダー（開くボタン）
├──────────────────────┤
│ ▼ 📁 docs            │  ← 展開済みディレクトリ
│   📄 01_要件.md       │  ← 通常ファイル
│ ▶ 📁 src             │  ← 折りたたまれたディレクトリ
│ ▼ 📁 src-tauri       │
│   ▶ 📁 src           │
└──────────────────────┘
```

- 行高さ: 28px
- インデント: 階層ごとに 16px
- 選択行: 左 2px アクセントカラーボーダー + `--color-bg-elevated` 背景

### コンポーネント構成

```
TreePanel
  ├── TreePanelHeader（プロジェクト名 + 「開く」ボタン）
  └── div.overflow-y-auto（スクロールエリア）
        └── TreeNode（再帰）
              ├── ディレクトリ行（クリック → toggleExpandedDir）
              │     ├── ChevronRight/Down + FolderOpen アイコン + 名前
              │     └── 展開時: 子 TreeNode を再帰レンダリング
              └── ファイル行（クリック → setSelectedFile）
                    └── FileText/File アイコン + 名前
```

---

## 状態管理

### Zustandストア変更

```typescript
// src/stores/appStore.ts（Phase 1-B 追加分）
import { create } from 'zustand'
import type { FileNode } from '../lib/tauriApi'

type MainTab = 'content' | 'terminal'

interface AppState {
  activeMainTab: MainTab
  setActiveMainTab: (tab: MainTab) => void
  projectRoot: string | null
  fileTree: FileNode[]
  selectedFile: string | null
  expandedDirs: Set<string>
  setProjectRoot: (root: string) => void
  setFileTree: (tree: FileNode[]) => void
  setSelectedFile: (path: string | null) => void
  toggleExpandedDir: (path: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeMainTab: 'content',
  setActiveMainTab: (tab) => set({ activeMainTab: tab }),
  projectRoot: null,
  fileTree: [],
  selectedFile: null,
  expandedDirs: new Set<string>(),
  setProjectRoot: (root) => set({ projectRoot: root }),
  setFileTree: (tree) => set({ fileTree: tree }),
  setSelectedFile: (path) => set({ selectedFile: path }),
  toggleExpandedDir: (path) =>
    set((state) => {
      const next = new Set(state.expandedDirs)
      next.has(path) ? next.delete(path) : next.add(path)
      return { expandedDirs: next }
    }),
}))
```

### useFileTree フック

```typescript
// src/hooks/useFileTree.ts
import { useEffect, useState } from 'react'
import { tauriApi } from '../lib/tauriApi'
import { useAppStore } from '../stores/appStore'

export function useFileTree() {
  const projectRoot = useAppStore((s) => s.projectRoot)
  const setFileTree = useAppStore((s) => s.setFileTree)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectRoot) return
    setLoading(true)
    setError(null)
    tauriApi
      .readDir(projectRoot)
      .then(setFileTree)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [projectRoot, setFileTree])

  return { loading, error }
}
```

---

## テストコード

### Rustテスト例

```rust
// src-tauri/src/commands/filesystem.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_excluded_hidden_file() {
        // 隠しファイルが除外されることを確認
        // is_excluded(".git") => true
    }

    #[test]
    fn test_is_excluded_node_modules() {
        // node_modules が除外されることを確認
    }
}
```

### Reactコンポーネントテスト例

```typescript
// src/stores/appStore.test.ts（追加）
it('toggleExpandedDir でディレクトリの展開状態が切り替わる', () => {
  useAppStore.setState({ expandedDirs: new Set() })
  useAppStore.getState().toggleExpandedDir('/project/src')
  expect(useAppStore.getState().expandedDirs.has('/project/src')).toBe(true)
  useAppStore.getState().toggleExpandedDir('/project/src')
  expect(useAppStore.getState().expandedDirs.has('/project/src')).toBe(false)
})
```

---

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| `expandedDirs` を `Set<string>` で管理 | パスを key にした O(1) の存在確認が可能。Zustand の `set` で新しい Set を生成してイミュータブルに更新 | `Record<string, boolean>` で管理する |
| `TreeNode` を `React.memo` でラップ | ツリーが深い場合に無関係ノードの再レンダリングを防ぐ | memo なしで実装する |
| フォルダ選択に `@tauri-apps/plugin-dialog` を使用 | Tauri v2 公式プラグイン。ネイティブダイアログが使えてUXが良い | `window.prompt()` や自前実装 |
| `read_dir` はプロジェクト全体を一括取得 | Phase 1 のスコープでは十分。大規模プロジェクト対応は Phase 3-D で遅延読み込みを検討 | ディレクトリ展開時に都度取得する |

## 未解決事項

- [ ] `@tauri-apps/plugin-dialog` の npm パッケージ名と `lib.rs` への登録方法を確認（`tauri-plugin-dialog`）
- [ ] `expandedDirs`（`Set`）は Zustand persist middleware でシリアライズできないため、セッション間の永続化は Phase 1-D で検討
