# 要件定義書 - Phase 2-A: コンテンツビューア

## 概要

ファイルツリーで選択したファイルをコンテンツペインに表示する機能を実装する。ファイルの拡張子に応じて **マークダウンプレビュー**・**コードビューア**・**プレーンテキストビューア** を自動切り替えする。

## 背景・目的

Phase 1 完了時点では、コンテンツペインには「コンテンツビューア（Phase 2-A で実装）」というプレースホルダーのみ表示されている。SpecPrompt の中核価値である「仕様書を見ながらAIと対話する」を実現するため、MDファイルのレンダリング表示が最優先タスクとなる。

## 要件一覧

### 機能要件

#### F-1: ファイル読み込み（`read_file` コマンド）

- **説明**: ファイルツリーでファイルを選択すると、バックエンドの `read_file` コマンドを呼び出してファイル内容を取得する。
- **受け入れ条件**:
  - [x] `read_file(path)` コマンドが既に実装済み（Phase 1-B で実装）
  - [ ] フロントエンドから `invoke('read_file', { path })` でファイル内容を取得できる
  - [ ] 取得したコンテンツを `contentStore` に保存する

#### F-2: 表示モード自動判定

- **説明**: ファイルの拡張子から表示モード（markdown / code / plain）を判定し、適切なコンポーネントを選択する。
- **受け入れ条件**:
  - [ ] `.md`, `.mdx` → `MarkdownPreview`
  - [ ] `.ts`, `.tsx`, `.js`, `.jsx`, `.rs`, `.py`, `.go`, `.json`, `.toml`, `.yaml`, `.yml`, `.css`, `.html`, `.sql` 等 → `CodeViewer`
  - [ ] それ以外のテキストファイル → `PlainTextViewer`

#### F-3: マークダウンプレビュー

- **説明**: `unified`（remark + rehype）パイプラインで Markdown → HTML に変換して表示する。
- **受け入れ条件**:
  - [ ] 見出し・箇条書き・テーブル・コードブロックが正しくレンダリングされる
  - [ ] GFM（GitHub Flavored Markdown）のテーブルが表示される
  - [ ] MDファイル内のコードブロックに Shiki シンタックスハイライトが適用される
  - [ ] リンクはデフォルトブラウザで開く（Tauri `opener` プラグイン使用）
  - [ ] Mermaid コードブロック（` ```mermaid `）が SVG 図としてレンダリングされる（CV-02）

#### F-4: コードビューア

- **説明**: Shiki によるシンタックスハイライト付きのコード表示（読み取り専用）。
- **受け入れ条件**:
  - [ ] 拡張子から言語を自動判定してシンタックスハイライトが適用される
  - [ ] 行番号が左端に表示される
  - [ ] テキスト編集ができない（表示専用）

#### F-5: プレーンテキストビューア

- **説明**: シンタックスハイライトなしの等幅フォントによるテキスト表示。
- **受け入れ条件**:
  - [ ] Geist Mono フォントで等幅表示される
  - [ ] 長い行が折り返しまたは横スクロールで表示される

#### F-6: `contentStore` 実装

- **説明**: コンテンツビューアの状態（現在のファイルパス・コンテンツ・表示モード）を Zustand で管理する。
- **受け入れ条件**:
  - [ ] `selectedFile`（`appStore`）変更時に自動でファイルを読み込む
  - [ ] コンテンツを store に保持し、同ファイルの再読み込みを抑制する（キャッシュ）

### 非機能要件

- **パフォーマンス**: Shiki のハイライト処理を `useMemo` でキャッシュする（NFR-03: 500ms 以内）
- **ユーザビリティ**: ファイル切り替え時にローディング状態を表示しない（即時表示）
- **外観・デザイン**: 既存の CSS カスタムプロパティ（`--color-bg-base`, `--color-text-primary` 等）を使用。マークダウンスタイルは `prose` 相当のスタイルを手動定義

## スコープ

### 対象

- `MarkdownPreview` コンポーネント（Mermaid 含む）
- `CodeViewer` コンポーネント（Shiki）
- `PlainTextViewer` コンポーネント
- `contentStore.ts`（ファイル内容・表示モードの状態管理）
- `src/lib/markdown.ts`（unified パイプライン設定）

### 対象外

- コンテンツの複数タブ管理（Phase 2-C で実装）
- コンテンツの分割表示（Phase 2-C で実装）
- ファイル監視・自動更新（Phase 2-B で実装）
- ファイル編集機能（スコープ外）

## 実装対象ファイル（予定）

- `src/components/ContentView/ContentView.tsx`（新規）
- `src/components/ContentView/MarkdownPreview.tsx`（新規）
- `src/components/ContentView/CodeViewer.tsx`（新規）
- `src/components/ContentView/PlainTextViewer.tsx`（新規）
- `src/components/ContentView/index.ts`（新規）
- `src/stores/contentStore.ts`（新規）
- `src/lib/markdown.ts`（新規）
- `src/components/MainArea/MainArea.tsx`（contentNode を `<ContentView />` に差し替え）

## 依存関係

- `appStore.ts` の `selectedFile` — ファイルツリーで選択されたファイルパス
- `read_file` Tauri コマンド（Phase 1-B で実装済み）
- npm パッケージ: `unified`, `remark-parse`, `remark-gfm`, `remark-rehype`, `rehype-shiki`, `rehype-stringify`, `shiki`（未インストールの可能性あり）

## 既知の制約

- Mermaid は動的インポート（`import('mermaid')`）で遅延読み込みすること（バンドルサイズ対策）
- Shiki はバンドルサイズが大きいため、使用する言語・テーマを必要最小限に絞ること

## 参考資料

- `docs/steering/features/content-viewer.md` — 詳細仕様
- `docs/steering/03_architecture_specifications.md` — 技術スタック
