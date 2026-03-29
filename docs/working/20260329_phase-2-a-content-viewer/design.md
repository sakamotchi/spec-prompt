# 設計書 - Phase 2-A: コンテンツビューア

## アーキテクチャ

### 対象コンポーネント

```
appStore.selectedFile が変化
    │
    ▼
ContentView（新規）
    │ invoke('read_file', { path })
    ▼
Tauri IPC
    │
    ▼
Rust: filesystem.rs#read_file（実装済み）
    │ Result<String, String>
    ▼
ContentView が contentStore へ保存
    │
    ▼ 表示モード判定（拡張子）
    ├── 'markdown' → MarkdownPreview（unified + Shiki + Mermaid）
    ├── 'code'     → CodeViewer（Shiki）
    └── 'plain'    → PlainTextViewer
```

### 影響範囲

- **フロントエンド**: `ContentView/`（新規）、`stores/contentStore.ts`（新規）、`lib/markdown.ts`（新規）、`MainArea.tsx`（contentNode 差し替え）
- **バックエンド（Rust）**: 変更なし（`read_file` は実装済み）

---

## 実装方針

### 概要

`appStore.selectedFile` の変化を `useEffect` で監視し、`read_file` コマンドでファイル内容を取得して `contentStore` に保存する。表示は拡張子で判定した `viewMode` に応じてコンポーネントを切り替える。

### 詳細

1. `contentStore.ts` を作成し、`content`・`filePath`・`viewMode`・`isLoading` を管理する
2. `ContentView.tsx` で `appStore.selectedFile` を監視し、変化時に `read_file` を呼び出す
3. `markdown.ts` に unified パイプラインを定義する
4. `MarkdownPreview.tsx` でパイプラインを適用し、生成 HTML を `dangerouslySetInnerHTML` で表示
5. Mermaid は `useEffect` 内で動的インポートして別途レンダリング
6. `CodeViewer.tsx` で Shiki を使ってハイライト済み HTML を生成・表示
7. `PlainTextViewer.tsx` でプレーンテキストを等幅フォントで表示
8. `MainArea.tsx` の `contentNode` を `<ContentView />` に差し替える

---

## データ構造

### 型定義（TypeScript）

```typescript
// src/stores/contentStore.ts

type ViewMode = 'markdown' | 'code' | 'plain'

interface ContentState {
  filePath: string | null
  content: string | null
  viewMode: ViewMode
  isLoading: boolean
  setFile: (filePath: string, content: string, viewMode: ViewMode) => void
  setLoading: (loading: boolean) => void
  clear: () => void
}
```

### 表示モード判定

```typescript
// src/lib/viewMode.ts または contentStore.ts 内ユーティリティ

const MARKDOWN_EXTS = new Set(['md', 'mdx'])
const CODE_EXTS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'rs', 'py', 'go',
  'java', 'c', 'cpp', 'h', 'cs', 'rb', 'php',
  'json', 'toml', 'yaml', 'yml', 'css', 'scss',
  'html', 'xml', 'sql', 'sh', 'bash', 'zsh',
])

export function getViewMode(filePath: string): ViewMode {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  if (MARKDOWN_EXTS.has(ext)) return 'markdown'
  if (CODE_EXTS.has(ext)) return 'code'
  return 'plain'
}
```

---

## API設計

### Tauriコマンド（既存・変更なし）

| コマンド名 | 引数 | 戻り値 | 説明 |
|-----------|------|--------|------|
| `read_file` | `{ path: string }` | `Result<String, String>` | ファイル内容を文字列で返す（実装済み） |

---

## UI設計

### UIライブラリ

| ライブラリ | 用途 |
|-----------|------|
| `unified` + `remark-parse` + `remark-gfm` + `remark-rehype` + `rehype-stringify` | MD → HTML パイプライン |
| `@shikijs/rehype` | MD内コードブロックのシンタックスハイライト |
| `shiki` | CodeViewer の直接ハイライト |
| `mermaid`（動的インポート） | Mermaid 図のレンダリング |

### カラーパレット

- コンテンツ背景: `--color-bg-base`
- マークダウン本文: `--color-text-primary`
- コードブロック背景: `--color-bg-elevated`
- ファイル未選択時のプレースホルダー文字: `--color-text-muted`

### 画面構成

**ファイル未選択時:**
```
┌─────────────────────────────────────────┐
│                                         │
│    ファイルを選択してください            │
│    （--color-text-muted で中央表示）     │
│                                         │
└─────────────────────────────────────────┘
```

**マークダウンプレビュー:**
```
┌─────────────────────────────────────────┐
│ # 要件定義書                            │
│                                         │
│ ## 1. 概要                              │
│ 生成AIを用いた...                       │
│                                         │
│ | 列1 | 列2 |                           │
│ |-----|-----|                           │
│ | A   | B   |                           │
│                                         │
│ ```mermaid                              │
│ [SVGレンダリング済み図]                  │
│ ```                                     │
└─────────────────────────────────────────┘
```

**コードビューア:**
```
┌─────────────────────────────────────────┐
│  1  │ import { useState } from 'react'  │
│  2  │                                   │
│  3  │ export function App() {           │
│  4  │   const [count, setCount] = ...   │
└─────────────────────────────────────────┘
```

### コンポーネント構成

```
ContentView.tsx
├── (ファイル未選択) → プレースホルダー表示
├── isLoading → ローディングインジケーター（任意）
├── viewMode === 'markdown' → <MarkdownPreview content={content} />
├── viewMode === 'code'     → <CodeViewer content={content} filePath={filePath} />
└── viewMode === 'plain'    → <PlainTextViewer content={content} />
```

---

## 状態管理

### Zustandストア変更

```typescript
// src/stores/contentStore.ts（新規作成）
import { create } from 'zustand'
import { getViewMode } from '../lib/viewMode'

export const useContentStore = create<ContentState>((set) => ({
  filePath: null,
  content: null,
  viewMode: 'plain',
  isLoading: false,
  setFile: (filePath, content, viewMode) => set({ filePath, content, viewMode, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  clear: () => set({ filePath: null, content: null, viewMode: 'plain', isLoading: false }),
}))
```

### ContentView でのファイル読み込み

```typescript
// src/components/ContentView/ContentView.tsx

import { useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useAppStore } from '../../stores/appStore'
import { useContentStore } from '../../stores/contentStore'
import { getViewMode } from '../../lib/viewMode'

export function ContentView() {
  const selectedFile = useAppStore((s) => s.selectedFile)
  const { filePath, content, viewMode, setFile, setLoading } = useContentStore()

  useEffect(() => {
    if (!selectedFile) return
    if (selectedFile === filePath) return // 同じファイルは再読み込みしない

    setLoading(true)
    invoke<string>('read_file', { path: selectedFile })
      .then((text) => {
        setFile(selectedFile, text, getViewMode(selectedFile))
      })
      .catch((err) => {
        console.error('read_file failed:', err)
        setLoading(false)
      })
  }, [selectedFile])

  if (!selectedFile || content === null) {
    return (
      <div className="flex items-center justify-center h-full text-sm"
        style={{ color: 'var(--color-text-muted)' }}>
        ファイルを選択してください
      </div>
    )
  }

  if (viewMode === 'markdown') return <MarkdownPreview content={content} />
  if (viewMode === 'code') return <CodeViewer content={content} filePath={filePath!} />
  return <PlainTextViewer content={content} />
}
```

---

## unified パイプライン設計

```typescript
// src/lib/markdown.ts

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeShiki from '@shikijs/rehype'
import rehypeStringify from 'rehype-stringify'

export async function renderMarkdown(content: string): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeShiki, { theme: 'github-dark' })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(content)
  return String(result)
}
```

### Mermaid レンダリング

`MarkdownPreview` が生成した HTML 内の `<pre class="language-mermaid">` を検出し、Mermaid を動的インポートして SVG に差し替える。

```typescript
useEffect(() => {
  const els = containerRef.current?.querySelectorAll('pre.language-mermaid')
  if (!els?.length) return

  import('mermaid').then(({ default: mermaid }) => {
    mermaid.initialize({ startOnLoad: false, theme: 'dark' })
    els.forEach(async (el) => {
      const code = el.textContent ?? ''
      const { svg } = await mermaid.render(`mermaid-${Date.now()}`, code)
      el.innerHTML = svg
    })
  })
}, [html])
```

---

## テストコード

```typescript
// src/components/ContentView/__tests__/ContentView.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContentView } from '../ContentView'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

describe('ContentView', () => {
  it('ファイル未選択時にプレースホルダーを表示する', () => {
    render(<ContentView />)
    expect(screen.getByText('ファイルを選択してください')).toBeInTheDocument()
  })
})
```

```typescript
// src/lib/__tests__/viewMode.test.ts
import { describe, it, expect } from 'vitest'
import { getViewMode } from '../viewMode'

describe('getViewMode', () => {
  it('md → markdown', () => expect(getViewMode('foo.md')).toBe('markdown'))
  it('ts → code', () => expect(getViewMode('bar.ts')).toBe('code'))
  it('txt → plain', () => expect(getViewMode('baz.txt')).toBe('plain'))
})
```

---

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| Mermaid を動的インポート | バンドルサイズ削減（Mermaid は約1MB） | 静的インポート（バンドル肥大化） |
| `dangerouslySetInnerHTML` でHTML表示 | unified の出力はサニタイズ済み文字列 | React コンポーネントツリーへの変換（rehype-react）— 過剰複雑 |
| 複数タブは Phase 2-C に委譲 | 2-A は単一ファイル表示のみに集中 | 2-A で複数タブも実装（スコープ肥大化） |
| `selectedFile === filePath` で再読み込みスキップ | 同じファイルクリック時の無駄な IPC 呼び出しを防ぐ | 毎回再読み込み |
| Shiki テーマを `github-dark` に固定 | Phase 3-B でテーマ切り替え対応予定 | ダイナミックテーマ（Phase 3-B で対応） |

## 未解決事項

- [ ] `rehype-shiki` と `@shikijs/rehype` のパッケージ名確認（バージョンによって異なる可能性）
- [ ] Mermaid の `pre.language-mermaid` クラス名が rehype-shiki 処理後に正しく設定されるか確認（Mermaid は shiki で処理させず除外する必要があるかも）
