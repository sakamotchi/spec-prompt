# 設計書 - status-bar-phase2

## アーキテクチャ

### 対象コンポーネント

```
Frontend (React/TypeScript)
    ├─ components/Layout/AppLayout.tsx       ← 変更なし（Phase 1 の配置を利用）
    ├─ components/StatusBar/
    │   ├─ StatusBar.tsx                     ← 実装差し替え（スケルトン → 実体）
    │   ├─ BranchIndicator.tsx               ← 新規
    │   └─ FileTypeIndicator.tsx             ← 新規
    ├─ hooks/useGitBranch.ts                 ← 新規
    ├─ stores/appStore.ts                    ← 購読のみ（projectRoot, activeMainTab）
    ├─ stores/contentStore.ts                ← 購読のみ（focusedPane, tabs, activeTabId）
    └─ lib/viewMode.ts                        ← 再利用（getViewMode）
        ↓ invoke("git_branch")
Tauri IPC
    ↓
Rust Backend                                  ← Phase 1 で実装済み
    └─ commands/git.rs::git_branch
```

### 影響範囲

- **フロントエンド**:
  - `src/components/StatusBar/StatusBar.tsx` — Phase 1 のスケルトン JSX を実装で置き換え
  - `src/components/StatusBar/BranchIndicator.tsx` — 新規
  - `src/components/StatusBar/FileTypeIndicator.tsx` — 新規
  - `src/hooks/useGitBranch.ts` — 新規
  - `src/components/StatusBar/index.ts` — 必要に応じて子コンポーネントを再エクスポート
- **バックエンド（Rust）**: 変更なし（Phase 1 の `git_branch` をそのまま利用）

## 実装方針

### 概要

Phase 2 は **描画ロジックを 3 つの小さなユニットに分割**し、個別に責務を閉じる。`useGitBranch` がブランチ名の取得・監視を独占し、`BranchIndicator` は pure な表示コンポーネント。`FileTypeIndicator` は 2 つのストアを購読するコンテナ、`StatusBar` はレイアウトと `useGitBranch` の起動を担う。

### 詳細

1. **`useGitBranch(cwd: string | null)` の実装**
   - `useState` で `{ branch, loading }` を保持
   - `useEffect` 内で以下を順序実行:
     a. cwd が null なら `{ branch: null, loading: false }` にリセットして return
     b. `loading = true` に設定し、`tauriApi.getBranch(cwd)` の結果を state へ反映
     c. `setInterval(3000)` を起動し、以降は 3 秒ごとに `tauriApi.getBranch(cwd)` を再実行して state 更新
   - クリーンアップ関数で `clearInterval` を呼び、`disposed` フラグで非同期結果の反映を無効化

   > 当初 `watch("{cwd}/.git/HEAD", ...)` を使う設計だったが、macOS では `git switch -c` 等の atomic rename でイベントが届かず表示が追従しないケースを確認したため、ポーリングに切り替えた。`git rev-parse` は数 ms で完了するため 3 秒間隔のコストは無視できる。
2. **`BranchIndicator`**
   - pure コンポーネント。`{ branch: string | null }` を受け取り、`branch == null` なら `null` を返す
   - `<span className="flex items-center gap-1 truncate max-w-[200px]">` 構造
   - 左に `GitBranch` アイコン（`size={14}`）、右にテキスト
   - `title={branch}` で tooltip フォールバック
3. **`FileTypeIndicator`**
   - `useAppStore(s => s.activeMainTab)` と `useContentStore` から以下を購読:
     - `focusedPane`
     - `primary.tabs` / `primary.activeTabId`
     - `secondary.tabs` / `secondary.activeTabId`
   - 現在の filePath を算出 → `getViewMode(filePath)` でモード導出 → ラベル表示
   - `activeMainTab !== 'content'` または `filePath == null` なら `null` を返す
   - アイコン:
     - `markdown` → `FileText`
     - `code` → `Code`
     - `image` → `Image`
     - `plain` → `File`
4. **`StatusBar` 統合**
   - `projectRoot` を `useAppStore` から取得
   - `useGitBranch(projectRoot)` を呼び、`branch` を取り出す
   - レイアウト: `<div className="flex h-7 ... items-center justify-between px-3">`
   - 左側: `<BranchIndicator branch={branch} />`
   - 右側: `<FileTypeIndicator />`

## データ構造

### 型定義（TypeScript）

```typescript
// src/hooks/useGitBranch.ts
export interface UseGitBranchResult {
  branch: string | null
  loading: boolean
}

export function useGitBranch(cwd: string | null): UseGitBranchResult { /* ... */ }

// src/components/StatusBar/BranchIndicator.tsx
interface BranchIndicatorProps {
  branch: string | null
}

// src/components/StatusBar/FileTypeIndicator.tsx
// props なし（ストアから直接購読）

// FileTypeIndicator 内部のラベルマップ
const FILE_TYPE_LABELS: Record<ViewMode, string> = {
  markdown: 'Markdown',
  code: 'Code',
  image: 'Image',
  plain: 'Plain',
}
```

### 型定義（Rust）

Phase 2 では Rust 側の変更なし。

## API設計

### Tauriコマンド

| コマンド名 | 引数 | 戻り値 | 説明 |
|-----------|------|--------|------|
| `git_branch` (既存) | `{ cwd: string }` | `Result<Option<String>, String>` | Phase 1 で追加済み |

### Tauriイベント

- 追加なし。ブランチ情報はフロント側 `setInterval` によるポーリング、ファイル種別は Zustand ストア購読で完結する。

## UI設計

### UIライブラリ

| ライブラリ | 用途 | 備考 |
|-----------|------|------|
| `lucide-react` | `GitBranch` / `FileText` / `Code` / `Image` / `File` アイコン | tree-shaking対応、既存で使用 |

### カラーパレット

`src/index.css` で定義済みの CSS カスタムプロパティを使用する：

- `--color-bg-elevated` — ステータスバー背景（Phase 1 から継承）
- `--color-border` — ステータスバー上端ボーダー（Phase 1 から継承）
- `--color-text-muted` — インジケータのテキスト・アイコン色

### 画面構成

```
┌──────────────────────────────────────────────────────┐
│  GitBranch icon + " feature/status-bar"  ...  FileText + " Markdown" │ ← h-7 StatusBar
└──────────────────────────────────────────────────────┘
```

- 左端: `BranchIndicator`（`projectRoot` が Git リポジトリのときのみ）
- 右端: `FileTypeIndicator`（content モード + ファイル選択時のみ）
- 両方とも非表示の場合でも帯の高さ・ボーダーは維持

### コンポーネント構成

- `StatusBar`
  - `BranchIndicator`（表示/非表示は props で制御）
  - `FileTypeIndicator`（表示/非表示は内部で制御）

## 状態管理

### Zustandストア変更

Phase 2 ではストアへの追加はしない。ブランチ情報は `useGitBranch` 内部のローカル state で保持する。

理由:
- ブランチ情報が必要なのは現状 `StatusBar` のみ。他コンポーネントで共有の必要性が出たときにストア化すれば良い（YAGNI）
- ストア化すると Persist ミドルウェアや複数 window の同期を考慮する必要が出て複雑化

## テストコード

### Reactコンポーネントテスト例

```typescript
// src/components/StatusBar/BranchIndicator.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BranchIndicator } from './BranchIndicator'

describe('BranchIndicator', () => {
  it('ブランチ名を表示する', () => {
    render(<BranchIndicator branch="feature/xyz" />)
    expect(screen.getByText('feature/xyz')).toBeInTheDocument()
  })

  it('branch が null のとき何も描画しない', () => {
    const { container } = render(<BranchIndicator branch={null} />)
    expect(container.firstChild).toBeNull()
  })
})
```

```typescript
// src/hooks/useGitBranch.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useGitBranch } from './useGitBranch'
import { tauriApi } from '../lib/tauriApi'

vi.mock('../lib/tauriApi', () => ({
  tauriApi: { getBranch: vi.fn() },
}))

describe('useGitBranch', () => {
  beforeEach(() => {
    vi.mocked(tauriApi.getBranch).mockResolvedValue('main')
  })

  it('cwd が null のとき IPC を呼ばない', () => {
    renderHook(() => useGitBranch(null))
    expect(tauriApi.getBranch).not.toHaveBeenCalled()
  })

  it('cwd セット時にブランチ名を取得する', async () => {
    const { result } = renderHook(() => useGitBranch('/tmp/repo'))
    await waitFor(() => expect(result.current.branch).toBe('main'))
  })
})
```

### Rustテスト例

Phase 2 では Rust 側の追加変更なし。

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| ブランチ情報は `useGitBranch` のローカル state で保持 | 現状 `StatusBar` からしか使わない。共有の必要が出てから Zustand に移す方が無駄がない | 最初から `useAppStore` に寄せる案。多重ウィンドウ同期が必要になれば検討 |
| ブランチ情報の更新はファイル監視ではなく 3 秒間隔ポーリング | `tauri-plugin-fs` の `watch` は macOS で `.git/HEAD` の atomic rename を取りこぼしブランチ切替に追従しない実問題が発生。`git rev-parse` は数 ms のため、ポーリングでも十分低コスト | `.git` ディレクトリ recursive 監視や、既存 `useFileTree` watcher への相乗りも検討したが、複雑化と他モジュール依存が増えるため見送り |
| `FileTypeIndicator` は memo 化しない | 初期実装の可読性を優先。実測でボトルネックが出れば Phase 3 で対応 | 最初から `memo` + セレクタ最適化。Premature optimization のため見送り |
| ラベルは英語表記（Markdown / Code / Image / Plain） | VS Code 系エディタのステータスバーの慣習に合わせる | 日本語表記。識別のしやすさと国際化コストのバランスで英語を採用 |

## 未解決事項

- [ ] `StatusBar` 系コンポーネントの単体テスト有無（必要なら追加、不要なら手動確認のみで完結）
