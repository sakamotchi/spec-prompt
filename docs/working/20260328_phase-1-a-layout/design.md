# 設計書 - Phase 1-A: 全体レイアウト

## アーキテクチャ

### 対象コンポーネント

```
Frontend (React/TypeScript)
  App.tsx
    └── AppLayout
          ├── SplitPane（水平分割 = 左右ペイン）
          │     ├── 左ペイン: TreePanel プレースホルダー
          │     └── 右ペイン: MainArea
          │           ├── MainTabs（コンテンツ / ターミナル）
          │           └── メインコンテンツエリア（プレースホルダー）
          └── PathPalette プレースホルダー（後工程）

Zustand Store
  appStore.ts
    └── activeMainTab: 'content' | 'terminal'
```

### 影響範囲

- **フロントエンド**: `App.tsx`, `Layout/`, `MainArea/`, `SplitPane/`, `stores/appStore.ts`
- **バックエンド（Rust）**: なし（Phase 1-A はフロントエンドのみ）

---

## 実装方針

### 概要

Tauri WebView 上でマウスイベントを使ったドラッグリサイズを実装する。
コンポーネント設計は再利用性を重視し、`SplitPane` は汎用コンポーネントとして切り出す（Phase 2-C のコンテンツ分割・ターミナル分割で再利用する）。
UI の見た目は Radix UI + Tailwind CSS v4 + Geist フォントで VS Code / Linear 系のダークテーマに仕上げる。

### 詳細

1. **UIライブラリセットアップ**: `@radix-ui/react-tabs`・`lucide-react` をインストールし、`src/index.css` にカラーパレット（CSS カスタムプロパティ）と Geist フォントを設定する。

2. **`SplitPane` コンポーネント**: `direction="horizontal"` で左右分割。左ペインの幅を `useState` で管理し、セパレーターの `mousedown` でドラッグ開始、`document` の `mousemove` / `mouseup` でリサイズ完了。`useCallback` と `useRef` で無駄な再レンダリングを防ぐ。

3. **`AppLayout` コンポーネント**: `SplitPane` を使って左ペイン（`TreePanel` プレースホルダー）と右ペイン（`MainArea`）を配置する薄いラッパー。

4. **`MainTabs` コンポーネント**: Radix UI の `Tabs` プリミティブをベースに実装し、`appStore` の `activeMainTab` と接続する。`useEffect` で `Ctrl+Tab` のキーバインドを登録し、アンマウント時に解除する。Radix UI が提供するアクセシビリティ属性（`aria-selected` 等）をそのまま利用できる。

5. **`appStore` 拡張**: `activeMainTab: 'content' | 'terminal'` をストアに追加。Phase 1-D での full 実装に先行して最小限の型のみ定義する。

---

## データ構造

### 型定義（TypeScript）

```typescript
// src/stores/appStore.ts
type MainTab = 'content' | 'terminal'

interface AppState {
  activeMainTab: MainTab
  setActiveMainTab: (tab: MainTab) => void
}
```

```typescript
// src/components/SplitPane/SplitPane.tsx
interface SplitPaneProps {
  direction: 'horizontal' | 'vertical'
  defaultSize?: number       // 左ペイン（水平時）または上ペイン（垂直時）の初期サイズ(px)
  minSize?: number           // 最小サイズ(px)
  maxSize?: number           // 最大サイズ(px)
  children: [React.ReactNode, React.ReactNode]
}
```

---

## API設計

### Tauriコマンド

Phase 1-A では Tauri IPC を使用しない。

### Tauriイベント

Phase 1-A では Tauri イベントを使用しない。

---

## UI設計

### カラーパレット

```css
/* src/index.css */
@import "tailwindcss";
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap');

:root {
  --color-bg-base:      #0d0d0d;  /* アプリ最背面 */
  --color-bg-panel:     #141414;  /* ペイン背景 */
  --color-bg-elevated:  #1e1e1e;  /* タブバー・ホバー */
  --color-border:       #2a2a2a;  /* ペイン境界・セパレーター */
  --color-text-primary: #e8e8e8;
  --color-text-muted:   #888888;
  --color-accent:       #7c6af7;  /* アクティブタブ・ハイライト */
}

* {
  font-family: 'Geist', sans-serif;
}
```

### 画面構成

```
┌──────────┬──┬─────────────────────────────────────┐
│          │  │ [コンテンツ▼] [ターミナル]              │
│          │  ├─────────────────────────────────────┤
│          │  │                                     │
│ 左ペイン  │SE│         右ペイン (MainArea)           │
│（ツリー  │PA│                                     │
│プレース  │RA│       (コンテンツ/ターミナルの          │
│ホルダー）│TO│        プレースホルダー)               │
│          │R │                                     │
└──────────┴──┴─────────────────────────────────────┘
```

- 背景: `--color-bg-base` (#0d0d0d)
- 左ペイン背景: `--color-bg-panel` (#141414)、デフォルト幅 240px、min 160px、max 480px
- セパレーター: 幅 4px、色 `--color-border`、ホバー時に `--color-accent` でハイライト
- MainTabs バー: 背景 `--color-bg-elevated`、高さ 36px
- アクティブタブ: `--color-accent` のボーダーボトム（2px）+ テキスト色 `--color-text-primary`
- 非アクティブタブ: テキスト色 `--color-text-muted`

### コンポーネント構成

```
App.tsx
└── AppLayout                          src/components/Layout/AppLayout.tsx
      └── SplitPane direction="horizontal"   src/components/SplitPane/SplitPane.tsx
            ├── <div> 左ペインプレースホルダー
            └── MainArea                      src/components/MainArea/MainArea.tsx
                  ├── MainTabs                src/components/MainArea/MainTabs.tsx
                  └── <div> コンテンツエリアプレースホルダー
```

---

## 状態管理

### Zustandストア変更

```typescript
// src/stores/appStore.ts
import { create } from 'zustand'

type MainTab = 'content' | 'terminal'

interface AppState {
  activeMainTab: MainTab
  setActiveMainTab: (tab: MainTab) => void
  // Phase 1-B, 1-C, 1-D で順次追加予定:
  // fileTree, selectedFile, activeProjectPath ...
}

export const useAppStore = create<AppState>((set) => ({
  activeMainTab: 'content',
  setActiveMainTab: (tab) => set({ activeMainTab: tab }),
}))
```

---

## テストコード

### Reactコンポーネントテスト例

```typescript
// src/components/SplitPane/SplitPane.test.tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SplitPane } from './SplitPane'

describe('SplitPane', () => {
  it('子要素が2つレンダリングされる', () => {
    const { getByText } = render(
      <SplitPane direction="horizontal">
        <div>left</div>
        <div>right</div>
      </SplitPane>
    )
    expect(getByText('left')).toBeTruthy()
    expect(getByText('right')).toBeTruthy()
  })
})
```

```typescript
// src/components/MainArea/MainTabs.test.tsx
import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { MainTabs } from './MainTabs'

describe('MainTabs', () => {
  it('ターミナルタブをクリックするとアクティブタブが切り替わる', () => {
    const { getByText } = render(<MainTabs />)
    fireEvent.click(getByText('ターミナル'))
    // appStore の activeMainTab が 'terminal' に変わることを検証
    expect(getByText('ターミナル').closest('[data-active]')).toBeTruthy()
  })
})
```

---

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| ドラッグリサイズを自前実装（ライブラリ不使用） | `react-resizable` 等の外部ライブラリはTailwind CSS v4 と相性が悪い場合があり、シンプルな実装で十分 | `react-resizable-panels` を使う |
| `SplitPane` を汎用コンポーネントとして分離 | Phase 2-C のコンテンツ分割・ターミナル分割で再利用できる | `AppLayout` 内にインライン実装する |
| `activeMainTab` を appStore で管理 | Phase 1-D の状態管理基盤と統合しやすく、将来的に `persist` middleware で永続化できる | ローカル state で管理する |
| キーバインド（Ctrl+Tab）は `MainTabs` 内で `useEffect` 登録 | タブ UI と同じコンポーネントに閉じることでコードの凝集度を保つ | グローバルのキーバインドマネージャーで管理する |
| `MainTabs` に Radix UI `Tabs` を採用 | アクセシビリティ属性（`aria-selected`、`role="tab"` 等）が自動付与される。Tailwind v4 と完全互換（スタイルなしのヘッドレス設計）。shadcn/ui は Tailwind v4 対応が canary 段階のため見送り | shadcn/ui の Tabs コンポーネントを使う |
| アイコンに Lucide React を採用 | 軽量（tree-shaking 対応）でデザインが一貫している。Phase 1-B のファイルツリーアイコンにも流用できる | Heroicons、react-icons |
| フォントに Geist を採用 | Vercel 製のモダンなサンセリフ。等幅版（Geist Mono）もあり、将来的なコードビューア表示にも使える | Inter、システムフォント |
| カラーパレットを CSS カスタムプロパティで定義 | Tailwind のクラスだけでは表現しにくいダークテーマの細かい色調整が可能。将来のライト/ダーク切り替え（Phase 3-B）も `:root` の上書きで対応できる | Tailwind の設定ファイルで定義する |

## 未解決事項

- [ ] セパレーターのドラッグ中に `<iframe>` や `<canvas>` 要素（xterm.js）がマウスイベントを横取りする問題の対策（`pointer-events: none` を子要素に付与する等）
- [ ] ペイン幅を `persist` middleware で保存するかどうか（Phase 1-D の設計時に決定）
