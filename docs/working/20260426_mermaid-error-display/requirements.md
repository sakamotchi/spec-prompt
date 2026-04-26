# 要件定義書 - mermaid-error-display

## 概要

マークダウンプレビューに含まれる Mermaid コードブロックに構文エラーがあるとき、現在は元のコードブロックがそのままテキスト表示されるだけで原因が分からない。本機能では、Mermaid のレンダリング失敗時にエラーメッセージを画面上に表示し、ユーザーが構文エラーの原因を特定できるようにする。

## 背景・目的

- `MarkdownPreview` の Mermaid レンダリング処理（`src/components/ContentView/MarkdownPreview.tsx`）は `mermaid.render()` の例外を try/catch で握りつぶしている。結果として、構文エラーがあると `<pre><code class="language-mermaid">...</code></pre>` のままになり、なぜダイアグラムが描画されないのかユーザーには伝わらない。
- ローカルで Mermaid を書きながら確認する用途で SDDesk を使うケースが多く、エラー位置・エラー内容がその場で見える方が編集ループが速くなる。
- 仕様書 `docs/steering/features/content-viewer.md` の `CV-02`（Mermaid ダイアグラム要件）にもエラー時の挙動は明記されていないため、仕様の補強も兼ねる。

## 要件一覧

### 機能要件

#### F-1: Mermaid 構文エラーをプレビュー上に表示する

- **説明**: Mermaid コードブロックのレンダリングに失敗した場合、元の `<pre>` をエラー表示用パネルに置き換え、Mermaid から得られたエラーメッセージを表示する。
- **受け入れ条件**:
  - [ ] 構文エラーを含む Mermaid コードブロックを表示すると、エラーパネルが描画される
  - [ ] エラーパネルには「Mermaid 構文エラー」など分かりやすい見出しが表示される
  - [ ] Mermaid から得られたエラーメッセージ（例: `Parse error on line 2: ...`）が表示される
  - [ ] 構文が正しい Mermaid コードブロックは従来どおり SVG で表示される（既存挙動の回帰なし）

#### F-2: 元のコードを参照できる

- **説明**: エラーが起きた Mermaid のソースコードをエラーパネルから確認できるようにする。デフォルトは折りたたみ表示として、画面占有を最小限にする。
- **受け入れ条件**:
  - [ ] エラーパネル内に「元のコード」を展開する `<details>` セクションが含まれる
  - [ ] 展開すると入力された Mermaid コード全文が等幅フォントで表示される
  - [ ] 元のコードはエスケープされ、HTML として解釈されない

#### F-3: レンダリング失敗時の副作用を残さない

- **説明**: `mermaid.render()` が失敗すると Mermaid が DOM に一時要素（`#<id>` や `#d<id>` 等）を残す場合がある。次回レンダリングや別タブ表示時に影響しないよう、失敗時にこれらを掃除する。
- **受け入れ条件**:
  - [ ] エラー発生後に再度プレビューを表示しても、過去の Mermaid 一時要素が残らない
  - [ ] 同じファイルにエラー Mermaid と正常 Mermaid が混在していても、正常側は従来どおり描画される

### 非機能要件

- **パフォーマンス**: エラー表示処理は同期的な DOM 置換のみで完結し、追加のネットワーク通信や Rust IPC 呼び出しを発生させない。
- **ユーザビリティ**: エラーメッセージは Mermaid 由来の文言をそのまま提示する（翻訳やラップは行わない）。長文でも改行が崩れないよう `pre`/`white-space: pre-wrap` で表示する。
- **保守性**: 既存の Mermaid レンダリング処理（`useEffect` 内）に閉じた変更とし、新規ファイル・新規ストアは追加しない。
- **外観・デザイン**: 既存テーマ変数（`--color-bg-elevated`, `--color-border`, `--color-text-primary`, `--color-text-muted` 等）を流用し、ライト/ダーク双方で視認できるエラーパネルとする。アクセシビリティ用に `role="alert"` を付与する。

## スコープ

### 対象

- `src/components/ContentView/MarkdownPreview.tsx` の Mermaid レンダリング `useEffect` 内 catch 句の挙動変更
- エラーパネル用の最小限のスタイル追加（`src/index.css` もしくは同コンポーネント内の Tailwind クラス）

### 対象外

- Mermaid コードブロック専用のエディタ/オートコンプリート機能
- Mermaid 構文の事前バリデーション（保存時チェックなど）
- エラー位置（行番号）への自動ジャンプ機能
- Mermaid 以外のコードブロック（コードハイライト失敗等）への汎用エラー表示

## 実装対象ファイル（予定）

- `src/components/ContentView/MarkdownPreview.tsx` — Mermaid レンダリング処理の catch 句を実装変更
- `src/index.css` — `.mermaid-error` 用のスタイル追加（必要な場合）

## 依存関係

- 既存依存: `mermaid`（`mermaid.render()` の reject 値からエラーメッセージを取得）
- 新規依存追加なし

## 既知の制約

- Mermaid のエラー文言は英語固定。i18n は対象外とし、原文をそのまま表示する。
- `mermaid.render()` が DOM に残す一時要素の ID 命名は Mermaid のバージョン依存。掃除ロジックは「現在の Mermaid バージョンで観測される ID パターン」に対するベストエフォートとする。

## 参考資料

- `docs/steering/features/content-viewer.md` — `CV-02` Mermaid ダイアグラム
- `src/components/ContentView/MarkdownPreview.tsx:69-90` — 既存の Mermaid レンダリング処理
