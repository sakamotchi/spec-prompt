# 設計書 - content-tab-scroll-position

## アーキテクチャ

### 対象コンポーネント

```
ContentArea
 └─ ContentPane (primary / secondary)
     └─ ContentView (tabId)
         ├─ MarkdownPreview  ── スクロールコンテナ (overflow-y-auto)
         ├─ CodeViewer       ── スクロールコンテナ (overflow-auto)
         ├─ PlainTextViewer  ── スクロールコンテナ (overflow-auto)
         └─ ImageViewer      ── 対象外
                  │
                  │ ref でスクロールコンテナを取得
                  ▼
           useTabScroll (カスタムフック)
                  │ 保存/復元
                  ▼
            useContentStore
              ContentTab.scrollTop : number
              setScrollTop(tabId, scrollTop)
```

### 影響範囲

- **フロントエンド**:
  - `src/stores/contentStore.ts` — `ContentTab` 型拡張、`setScrollTop` アクション追加
  - `src/components/ContentView/MarkdownPreview.tsx`
  - `src/components/ContentView/CodeViewer.tsx`
  - `src/components/ContentView/PlainTextViewer.tsx`
  - `src/components/ContentView/useTabScroll.ts`（新規、共通フック）
- **バックエンド（Rust）**: 変更なし

## 実装方針

### 概要

1. `ContentTab` にタブごとの `scrollTop: number` を追加する。
2. 各ビューアは自身のスクロールコンテナ DOM への `ref` を持ち、カスタムフック `useTabScroll(tabId, ref)` で次の振る舞いを実現する:
   - **マウント時／`tabId` 変更時**: ストアから当該タブの `scrollTop` を取得し、コンテンツ描画後に `ref.current.scrollTop` へ書き戻す
   - **アンマウント時**: `ref.current.scrollTop` をストアへ保存する
3. タブ切替時、非アクティブになるタブのビューア DOM は `ContentView` の再レンダリングで `tabId` prop が変わる。ここでビューアコンポーネント自身は再マウントされず、**同じスクロールコンテナ DOM が再利用される** ため、フックは `tabId` を `useEffect` の依存配列に入れて、変更を検知して保存・復元の両方を行う（エフェクトのクリーンアップで保存、本体で復元）。
4. `closeTab` / `closeTabByPath` は既存の実装でタブを配列から除去するだけで `scrollTop` も一緒に消える（タブオブジェクト丸ごと消えるため）。追加対応は不要。

### 詳細

1. **`contentStore` 拡張**:
   - `ContentTab` に `scrollTop: number`（既定値 `0`）を追加。
   - `setScrollTop(tabId, scrollTop)` アクションを追加。両グループ（primary / secondary）のうち該当タブを更新する。
   - `makeTab` の既定値に `scrollTop: 0` を追加。

2. **共通フック `useTabScroll`**:
   - 引数: `tabId: string`, `scrollRef: React.RefObject<HTMLElement | null>`
   - 実装:
     ```typescript
     export function useTabScroll(
       tabId: string,
       scrollRef: React.RefObject<HTMLElement | null>,
     ) {
       // 復元: tabId が変わったとき、保存済み scrollTop を反映
       // ストア値の取得はエフェクト内で getState() で行い、subscribe しない
       // （subscribe するとスクロール保存のたびに本エフェクトが再実行されて復元ループになる）
       useLayoutEffect(() => {
         const el = scrollRef.current
         if (!el) return
         const saved = useContentStore.getState()
         const tab =
           saved.primary.tabs.find((t) => t.id === tabId) ??
           saved.secondary.tabs.find((t) => t.id === tabId)
         el.scrollTop = tab?.scrollTop ?? 0

         // 保存: この tabId のビューアがアンマウント / tabId 変更前に現在位置を保存
         return () => {
           const current = scrollRef.current
           if (!current) return
           useContentStore.getState().setScrollTop(tabId, current.scrollTop)
         }
       }, [tabId, scrollRef])
     }
     ```
   - `useLayoutEffect` を使う理由: ペイント前に `scrollTop` を書き戻し、「一瞬上端が見えてから戻る」チラつきを防ぐため。

3. **非同期レンダリングへの対応**:
   - `MarkdownPreview` は `html` ステートが非同期で埋まるため、上記 `useLayoutEffect` だけでは HTML 注入前に書き戻してしまい効果がない。
   - 対策として、`html` を依存配列に加えた追加の `useLayoutEffect` で、**HTML 注入完了後にもう一度** 保存済み `scrollTop` を反映する。ただしここで「書き戻しのトリガ」は tab 切替直後のみとしたい（ユーザー操作中のスクロールに干渉しない）。
   - 具体的には「タブ切替直後」を示すフラグ `isRestoringRef` をフック内で管理し、`tabId` 変化時に `true`、次の `html` 更新タイミングで `scrollTop` を書き戻した後 `false` にする、という制御を入れる。
   - 同様のロジックが `CodeViewer`（Shiki の `html` state）にも必要。
   - `PlainTextViewer` は同期レンダリングのため、初回フックだけで復元可能。

4. **フック API（最終案）**:
   ```typescript
   useTabScroll(tabId, scrollRef, [html]) // 追加のトリガを配列で受け取る
   ```
   - 追加のトリガ配列の値が変化した直後、`isRestoringRef === true` なら再度 `scrollTop` を反映してフラグを下ろす。

## データ構造

### 型定義（TypeScript）

```typescript
// src/stores/contentStore.ts
export interface ContentTab {
  id: string
  filePath: string | null
  content: string | null
  viewMode: ViewMode
  isLoading: boolean
  scrollTop: number // 追加: 非アクティブ化直前のスクロール位置
}
```

### Zustand ストア変更

```typescript
// src/stores/contentStore.ts
interface ContentState {
  // ... 既存
  setScrollTop: (tabId: string, scrollTop: number) => void
}

const makeTab = (overrides?: Partial<ContentTab>): ContentTab => ({
  id: crypto.randomUUID(),
  filePath: null,
  content: null,
  viewMode: 'plain',
  isLoading: false,
  scrollTop: 0, // 追加
  ...overrides,
})

// アクション実装
setScrollTop: (tabId, scrollTop) =>
  set((state) => ({
    ...updateBothGroups(state, (g) => ({
      ...g,
      tabs: g.tabs.map((t) => (t.id === tabId ? { ...t, scrollTop } : t)),
    })),
  })),
```

### 型定義（Rust）

変更なし。

## API設計

### Tauriコマンド

変更なし。

### Tauriイベント

変更なし。

## UI設計

UI の見た目に変更はない。挙動のみが変わる。

### 画面構成

変更なし。

### コンポーネント構成

- `src/components/ContentView/useTabScroll.ts`（新規）
  - 公開関数: `useTabScroll(tabId, scrollRef, extraRestoreDeps?)`
- `MarkdownPreview` / `CodeViewer` / `PlainTextViewer` の各ルート `div` に `ref` を付与し、`useTabScroll` を呼ぶ

## 状態管理

### Zustand ストア変更

- `ContentTab.scrollTop: number` を追加
- `setScrollTop(tabId, scrollTop)` アクション追加
- `setTabContent` はコンテンツ更新時に `scrollTop` を保持する（= 何もしなければそのまま残る）
- `closeTab` / `closeTabByPath` / `moveTab` は既存のタブオブジェクト移動・削除ロジックに依存し、追加変更なし

## テストコード

### 手動テスト優先

Issue の性質上、主な検証は手動テストで行う（`testing.md` 参照）。

### Reactコンポーネントテスト例（任意）

```typescript
import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useContentStore } from '../../stores/contentStore'

describe('contentStore.setScrollTop', () => {
  it('should update scrollTop of the target tab in both groups', () => {
    const { result } = renderHook(() => useContentStore())
    const tabId = result.current.primary.activeTabId
    act(() => result.current.setScrollTop(tabId, 250))
    expect(result.current.primary.tabs[0].scrollTop).toBe(250)
  })

  it('should preserve scrollTop across setTabContent updates', () => {
    const { result } = renderHook(() => useContentStore())
    const tabId = result.current.primary.activeTabId
    act(() => result.current.setScrollTop(tabId, 100))
    act(() => result.current.setTabContent(tabId, '/tmp/x.md', 'hello', 'markdown'))
    expect(result.current.primary.tabs[0].scrollTop).toBe(100)
  })
})
```

### Rust テスト例

不要（バックエンド変更なし）。

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| `scrollTop` を `ContentTab` に持つ | タブのライフサイクル（`closeTab` / `moveTab`）にそのまま乗れるため、クリーンアップ処理を別途書く必要がない | 別 `Map<tabId, scrollTop>` を `ContentState` に持つ（ただし閉じ時の掃除が必要） |
| 共通ロジックを `useTabScroll` フックに切り出す | 3 ビューアで重複実装を避け、保守性を上げる | 各ビューアに直接実装（重複する） |
| `useLayoutEffect` で書き戻す | ペイント前に位置を戻してチラつきを防ぐため | `useEffect`（ペイント後になり一瞬上端が見える可能性） |
| スクロールイベントのたびに set しない、非アクティブ化時にまとめて保存 | 高頻度の set による Zustand 再レンダリングと性能劣化を避けるため | スロットリングして set する（実装コストが増える） |
| 永続化しない（`persist` ミドルウェアへの追加なし） | 要件上アプリ再起動を跨ぐ必要はなく、スコープ外としたため | `settingsStore` のように永続化する |
| `ImageViewer` は対象外 | 単一画像で実質スクロールしないため、実装コストに見合わない | すべてのビューアに適用する |

## 未解決事項

- [ ] `MarkdownPreview` の画像・Mermaid の遅延レンダリングでコンテンツ高さが変わると、初期復元 `scrollTop` が有効な最大値を超える可能性がある。この場合ブラウザは上限にクランプするため挙動上問題ないが、意図したバイトオフセット位置からズレる可能性は残る。手動テストで許容範囲内か確認し、必要に応じて `html` 以外に画像 `load` イベントでの再適用を検討する。
- [ ] ファイル変更イベントでコンテンツが置き換わったとき（同一 `tabId`）、スクロール位置を維持するか上端へ戻すかを最終確認する。要件上は「タブ切替時の挙動」だけ守れば十分なため、本修正ではコンテンツ更新でも `scrollTop` を維持する（= 何もしない）方針とするが、差分量が多い場合にユーザー体験としてどちらが自然か要検証。
