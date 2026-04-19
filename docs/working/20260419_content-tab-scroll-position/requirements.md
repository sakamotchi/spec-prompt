# 要件定義書 - content-tab-scroll-position

## 概要

コンテンツタブ切替時に、前のタブで表示していたスクロール位置が引き継がれてしまう不具合を修正する。タブごとにスクロール位置を記憶し、切替時は各タブ固有の位置に復元する。

関連 Issue: [#9](https://github.com/sakamotchi/spec-prompt/issues/9)

## 背景・目的

### 現象

コンテンツタブで複数ファイルを開いているとき、A.md をスクロール最下部まで移動してから B.md のタブに切り替えると、B.md も前タブのスクロール位置（A.md 末尾と同じ `scrollTop` 値）を引き継いだ状態で表示される。

再現手順:

1. 複数のコンテンツタブを開く（例: 十分な長さの A.md と B.md）
2. A.md のタブで画面下部までスクロール
3. B.md のタブに切り替える
4. B.md が初期位置（上端）ではなく、A.md で止めた位置と同じ `scrollTop` で表示される

### 原因

- `src/components/ContentView/ContentArea.tsx:37` で `<ContentView tabId={group.activeTabId} />` を **単一インスタンス** としてマウントし、タブ切替時は `tabId` prop のみを差し替える構造になっている。
- `src/components/ContentView/MarkdownPreview.tsx:108-118` のスクロール用 `<div class="... overflow-y-auto ...">` が同じ DOM ノードとして再利用されるため、`content` だけが差し変わって `scrollTop` が前タブの値のまま残る。
- 同じ構造の `CodeViewer`（`h-full overflow-auto`）・`PlainTextViewer`（`h-full overflow-auto`）も同じ問題を抱える。

### 目的

- タブごとのスクロール位置を保持し、ユーザーがタブを行き来しても読んでいた位置を失わない体験を提供する。
- ファイル種別（MD / Code / PlainText）にかかわらず一貫したスクロール記憶挙動にする。

## 要件一覧

### 機能要件

#### F-1: タブ非アクティブ時にスクロール位置を保存する

- **説明**: タブがアクティブから外れる直前の `scrollTop` を当該タブに紐付けて保存する。
- **受け入れ条件**:
  - [ ] MarkdownPreview 表示中にスクロール → 他タブへ切替 → 元タブに戻すと保存済み位置に復元される
  - [ ] CodeViewer 表示中にスクロール → 他タブへ切替 → 元タブに戻すと保存済み位置に復元される
  - [ ] PlainTextViewer 表示中にスクロール → 他タブへ切替 → 元タブに戻すと保存済み位置に復元される

#### F-2: タブアクティブ時に保存済みスクロール位置を復元する

- **説明**: タブがアクティブになった直後、そのタブに保存済みの `scrollTop` を復元する。初回オープンのタブは上端（`scrollTop = 0`）から表示する。
- **受け入れ条件**:
  - [ ] A.md を下までスクロール → B.md タブに切替 → B.md は上端から表示される
  - [ ] A.md に戻ると、A.md は前回スクロールしていた位置に復元される
  - [ ] コンテンツが再レンダリングされた直後でもチラつきなく復元される（1フレーム以内が望ましい）

#### F-3: スクロール位置を保持するビューアの範囲

- **説明**: スクロール記憶の対象は `MarkdownPreview` / `CodeViewer` / `PlainTextViewer` の 3 種類。`ImageViewer` は単一画像で実質スクロールしないため対象外。
- **受け入れ条件**:
  - [ ] 対象 3 ビューアすべてで保存・復元が動作する
  - [ ] 画像タブに切り替えても他タブの記憶済み位置が破壊されない

#### F-4: タブ閉じ時の状態クリーンアップ

- **説明**: タブを閉じたとき、そのタブに紐付いた `scrollTop` も一緒に破棄する（ストア内に残らない）。
- **受け入れ条件**:
  - [ ] タブを閉じるとそのタブの `scrollTop` がストアから除去される
  - [ ] 残ったタブのスクロール位置は影響を受けない

#### F-5: 分割表示・再オープン時の挙動

- **説明**: 分割表示での左右ペイン間移動や、`moveTab` による付け替え時も、そのタブ自身の `scrollTop` は保持される（タブ ID を保持するため）。
- **受け入れ条件**:
  - [ ] primary → secondary にタブを移動しても、そのタブを表示したときに前回の位置が復元される
  - [ ] 同一ファイルを閉じて再度開いた場合は新規タブ扱いとなり上端から表示される（既存 `openFile` のタブ再利用条件内なら既存タブ扱いで位置が維持される）

### 非機能要件

- **パフォーマンス**:
  - スクロール中の保存処理がレンダリングやスクロールを阻害しないこと（イベントのたびに Zustand へ同期 set しない。非アクティブ化の直前にまとめて保存する設計を基本とする）。
  - 復元処理はタブ切替後 1〜2 フレーム以内に完了すること。
- **ユーザビリティ**: タブを行き来しても「どこまで読んだか」を失わない一貫した操作感を提供する。
- **保守性**: スクロール記憶ロジックはビューアごとに重複実装せず、共通化（カスタムフック等）できる形で実装すること。
- **外観・デザイン**: 復元時に「一瞬上端にジャンプしてから戻る」などのチラつきを避ける。`useLayoutEffect` 等でペイント前に `scrollTop` を書き戻すことを検討する。

## スコープ

### 対象

- コンテンツタブのスクロール位置を `contentStore` 上で保持する仕組みの追加
- `MarkdownPreview` / `CodeViewer` / `PlainTextViewer` のスクロール保存・復元実装
- `contentStore` のタブ閉じ処理でのクリーンアップ

### 対象外

- 分割レイアウト時の左右ペイン間でのスクロール同期
- ターミナルタブのスクロール記憶
- スクロール位置の永続化（アプリ再起動を跨いでの復元）

## 実装対象ファイル（予定）

- `src/stores/contentStore.ts` — `ContentTab` に `scrollTop` を追加、`setScrollTop` アクション追加、`closeTab` / `moveTab` / `closeTabByPath` の整合性確認
- `src/components/ContentView/MarkdownPreview.tsx` — スクロールコンテナに ref を付与し、保存・復元フックを適用
- `src/components/ContentView/CodeViewer.tsx` — 同上
- `src/components/ContentView/PlainTextViewer.tsx` — 同上
- `src/components/ContentView/useTabScroll.ts`（新規） — スクロール保存・復元を共通化するカスタムフック（実装方針次第で追加）
- `src/components/ContentView/ContentView.test.tsx` — 回帰テスト追加（任意）

## 依存関係

- 既存の `contentStore` 構造（`ContentTab` / `ContentGroup` / `primary` + `secondary`）
- 既存ビューアコンポーネントの DOM 構造（スクロールコンテナが各ビューアのルート要素）

## 既知の制約

- `MarkdownPreview` は `renderMarkdown` の非同期処理後に `html` がセットされ `dangerouslySetInnerHTML` で注入されるため、**HTML 注入完了後** に `scrollTop` を書き戻さないと位置が維持されない。
- `CodeViewer` も Shiki のハイライト処理が非同期のため同様。
- Markdown 内の画像や Mermaid 図のレンダリングにより、注入直後と最終レンダリング後で要素サイズが変わる可能性がある。要件上は注入直後の `scrollTop` 復元で十分だが、テスト中にズレが目立つ場合は調整を検討する。

## 参考資料

- `docs/steering/features/content-viewer.md` — コンテンツビューア機能仕様
- `docs/steering/02_functional_design.md` — UI/UX の期待仕様
- GitHub Issue: [#9 コンテンツタブ切替時にスクロール位置が前タブから引き継がれてしまう](https://github.com/sakamotchi/spec-prompt/issues/9)
