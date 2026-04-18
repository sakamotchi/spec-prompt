# タスクリスト - macos-window-tabs-f2-f3

WBS（`docs/local/20260418-macOSウィンドウタブ統合/03_WBS.md`）の F2（F2-1〜F2-5）と F3（F3-1〜F3-7）を単一 PR で実装する。各タスク完了後は **必ずユーザー確認を得てから** コミット・マージする（CLAUDE.md 規約）。

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 9 |
| 進行中 | 0 |
| 未着手 | 0 |

## タスク一覧

### T-1: 要件定義・設計

- [x] 要件定義書の作成（`requirements.md`）
- [x] 設計書の作成（`design.md`）
- [x] テスト手順書の作成（`testing.md`）
- [x] ユーザーレビュー

### T-2: `⌘N` グローバルショートカット（WBS F2-1, F2-4）→ **menu accelerator に一本化**

- [x] 当初は AppLayout.tsx の keydown に `⌘N` を追加したが、menu accelerator と二重発火して 1 回押下で 2 ウィンドウ生成するバグが発覚
- [x] JS 側の `⌘N` 分岐は削除。`File > New Window` の `CmdOrCtrl+N` accelerator（T-3）に一本化
- [x] パレット表示中の抑止は menu accelerator が webview から独立して発火するため効かない → 「パレット表示中でも `⌘N` で新規ウィンドウが開く」macOS 標準挙動を受け入れ

### T-3: アプリメニュー `File > New Window`（WBS F2-3）

- [x] `src-tauri/src/lib.rs` の `setup` hook で `MenuBuilder` 構築
- [x] macOS: App サブメニュー（About / Services / Hide / Quit）
- [x] `File > New Window`（accelerator `CmdOrCtrl+N`、id `new-window`）
- [x] `Edit` サブメニュー（Undo/Redo/Cut/Copy/Paste/SelectAll 標準 predefined）
- [x] `Window` サブメニュー（`SubmenuBuilder::with_id(app, WINDOW_SUBMENU_ID, "Window")` で macOS に Window メニューと認識させ、Show Tab Bar / Merge All Windows 等を自動挿入）
- [x] macOS 向け View サブメニュー（`fullscreen`）
- [x] `app.on_menu_event` で `new-window` id 検知 → `app.emit("menu-new-window", ())`
- [x] `AppLayout.tsx` で `listen("menu-new-window", ...)` を購読 → `openNewWindow()`
- [x] **`app.emit` が全ウィンドウにブロードキャストする性質で多重発火する問題** → JS 側 listener で `await getCurrentWindow().isFocused()` ガードを追加し、フォーカスされたウィンドウのみが `openNewWindow()` を呼ぶように修正
- [x] `cd src-tauri && cargo check` がパス

### T-4: i18n とショートカット一覧（WBS F2-5）

- [x] `src/lib/shortcuts.ts` に `newWindow` エントリ追加
- [x] `src/i18n/locales/ja.json` に `shortcuts.label.newWindow` 追加（「新規ウィンドウを開く」）
- [x] `src/i18n/locales/en.json` に `shortcuts.label.newWindow` 追加（"Open New Window"）
- [x] `menu.file.*` i18n はメニューが Rust 側で静的構築のためスキップ（英語固定「File > New Window」、v1.1 候補）
- [x] ショートカット一覧モーダルで表示確認

### T-5: `appStore` persist キー分離（WBS F3-1）

- [x] `src/stores/appStore.ts` のトップレベルで `getCurrentWindow().label` を取得
- [x] `name: 'spec-prompt-app-store'` → `name: \`spec-prompt-app-store:${label}\`` に変更
- [x] 既存の `partialize` / `storage`（replacer/reviver）は維持

### T-6: 旧キーマイグレーション（WBS F3-1 付随）

- [x] `appStore.ts` トップレベルで、`label === 'main'` のとき旧キー `spec-prompt-app-store` → 新キー `spec-prompt-app-store:main` へ 1 回限りコピー & 旧キー削除
- [x] 新キーが既に存在する場合は no-op（多重実行防止）

### T-7: ユニットテスト追加（WBS F3-4）

- [x] `src/test/setup.ts` に `@tauri-apps/api/window` グローバルモックを追加（label='main', isFocused, setTitle 等）
- [x] 既存の `appStore.test.ts` で使用している `spec-prompt-app-store` 直接参照を `spec-prompt-app-store:main` に更新
- [x] `persist キーがウィンドウラベル付き（main）である` テスト追加
- [x] `appStore migration (F3)` describe ブロックを追加（旧キー → main マイグレーション、既存キー保護、旧キー不在時 no-op の 3 ケース）
- [x] `npx vitest run` 全体 183/183 パス

### T-8: PTY マネージャ実装確認（WBS F3-5）

- [x] `src-tauri/src/commands/pty.rs` を確認：`next_id: Mutex<u32>` のインクリメント方式
- [x] `PtyManager` は `tauri::Builder::manage` でプロセス全体に単一登録されるため、全ウィンドウ横断で ID がユニーク
- [x] 変更不要

### T-9: 結合・動作確認・コミット（WBS F2-5, F3-6, F3-7）

- [x] `npm run lint` 差分ファイルでエラーなし（既存 `settingsStore.ts` の 1 件は pre-existing）
- [x] `npm run build`（型チェック含む）がエラーなし
- [x] `npx vitest run` が全件パス（183/183）
- [x] `cd src-tauri && cargo check` がパス
- [x] `npx tauri build` で `.app` 生成
- [x] `testing.md` の手動 E2E 実施（ユーザー確認完了、2026-04-18）
  - [x] `⌘N` で新規ウィンドウが 1 個だけ開く
  - [x] File > New Window メニューも動作
  - [x] パレット表示中の `⌘N` も正しく 1 個だけ開く（isFocused ガードが効く）
  - [x] 複数ウィンドウ（独立 / タブ統合済）のいずれでも 1 個だけ開く
  - [x] 複数ウィンドウで別プロジェクト → 状態が独立
  - [x] `windowSession.ts` の復元動作が維持
- [x] `testing.md` の確認結果を記録
- [x] ユーザー承認（2026-04-18）
- [x] `feature/macos-window-tabs` 上でコミット

### T-10: コミット分割（任意）

差分が大きい場合、以下の粒度で分割コミット：

1. T-2, T-4（一部）: `⌘N` ショートカットと i18n → `feat(window): ⌘N で新規ウィンドウを開く`
2. T-3: Tauri Menu 追加 → `feat(window): File メニューに New Window を追加`
3. T-5, T-6, T-7: persist キー分離とマイグレーション → `feat(window): appStore persist をウィンドウ別に分離`

単一コミットでまとめる場合は `feat(window): macOS ウィンドウタブ統合 F2+F3` のような集約メッセージでも可。

## 完了条件

- [x] 全タスクが完了
- [x] `npm run lint` 差分ファイルでエラーなし
- [x] `npm run build`（型チェック含む）がエラーなし
- [x] `npx vitest run` が全件パス（183/183）
- [x] `cd src-tauri && cargo check` がパス
- [x] `testing.md` の手動テストが全件 OK
- [x] ユーザー承認済み

## PR 粒度（参考、WBS より）

- **PR-F2F3**: F2 + F3 を単一 PR に統合（WBS 推奨）
  - 実装が大きくなる場合は上記 T-10 の分割コミットで整理
- F1 の PR（`feature/macos-window-tabs` の既存コミット）と同一ブランチで追加コミット

## 備考

### F2-2 の扱い判断

Tauri Menu API はコードが少し複雑で、設計書で示したスケルトンでも 60〜80 行規模になる。時間がない場合の簡易版：

- **最小版**: T-2（`⌘N` ショートカット）のみ。`File > New Window` メニューは F4（macOS 標準メニューのカスタマイズ）に回す。
- **中庸版**: T-2 + T-3 のうち `File` サブメニューだけ追加、`Edit` / `Window` は Tauri の default メニューを残す。
- **フル版**: T-3 全部。

本番 PR はユーザーの判断で選択。設計書はフル版を前提に書いているが、実装時に最小版に絞ることも可能。

### F3 の影響範囲

persist 分離の対象は `appStore` のみ（他のストアは persist 未使用）。変更箇所は localStorage の key 名のみで、ストアのロジック・型・UI コンポーネントへの影響はゼロ。

ただし既存ユーザーの localStorage 状態が新キーに移行されないと「アプリを更新したら設定が消えた」ように見えるため、T-6 のマイグレーションは必ず入れる。
