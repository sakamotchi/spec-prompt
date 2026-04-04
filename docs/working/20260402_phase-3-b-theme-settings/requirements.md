# 要件定義書 - Phase 3-B: テーマ・外観設定

## 概要

ダーク/ライトテーマの切り替え・コンテンツフォント設定・ターミナルフォント設定を設定モーダルから変更できるようにする。設定は `config.json` に永続化する。

## 背景・目的

現状、アプリ全体がダークテーマ固定で、フォントサイズ・フォントファミリーも変更できない。長時間の仕様書レビューや環境の照明条件に応じてテーマを切り替えられること、また読みやすいフォントサイズに調整できることは、開発者の作業効率に直結する。

## 要件一覧

### 機能要件

#### F-1: 設定モーダル UI

- **説明**: ギアアイコンをクリックするとモーダルが開き、外観設定を変更できる。
- **受け入れ条件**:
  - [ ] TreePanel ヘッダーにギアアイコン（⚙）ボタンを追加する
  - [ ] クリックで設定モーダルが開く（Radix UI `Dialog` を使用）
  - [ ] モーダルは「テーマ」「コンテンツ」「ターミナル」の3セクション構成
  - [ ] モーダル外クリックまたは `Esc` で閉じる

#### F-2: ダーク/ライトテーマ切り替え

- **説明**: `dark` / `light` / `system` の3択でテーマを切り替える。
- **受け入れ条件**:
  - [ ] 3択のトグルボタン（dark / light / system）で選択できる
  - [ ] `dark` / `light` は即座に `<html data-theme="...">` へ反映される
  - [ ] `system` は OS の `prefers-color-scheme` に追従する
  - [ ] ライトテーマの CSS カスタムプロパティを定義する
  - [ ] 設定は `config.json` に保存・起動時に復元される

#### F-3: コンテンツフォント設定

- **説明**: マークダウンプレビューとコードビューアに適用するフォントファミリーとサイズを変更できる。
- **フォントファミリー選択肢**: `Geist`（デフォルト）/ `Inter` / `system-ui`
- **フォントサイズ**: スライダーで 12〜20px
- **受け入れ条件**:
  - [ ] フォントファミリーをセレクトで変更できる
  - [ ] フォントサイズをスライダーで変更できる（現在値をラベル表示）
  - [ ] 変更がマークダウンプレビューとコードビューアに即座に反映される
  - [ ] 設定は `config.json` に保存・起動時に復元される

#### F-4: Shiki テーマ連動

- **説明**: アプリテーマに連動してコードハイライトのテーマを自動切り替えする。
- **受け入れ条件**:
  - [ ] `dark` テーマ時: `github-dark`
  - [ ] `light` テーマ時: `github-light`
  - [ ] テーマ切り替え時に Shiki プロセッサーが再初期化され、開いているファイルのハイライトが更新される

#### F-5: ターミナルフォント設定

- **説明**: xterm.js のフォントファミリーとフォントサイズを変更できる。
- **フォントファミリー選択肢**: `Geist Mono`（デフォルト）/ `Menlo` / `Courier New`
- **フォントサイズ**: スライダーで 11〜18px
- **受け入れ条件**:
  - [ ] フォントファミリー・サイズの変更が xterm.js にリアルタイム反映される
  - [ ] 変更後 `fitAddon.fit()` を呼んで表示を再計算する
  - [ ] 設定は `config.json` に保存・起動時に復元される

#### F-6: ターミナルのテーマ連動

- **説明**: アプリテーマに応じて xterm.js の背景色・文字色を切り替える。
- **受け入れ条件**:
  - [ ] `dark` テーマ時: 現在のハードコード値（background `#0d0d0d`, foreground `#e8e8e8`）
  - [ ] `light` テーマ時: 白背景（background `#ffffff`, foreground `#1a1a1a`）
  - [ ] テーマ切り替え時に xterm.js の `options.theme` が更新される

### 非機能要件

- **パフォーマンス**: テーマ切り替え時の再レンダリングは最小限。CSS カスタムプロパティによる切り替えはリペイントのみで済む。
- **ユーザビリティ**: 変更は即座にプレビューへ反映（保存ボタン不要・変更即時適用）。
- **外観・デザイン**: 設定モーダル自体も `--color-bg-elevated` 等のカスタムプロパティを使用し、テーマ切り替えと連動する。

## スコープ

### 対象

- `index.css` へのライトテーマ CSS 変数定義
- Rust `Config` 構造体への外観設定フィールド追加
- `get_appearance` / `save_appearance` Tauri コマンド
- `settingsStore.ts`（新規 Zustand ストア）
- `SettingsModal.tsx`（新規コンポーネント）
- `TreePanel.tsx`（ギアアイコンボタン追加）
- `markdown.ts`（Shiki テーマ動的切り替え）
- `TerminalPanel.tsx`（xterm.js テーマ・フォント動的化）

### 対象外

- Fira Code・JetBrains Mono などの外部フォントの読み込み（Phase 4 以降）
- ターミナルのカラースキーム個別設定（WBS 3-B-5 の詳細部分、テーマ連動のみ対応）
- フォント設定のプレビュー（設定モーダル内での即時確認）

## 実装対象ファイル（予定）

- `src/index.css`（変更: ライトテーマ変数追加）
- `src/main.tsx`（変更: 起動時テーマ適用）
- `src-tauri/src/commands/config.rs`（変更: 外観設定フィールド追加）
- `src-tauri/src/lib.rs`（変更）
- `src/lib/tauriApi.ts`（変更）
- `src/stores/settingsStore.ts`（新規）
- `src/components/Settings/SettingsModal.tsx`（新規）
- `src/components/TreePanel/TreePanel.tsx`（変更: ギアアイコン追加）
- `src/lib/markdown.ts`（変更: Shiki テーマ動的化）
- `src/components/TerminalPanel/TerminalPanel.tsx`（変更: テーマ・フォント動的化）

## 依存関係

- Phase 2-F: Config Manager（`config.json` 読み書き基盤が実装済み）
- Phase 2-A: コンテンツビューア（Shiki・MarkdownPreview が実装済み）
- Phase 1-C: ターミナル（xterm.js が実装済み）
