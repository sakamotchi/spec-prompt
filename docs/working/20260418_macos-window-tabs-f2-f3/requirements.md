# 要件定義書 - macos-window-tabs-f2-f3

## 概要

macOS ネイティブウィンドウタブ統合のフェーズ **F2**（`⌘N` による新規ウィンドウ生成）と **F3**（Zustand persist のウィンドウ名前空間分離）を 1 PR に統合して実装する。

WBS（`docs/local/20260418-macOSウィンドウタブ統合/03_WBS.md`）で F2 と F3 は同一 PR 推奨とされている（F3 なしで新規ウィンドウ導線が増えると、localStorage 競合で状態混線が表面化するため）。

- 元仕様: `docs/local/20260418-macOSウィンドウタブ統合/01_要件定義書.md`, `02_概要設計書.md`, `03_WBS.md`
- WBS 対応: F2（F2-1〜F2-5）+ F3（F3-1〜F3-7）
- 対応する受け入れ基準（元要件 §7）: **1, 6, 7**

## 背景・目的

### F2 の動機

- F1 で `tabbingIdentifier` を有効化済み。既存のツリーヘッダ「新規ウィンドウ」ボタンで統合動作も確認済み。
- macOS 標準の **`⌘N`（File > New Window）** が未実装のため、VS Code ユーザーにとって操作感が不完全。
- アプリメニューまたはグローバルショートカットで `⌘N` を提供し、既存 `openNewWindow` を呼び出せるようにする。

### F3 の動機

- 現状 `appStore` は `persist` の `name` を `spec-prompt-app-store` 固定で使っており、**複数ウィンドウ間で localStorage が共有**される。
- F1 完了時点でユーザーは複数ウィンドウを開けるが、例えばウィンドウ A で `activeMainTab` を切り替えるとウィンドウ B にも伝播してしまう（最後勝ちレース）。
- `windowSession.ts` は projectRoot のみを per-window に切り出しているが、`activeMainTab` / `mainLayout` / `selectedFile` / `expandedDirs` / `pathFormat` 等は共有されており、ウィンドウ独立作業が破綻する。
- Zustand `persist` の `name` を **`spec-prompt-app-store:${label}`** に名前空間化して解決する。

## 要件一覧

### 機能要件

#### F2-1: `⌘N` / `Ctrl+N` でグローバル新規ウィンドウ生成（WBS F2-4）

- **説明**: `AppLayout.tsx` に keydown リスナを追加し、`⌘N`（macOS）/ `Ctrl+N`（Win/Linux）で `tauriApi.openNewWindow()` を呼ぶ。
- **受け入れ条件**:
  - [ ] `(e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && (e.key === 'n' || e.key === 'N')` で判定
  - [ ] `tauriApi.openNewWindow()` を引数なし（= 空の新規ウィンドウ）で呼ぶ
  - [ ] プロンプト編集パレット表示中（`usePromptPaletteStore.isOpen`）・`PathPalette` 表示中は no-op
  - [ ] テキスト入力中（textarea / input フォーカス時）は OS 標準の `⌘N` 動作に任せる（preventDefault しない）— ただし SpecPrompt には編集可能な input がほぼないため、実運用では常に新規ウィンドウを開く挙動でよい
  - [ ] 既存の他ショートカット（`Ctrl+Tab`, `Cmd+Shift+P`, `Ctrl+P`, `F2`）と干渉しない

#### F2-2: アプリメニュー `File > New Window` 追加（WBS F2-3）

- **説明**: Tauri Menu API で macOS メニューバーに `File > New Window`（`⌘N`）を追加する。現状アプリは Tauri のデフォルトメニューを使っているため、カスタムメニュー構築を行う。
- **受け入れ条件**:
  - [ ] `src-tauri/src/lib.rs` の `setup` hook で Tauri Menu API を使ってメニューを構築
  - [ ] macOS: アプリ名メニューの後ろに `File` サブメニューを追加し、`New Window`（accelerator `CmdOrCtrl+N`）を配置
  - [ ] Windows / Linux: 同様に `File > New Window` を表示
  - [ ] メニュー項目のアクションは JS 側に `menu-new-window` イベントを emit → フロントが受け取って `tauriApi.openNewWindow()` を呼ぶ
  - [ ] 既存の標準メニュー項目（Edit > Copy/Paste、Window > Minimize/Zoom 等）は維持される

> v1 実装判断: F2-1 の JS 側ショートカットのみで機能としては成立するが、macOS では **メニューバーに出ていないショートカットはガイダンス性が低い**ため F2-2 も同一 PR で入れる。時間がなければ F2-2 を省略して F2-1 のみにするオプションもあり（tasklist 側で判断）。

#### F2-3: i18n（WBS F2-5）

- **説明**: メニュー・ショートカット一覧に表示する文字列を i18n 対応する。
- **受け入れ条件**:
  - [ ] `src/i18n/locales/ja.json` に `menu.file.label` = `"ファイル"`, `menu.file.newWindow` = `"新規ウィンドウ"` を追加
  - [ ] `src/i18n/locales/en.json` に `menu.file.label` = `"File"`, `menu.file.newWindow` = `"New Window"` を追加
  - [ ] ショートカット一覧モーダル（`ShortcutsModal`）に `⌘N / Ctrl+N: 新規ウィンドウ` を追加

#### F3-1: `appStore` の persist キーをウィンドウラベル分離（WBS F3-1）

- **説明**: Zustand `persist` の `name` をウィンドウラベル付きに変更し、ウィンドウごとに独立した localStorage エントリにする。
- **受け入れ条件**:
  - [ ] `src/stores/appStore.ts:205` の `name: 'spec-prompt-app-store'` を動的生成 `` `spec-prompt-app-store:${getCurrentWindow().label}` `` に変更
  - [ ] モジュールトップレベルでラベル取得し、`persist` 生成時に 1 回だけ評価（毎レンダー評価は不要）
  - [ ] 既存の `partialize` / `storage`（カスタム replacer/reviver）は維持
  - [ ] F1 で追加した `label: "main"` によってメインウィンドウは `spec-prompt-app-store:main` になる
  - [ ] 新規ウィンドウ（`window-{timestamp}-{rand}` ラベル）はそれぞれ独立キー

#### F3-2: 既存 localStorage キーのマイグレーション（任意）

- **説明**: F1 以前のユーザーは `spec-prompt-app-store`（suffix なし）に状態を持つ。新キー `spec-prompt-app-store:main` に自動移行する。
- **受け入れ条件**:
  - [ ] モジュール初期化時に一度だけ実行：旧キーが存在かつ新キー（`:main`）が無い場合、内容をコピー → 旧キー削除
  - [ ] v1.1 に先送りしてもよい（F3 時点ではメインウィンドウが空状態で起動するのが許容なら不要）
  - [ ] 実装する場合はユニットテストで migration 挙動を検証

> 実装判断: ユーザー体験を崩さないためマイグレーションは入れる方向で実装する。コストは低い（10 行程度）。

#### F3-3: PTY マネージャの ID 衝突確認（WBS F3-5）

- **説明**: `src-tauri/src/commands/pty.rs` を読み、`spawn_pty` が返す PTY ID が全プロセスで一意か確認する。
- **受け入れ条件**:
  - [ ] 実装確認のみ（コード変更なし予定）。UUID ベースであれば問題なし
  - [ ] ウィンドウごとにスコープ化されていた場合は、変更が必要と判断し tasklist に追加

#### F3-4: 動作確認 E2E（WBS F3-6）

- **説明**: 複数ウィンドウで別プロジェクトを開き、状態が独立していることを確認する。
- **受け入れ条件**:
  - [ ] ウィンドウ A でプロジェクト A を開く、ウィンドウ B でプロジェクト B を開く
  - [ ] A で `activeMainTab` を「ターミナル」に切替、B で「コンテンツ」のまま → 互いに伝播しない
  - [ ] A の `expandedDirs` が B に漏れない
  - [ ] A でターミナルタブを増やしても B に表示されない
  - [ ] `windowSession.ts` の復元動作が引き続き機能する

### 非機能要件

- **パフォーマンス**: `getCurrentWindow().label` はモジュール初期化時に 1 回同期的に読むだけのため、ランタイム影響なし。persist キー変更による localStorage 読み書きオーバーヘッドは変わらない。
- **ユーザビリティ**: `⌘N` は VS Code / Finder / Safari など多くの macOS アプリで「新規ウィンドウ」を意味するため、学習コストなし。メニューバーからも到達可能。
- **保守性**: `appStore` のみが persist を使っている現状で分離対象は最小。将来 `contentStore` / `terminalStore` が persist するようになった場合も同じパターン（label 付きキー）で対応可能。
- **互換性**: F3-2 でマイグレーションを入れることで既存ユーザーの状態が保全される。

### F2+F3 で扱わない項目（後続フェーズ）

- **F4**: `⌘W` ↔ `Ctrl+W` 整理、Windows / Linux 回帰確認、`CLAUDE.md` 追記
- **F5**: config.json Rust Mutex、localStorage クリーンアップ、`NSWindow.tabbingMode = .preferred`（objc2）
- **スコープ外**: `contentStore` / `terminalStore` を persist 化すること（現状は揮発性でよい設計）

## スコープ

### 対象

- `⌘N` / `Ctrl+N` グローバルショートカット
- Tauri Menu API による `File > New Window`
- i18n キー追加（ja / en）
- ショートカット一覧への追記
- `appStore` の persist `name` をラベル付きに変更
- 旧キー → 新キーの自動マイグレーション
- PTY ID 実装確認（変更なし予定）

### 対象外

- 新規ウィンドウ生成 API（F1 で既存利用）
- `tabbingMode` の強制設定（F5）
- `⌘W` 整理（F4）
- Windows / Linux 回帰確認（F4）

## 実装対象ファイル（予定）

**変更**
- `src/components/Layout/AppLayout.tsx` — `⌘N` keydown リスナ追加、menu イベント購読
- `src/stores/appStore.ts` — persist `name` をラベル付きに変更、マイグレーション追加
- `src/i18n/locales/ja.json` / `en.json` — `menu.file.*` 追加
- `src/lib/shortcuts.ts` — `newWindow` エントリ追加
- `src/components/KeyboardShortcuts/ShortcutsModal.tsx` — 新エントリ表示（`shortcuts.ts` 経由なら自動）
- `src-tauri/src/lib.rs` — Tauri Menu 構築 + `menu-new-window` emit

**新設**
- なし（必要に応じて `src/lib/appMenu.ts` などを切り出してもよいが、規模的に不要）

**参照のみ**
- `src/lib/tauriApi.ts#openNewWindow` — F1 で `tabbingIdentifier` 設定済み
- `src/lib/windowSession.ts` — projectRoot の per-window 保存
- `src/stores/promptPaletteStore.ts` — no-op 条件判定
- `src-tauri/src/commands/pty.rs` — PTY ID 確認のため

## 依存関係

- Tauri v2 Menu API（`tauri::menu`）
- `@tauri-apps/api/menu` — フロント側（必要なら）
- `@tauri-apps/api/window.getCurrentWindow()` — ラベル取得
- `@tauri-apps/api/event.listen` — menu-new-window イベント購読

## 既知の制約

- Tauri v2 Menu API は Rust 側で構築する必要があり、純粋にフロント側だけでは完結しない。`setup` hook で構築 → イベントでフロントに通知する流れ。
- 旧キーのマイグレーションは**初回アプリ起動時のメインウィンドウでのみ**実行する（label=main のときのみ）。他ウィンドウで実行すると旧状態が誤ってコピーされるリスク。
- persist の `name` を変更すると、macOS 更新版を入れた既存ユーザーは一瞬「設定がリセット」されたように見える。マイグレーション（F3-2）でこれを防ぐ。
- F2+F3 実装後、**ウィンドウを閉じると `spec-prompt-app-store:window-xxxxx` エントリが localStorage に残り続ける**。クリーンアップは F5 で対応。

## 参考資料

- `docs/local/20260418-macOSウィンドウタブ統合/01_要件定義書.md` — 要件定義
- `docs/local/20260418-macOSウィンドウタブ統合/02_概要設計書.md` — 概要設計（§0 事前調査）
- `docs/local/20260418-macOSウィンドウタブ統合/03_WBS.md` — WBS
- `docs/working/20260418_macos-window-tabs-f1/` — F1 作業ドキュメント
- Tauri v2 Menu: https://v2.tauri.app/learn/window-menu/
- Tauri v2 Configuration: https://v2.tauri.app/reference/config/
- `src/lib/tauriApi.ts:144` — `openNewWindow` 既存実装
- `src/lib/windowSession.ts` — セッション復元
- `src/stores/appStore.ts:205` — 対象の persist 定義
