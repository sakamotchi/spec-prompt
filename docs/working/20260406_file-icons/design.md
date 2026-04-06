# 設計書 - Phase 3-D: 拡張子別ファイルアイコン

**フェーズ**: 3-D
**作成日**: 2026年4月6日
**ステータス**: 作成中

---

## 1. 実装方針

### 1.1 ライブラリ選定

| ライブラリ | 役割 |
|-----------|------|
| `@iconify/react` | React コンポーネントとしてアイコンを描画 |
| `@iconify-json/vscode-icons` | VSCode 風アイコンデータ（オフラインバンドル） |

`@iconify/react` はオンデマンドロード（CDN）とオフラインバンドルの両方に対応している。Tauri はネットワーク接続が不要なオフライン環境での利用を想定するため、`@iconify-json/vscode-icons` をローカルにバンドルして使用する。

### 1.2 変更範囲

変更するファイルは `TreeNode.tsx` の `FileIcon` コンポーネントのみ。他のコンポーネントへの影響はない。

---

## 2. 実装詳細

### 2.1 パッケージインストール

```bash
npm install @iconify/react @iconify-json/vscode-icons
```

### 2.2 拡張子→アイコンIDマッピング

`TreeNode.tsx` 内に定数として定義する。

```ts
// 拡張子（ドットなし小文字）→ Iconify アイコン ID
const EXT_ICON_MAP: Record<string, string> = {
  md:   'vscode-icons:file-type-markdown',
  mdx:  'vscode-icons:file-type-markdown',
  ts:   'vscode-icons:file-type-typescript',
  tsx:  'vscode-icons:file-type-reactts',
  js:   'vscode-icons:file-type-js',
  jsx:  'vscode-icons:file-type-reactjs',
  rs:   'vscode-icons:file-type-rust',
  py:   'vscode-icons:file-type-python',
  go:   'vscode-icons:file-type-go',
  json: 'vscode-icons:file-type-json',
  toml: 'vscode-icons:file-type-toml',
  yaml: 'vscode-icons:file-type-yaml',
  yml:  'vscode-icons:file-type-yaml',
  css:  'vscode-icons:file-type-css',
  html: 'vscode-icons:file-type-html',
  sql:  'vscode-icons:file-type-sql',
  txt:  'vscode-icons:file-type-text',
}

const FOLDER_ICON     = 'vscode-icons:default-folder'
const FOLDER_OPEN_ICON = 'vscode-icons:default-folder-opened'
const DEFAULT_FILE_ICON = 'vscode-icons:default-file'
```

### 2.3 FileIcon コンポーネントの変更

```tsx
// Before（Lucide React）
const FileIcon = () => {
  if (node.is_dir) {
    if (isLoadingChildren)
      return <Loader2 size={14} className="shrink-0 animate-spin text-[var(--color-text-muted)]" />
    return isExpanded
      ? <FolderOpen size={14} className="shrink-0 text-[var(--color-accent)]" />
      : <Folder size={14} className="shrink-0 text-[var(--color-text-muted)]" />
  }
  const isText = /\.(md|mdx|txt|...)$/.test(node.name)
  return isText
    ? <FileText size={14} className="shrink-0 text-[var(--color-text-muted)]" />
    : <File size={14} className="shrink-0 text-[var(--color-text-muted)]" />
}

// After（@iconify/react + vscode-icons）
import { Icon } from '@iconify/react'

const FileIcon = () => {
  if (node.is_dir) {
    if (isLoadingChildren)
      return <Loader2 size={14} className="shrink-0 animate-spin text-[var(--color-text-muted)]" />
    return (
      <Icon
        icon={isExpanded ? FOLDER_OPEN_ICON : FOLDER_ICON}
        width={14}
        height={14}
        className="shrink-0"
      />
    )
  }
  const ext = node.name.split('.').pop()?.toLowerCase() ?? ''
  const iconId = EXT_ICON_MAP[ext] ?? DEFAULT_FILE_ICON
  return <Icon icon={iconId} width={14} height={14} className="shrink-0" />
}
```

### 2.4 Lucide アイコンの削除

`FileIcon` が Lucide に依存しなくなるため、以下のインポートを削除する（`Loader2` は残す）：

```ts
// 削除
import { Folder, FolderOpen, FileText, File } from 'lucide-react'
// 残す
import { ChevronRight, ChevronDown, Loader2 } from 'lucide-react'
```

---

## 3. バンドルサイズへの考慮

`@iconify-json/vscode-icons` は全アイコンデータを含む大きなパッケージ（数MB）。ただし Vite のツリーシェイキングにより、`EXT_ICON_MAP` で参照したアイコンのみがバンドルに含まれる。

使用アイコン数は約18個に限定されているため、実際の増加は数十KB程度に収まる見込み。

---

## 4. 変更ファイル一覧

| ファイル | 変更種別 | 内容 |
|---------|---------|------|
| `package.json` | 変更 | `@iconify/react`, `@iconify-json/vscode-icons` を追加 |
| `src/components/TreePanel/TreeNode.tsx` | 変更 | `FileIcon` を Iconify 版に置き換え |
