# 要件定義書 - macos-window-tabs-f1

## 概要

macOS ネイティブのウィンドウタブ統合機能のフェーズ F1 として、**`tabbingIdentifier` を 2 箇所（静的設定と動的ウィンドウ生成）に追加** するだけの最小フェーズ。

実装前の調査で、以下が既に実装済みであることが判明した（`docs/local/20260418-macOSウィンドウタブ統合/02_概要設計書.md` §0 参照）：

- `tauriApi.openNewWindow` による複数ウィンドウ生成（`src/lib/tauriApi.ts:144`）
- ツリー上のボタン / フォルダ右クリックからの新規ウィンドウ起動
- ウィンドウタイトル動的更新（`src/components/TreePanel/TreePanel.tsx:54`）
- 複数ウィンドウのセッション復元（`src/lib/windowSession.ts`）
- capabilities の `core:webview:allow-create-webview-window` / `core:window:allow-set-title`

したがって F1 の残タスクは **`tabbingIdentifier` を 2 箇所に追加するのみ** となる。ウィンドウタイトル書式がタブ名として正しく出るかの確認を付随で行う。

- 元仕様: `docs/local/20260418-macOSウィンドウタブ統合/01_要件定義書.md`, `02_概要設計書.md`, `03_WBS.md`
- WBS 対応: フェーズ F1（既存実装発覚により縮小）
- 対応する受け入れ基準（元要件 §7）: **2, 3, 10**

## 背景・目的

- 複数プロジェクトを並行参照するケースで、既に新規ウィンドウが開けるようになっているが、現状は Dock / Mission Control 上で個別ウィンドウとして散らばり、切り替えコストが高い。
- macOS の NSWindow `tabbingIdentifier` を **静的ウィンドウ定義と動的 `WebviewWindow` 生成の両方** に設定するだけで、既存の新規ウィンドウ機能がそのまま OS タブ統合対応になる。
- 新規ウィンドウ生成ショートカット（`⌘N`）と状態名前空間分離は F2 / F3 で引き続き対応する。

## 要件一覧

### 機能要件

#### F1-1: `tauri.conf.json` に `tabbingIdentifier` を追加

- **説明**: 静的ウィンドウ定義（`app.windows[0]`）に `tabbingIdentifier: "SpecPrompt"` を追加する。既存の `windows: ["main", "window-*"]` capabilities に合わせて `label: "main"` も明示する。
- **受け入れ条件**:
  - [ ] `src-tauri/tauri.conf.json` の `app.windows[0]` に `"label": "main"` が追加されている
  - [ ] 同定義に `"tabbingIdentifier": "SpecPrompt"` が追加されている
  - [ ] 既存フィールド（title / width / height / minWidth / minHeight / devtools / dragDropEnabled）は変更しない
  - [ ] `npx tauri dev` でアプリがクラッシュせず起動する

#### F1-2: `openNewWindow` の `WebviewWindow` options に `tabbingIdentifier` を追加

- **説明**: `src/lib/tauriApi.ts:149` の `new WebviewWindow(label, { ... })` に `tabbingIdentifier: 'SpecPrompt'` を追加する。Tauri v2 では `tauri.conf.json` の `tabbingIdentifier` は動的生成されたウィンドウには継承されないため、両方に明示が必要。
- **受け入れ条件**:
  - [ ] `src/lib/tauriApi.ts` の `openNewWindow` 内で `WebviewWindow` options に `tabbingIdentifier: 'SpecPrompt'` が設定されている
  - [ ] 既存オプション（url / title / width / height / resizable）は変更しない
  - [ ] 既存の `tauri://error` ハンドラは維持

#### F1-3: ウィンドウタイトル書式の確認と必要なら修正

- **説明**: `TreePanel.tsx:54` の現行タイトル書式 `SpecPrompt — {name}` がタブ名として正しく表示されるかを E2E で確認し、必要なら `{name} — SpecPrompt` に反転する。macOS はタイトルの `—` 以降をタブ名から切り詰める挙動があるため、現行書式ではタブ名が `SpecPrompt` 固定になる可能性がある。
- **受け入れ条件**:
  - [ ] E2E で 2 ウィンドウ統合し、タブ名を目視確認
  - [ ] タブ名にプロジェクト名が出ていれば現行書式維持（差分 0 行）
  - [ ] タブ名が `SpecPrompt` 固定になっていたら `TreePanel.tsx:54` を `{name} — SpecPrompt` に変更

#### F1-4: ユニットテスト（任意）

- **説明**: `openNewWindow` が `tabbingIdentifier: 'SpecPrompt'` 付きで `WebviewWindow` を呼ぶことをモックで検証する。既存の `tauriApi` テストの有無に応じて追加／スキップを判断。
- **受け入れ条件**:
  - [ ] 既存テストファイルがあれば追加、なければ F1 では見送り（OS 機能依存のため、手動 E2E で十分）

#### F1-5: 手動 E2E と動作確認・ユーザー確認・コミット

- **説明**: `testing.md` の手順で受け入れ基準 2, 3, 10 を確認し、ユーザー承認後にコミット。
- **受け入れ条件**:
  - [ ] `testing.md` 全ケース OK
  - [ ] `npm run lint` が差分ファイルでエラーなし
  - [ ] `npm run build`（型チェック含む）がエラーなし
  - [ ] `npx vitest run` がパス
  - [ ] `cd src-tauri && cargo check` がパス
  - [ ] ユーザー承認後にコミット（`feature/macos-window-tabs` ブランチ）

### 非機能要件

- **パフォーマンス**: 設定追加のみのため、起動時間・レンダリング性能に影響なし。
- **ユーザビリティ**: macOS システム設定「タブで開く」が Manually でも Window > Merge All Windows で手動統合できる。Tauri Issue #6548（In Full Screen Only 時の不具合）は既知としてドキュメント化。
- **保守性**: `tabbingIdentifier` リテラル `"SpecPrompt"` を 2 箇所にハードコード。将来的に定数化する場合は `src/lib/tauriApi.ts` 側で `export const TABBING_IDENTIFIER = 'SpecPrompt'` として `tauri.conf.json` 側とコメントで紐付ける形が望ましい（F1 では簡潔さを優先し、ハードコードのまま）。
- **外観・デザイン**: UI 変更なし。

### F1 で扱わない項目（後続フェーズ）

- **F2**: `⌘N` / `File > New Window` メニュー・ショートカット追加、i18n キー `menu.file.newWindow`
- **F3**: Zustand persist キーの `:{label}` 名前空間分離、PTY マネージャ実装確認
- **F4**: `⌘W` ↔ `Ctrl+W` 整理、Windows / Linux 回帰確認、`CLAUDE.md` 追記
- **F5（v1.1 候補）**: config.json Rust Mutex、localStorage クリーンアップ、persist キーマイグレーション

## スコープ

### 対象

- `src-tauri/tauri.conf.json` への `label` / `tabbingIdentifier` 追加
- `src/lib/tauriApi.ts` の `openNewWindow` への `tabbingIdentifier` 追加
- 必要ならタイトル書式の反転（`TreePanel.tsx:54`）
- 手動 E2E（Merge All Windows、ツリーボタンからの統合確認）

### 対象外

- 新規ウィンドウ生成 API の新設（既存 `openNewWindow` を流用）
- メニュー・ショートカット（F2）
- 状態の名前空間分離（F3）
- Rust 側の変更（capabilities も既に揃っている）

## 実装対象ファイル（予定）

**変更**
- `src-tauri/tauri.conf.json` — `label` / `tabbingIdentifier` 追加
- `src/lib/tauriApi.ts` — `openNewWindow` options に `tabbingIdentifier` 追加
- （条件付き）`src/components/TreePanel/TreePanel.tsx` — タイトル書式の反転（E2E 結果次第）

**新設**
- なし（`useWindowTitle` 的なフックは既存実装で賄われているため不要）

**参照のみ**
- `src/components/TreePanel/TreePanel.tsx:54` — タイトル更新の既存実装
- `src/lib/windowSession.ts` — セッション復元の既存実装
- `src-tauri/capabilities/default.json` — 既に権限付与済み

## 依存関係

- Tauri v2 の `tabbingIdentifier` サポート（標準機能、追加パッケージ不要）
- `@tauri-apps/api/webviewWindow.WebviewWindow`（既存依存）

## 既知の制約

- Tauri v2 は `NSWindow.tabbingMode` を API で露出しない。したがって自動タブ化はユーザーの macOS システム設定「書類をタブで開く」に依存する（"常に" 以外では手動統合が必要）。VS Code 同等の自動タブ化は v1.1（F5）で `objc2` 経由の明示セットを検討。
- Tauri v2 Issue [#6548](https://github.com/tauri-apps/tauri/issues/6548): macOS システム設定「タブで開く」が "In Full Screen Only" のとき `tabbingIdentifier` が動作しない既知バグ。F1 ではドキュメント案内に留める。
- F1 段階では Zustand persist が全ウィンドウで `spec-prompt-app-store` を共有するため、2 ウィンドウ同時に状態が書かれるとレースが起きる。ただし既存の `windowSession.ts` は projectRoot を個別管理しているので、F1 の検証シナリオでは致命ではない。解消は F3。
- 同一プロセス内の複数ウィンドウしか NSWindow タブ統合対象にならない（`npx tauri dev` と `.app` 起動は別プロセスのため統合不可）。E2E ではツリーヘッダの「新規ウィンドウ」ボタンで 2 つ目を生成する手順を採用する。

## 参考資料

- `docs/local/20260418-macOSウィンドウタブ統合/01_要件定義書.md` — 要件定義
- `docs/local/20260418-macOSウィンドウタブ統合/02_概要設計書.md` — 概要設計（§0 事前調査結果）
- `docs/local/20260418-macOSウィンドウタブ統合/03_WBS.md` — WBS
- Tauri v2 公式: https://v2.tauri.app/learn/window-customization/
- Tauri Issue #6548: https://github.com/tauri-apps/tauri/issues/6548
- Apple Developer: https://developer.apple.com/documentation/appkit/nswindow/1644704-tabbingidentifier
