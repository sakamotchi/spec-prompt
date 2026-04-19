# 設計書 - status-bar-phase3

## アーキテクチャ

### 対象コンポーネント

```
Frontend (React/TypeScript)
    ├─ hooks/useGitBranch.ts        ← 変更なし、テスト追加のみ
    ├─ components/StatusBar/
    │   ├─ BranchIndicator.tsx       ← 変更なし、テスト追加のみ
    │   └─ FileTypeIndicator.tsx     ← 変更なし、テスト追加のみ
    └─ tests (新規)
        ├─ src/hooks/useGitBranch.test.ts
        ├─ src/components/StatusBar/BranchIndicator.test.tsx
        └─ src/components/StatusBar/FileTypeIndicator.test.tsx

Docs
    ├─ docs/steering/02_functional_design.md           ← ステータスバー節追記
    └─ docs/projects/20260419-ステータスバー機能/03_WBS.md ← Phase 3 完了更新
```

### 影響範囲

- **フロントエンド**: 新規テストファイルのみ。プロダクションコードの変更なし
- **バックエンド（Rust）**: 変更なし
- **ドキュメント**: 永続化ドキュメント 1 ファイル追記、プロジェクト WBS のチェック欄更新

## 実装方針

### 概要

Phase 3 は **「壊れていないコードに安全網を張る」** ことが主目的。テストが既存実装を過度に縛らないよう、外部観測可能な挙動のみを検証する。

### 詳細

1. **`useGitBranch` のテスト**
   - `vi.mock('../lib/tauriApi')` で `tauriApi.getBranch` をモック
   - `vi.useFakeTimers()` で `setInterval` を制御
   - `renderHook(() => useGitBranch(cwd))` で開始、`await vi.advanceTimersByTimeAsync(3000)` で次回 tick を発火
   - 各テストの `beforeEach` でモックをリセット

2. **`BranchIndicator` のテスト**
   - `render(<BranchIndicator branch="main" />)` で DOM を取得
   - `screen.getByText("main")` / `screen.getByTitle("main")` で検証
   - `branch={null}` のケースは `container.firstChild === null` で空レンダリング確認

3. **`FileTypeIndicator` のテスト**
   - `useAppStore.setState({ activeMainTab: 'content' })` 等で直接ストアを操作
   - `useContentStore.setState({ ... })` で `primary` / `secondary` / `focusedPane` を設定
   - `beforeEach` / `afterEach` でストア初期状態を復元（`useXxxStore.setState(initial)`）
   - 5 ケース（Markdown / Code / terminal モード / filePath=null / secondary フォーカス）を `it` で分ける

4. **steering 追記**
   - 既存の `02_functional_design.md` の画面構成セクションに「ステータスバー」節を追加
   - 箇条書きレベルで以下を明記: 配置・高さ、左端（ブランチ名、非 Git 時非表示）、右端（ファイル種別ラベル、ターミナルモード時非表示）、更新方式（ポーリング 3 秒）

5. **WBS 更新**
   - Phase 3 の T3-1〜T3-4 のチェックを実態に合わせて `[x]` 化
   - マイルストーン M1/M2 は Phase 1/2 時点で達成済み、M3 は本 Phase 完了時に達成

6. **PR 作成**
   - `gh pr create --base main --head feature/status-bar`
   - 本文には Phase 1〜3 で実施した内容の要約、方針変更（watch→ポーリング）の経緯、Issue #9 が対象外であることを明記

## データ構造

### 型定義（TypeScript）

本 Phase ではプロダクションコードの型変更なし。テストヘルパの型は最小限に抑え、既存の `ContentTab` / `ContentGroup` / `ViewMode` を流用する。

### 型定義（Rust）

変更なし。

## API設計

### Tauriコマンド

変更なし（Phase 1 の `git_branch` をそのまま利用）。

### Tauriイベント

変更なし。

## UI設計

本 Phase では UI 変更なし。

### UIライブラリ

変更なし。

### カラーパレット

変更なし。

### 画面構成

Phase 2 までに完成した状態を踏襲する。

### コンポーネント構成

Phase 2 までに完成した状態を踏襲する。

## 状態管理

### Zustandストア変更

ストアの構造変更はなし。テスト内でのみ `useAppStore.setState` / `useContentStore.setState` を使って初期状態を操作する。

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

  it('title 属性にブランチ名を設定する', () => {
    render(<BranchIndicator branch="long/branch/name" />)
    expect(screen.getByTitle('long/branch/name')).toBeInTheDocument()
  })
})
```

```typescript
// src/hooks/useGitBranch.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useGitBranch } from './useGitBranch'
import { tauriApi } from '../lib/tauriApi'

vi.mock('../lib/tauriApi', () => ({
  tauriApi: { getBranch: vi.fn() },
}))

describe('useGitBranch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(tauriApi.getBranch).mockResolvedValue('main')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetAllMocks()
  })

  it('cwd が null のとき IPC を呼ばない', () => {
    renderHook(() => useGitBranch(null))
    expect(tauriApi.getBranch).not.toHaveBeenCalled()
  })

  it('cwd セット時にブランチ名を取得する', async () => {
    const { result } = renderHook(() => useGitBranch('/repo'))
    await vi.advanceTimersByTimeAsync(0)
    await waitFor(() => expect(result.current.branch).toBe('main'))
  })

  it('3 秒ごとにポーリングする', async () => {
    renderHook(() => useGitBranch('/repo'))
    await vi.advanceTimersByTimeAsync(0)
    vi.mocked(tauriApi.getBranch).mockResolvedValue('feature/x')
    await vi.advanceTimersByTimeAsync(3000)
    await vi.advanceTimersByTimeAsync(0)
    expect(tauriApi.getBranch).toHaveBeenCalledTimes(2)
  })

  it('アンマウント時にタイマーが破棄される', async () => {
    const { unmount } = renderHook(() => useGitBranch('/repo'))
    await vi.advanceTimersByTimeAsync(0)
    const initialCalls = vi.mocked(tauriApi.getBranch).mock.calls.length
    unmount()
    await vi.advanceTimersByTimeAsync(10000)
    expect(vi.mocked(tauriApi.getBranch).mock.calls.length).toBe(initialCalls)
  })
})
```

### Rustテスト例

本 Phase では Rust 側テストの追加なし（Phase 1 で完了済み）。

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| `StatusBar` 自体の結合テストは書かない | 子コンポーネント（`BranchIndicator` / `FileTypeIndicator`）と `useGitBranch` をそれぞれテストすれば、`StatusBar` は単なる合成なので追加価値が薄い | 結合テストも書く案。重複コスト > リグレッション検出メリットのため見送り |
| `vi.useFakeTimers()` + `advanceTimersByTimeAsync` を使う | `setInterval` を含むロジックを現実時間に依存させずに確実にテストできる | 実時間を待つ案（`await new Promise(r => setTimeout(r, 3000))`）。遅くフレーキーなため不採用 |
| steering 追記は 02_functional_design.md のみ | ステータスバーは UI 機能。アーキテクチャ（03_）やリポジトリ構造（04_）には影響せず、機能設計ドキュメントが最適 | 複数 steering に分散記載する案。重複のため不採用 |
| PR はまとめて 1 本 | Phase 1/2/3 はロジック上連結されており、分割してもレビュー単位として意味が薄い | Phase ごとに 3 本の PR。メインブランチへの取り込みが遅くなるため見送り |

## 未解決事項

- [ ] `FileTypeIndicator` のテストで Zustand ストアを直接 `setState` する際、persist ミドルウェアが副作用を残さないことを確認する（必要なら `vi.mock('zustand/middleware', ...)` でバイパス）
- [ ] PR 作成時にメインブランチ保護ルールや CI 設定を確認する（CI が赤になったら原因を調査）
