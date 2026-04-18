# macOS ウィンドウタブ統合機能仕様書

**バージョン**: 1.0
**作成日**: 2026年4月18日
**最終更新**: 2026年4月18日

---

## 1. 概要

macOS のネイティブウィンドウタブ機能（`NSWindow.tabbingIdentifier`）を利用し、複数の SpecPrompt ウィンドウを 1 つのウィンドウのタブに統合できるようにする機能。複数プロジェクトを並行して扱う場合のウィンドウ散乱を防ぐ。

**対応 OS**: macOS のみ（Windows / Linux では独立ウィンドウとして動作）

---

## 2. 機能要件

### 2.1 新規ウィンドウ生成

| 要件ID | 要件 | 詳細 |
|--------|------|------|
| WT-01 | キーボードショートカット | `⌘N`（macOS）/ `Ctrl+N`（Win/Linux）で新規ウィンドウを開く |
| WT-02 | メニュー経由 | File > New Window でも同じ動作 |
| WT-03 | UI ボタン | プロジェクトツリーヘッダの「新規ウィンドウ」ボタンで新規ウィンドウを開く |
| WT-04 | フォルダから開く | ツリーノードの右クリックメニュー「新規ウィンドウで開く」で、指定フォルダを初期プロジェクトにして新規ウィンドウを開く |

### 2.2 ウィンドウ間の状態分離

| 要件ID | 要件 | 詳細 |
|--------|------|------|
| WT-05 | プロジェクト独立 | 各ウィンドウは独立した `projectRoot` を持ち、他ウィンドウに伝播しない |
| WT-06 | UI 状態独立 | `activeMainTab`, `mainLayout`, `expandedDirs`, `selectedFile` などはウィンドウごとに分離される（Zustand persist のキーが `spec-prompt-app-store:${window.label}` に分離） |
| WT-07 | PTY ID 一意性 | PTY ID は `PtyManager` がプロセス全体でインクリメント管理するため、全ウィンドウ横断でユニーク |
| WT-08 | 言語設定共有 | `settingsStore` の言語設定（`spec-prompt-language`）は全ウィンドウで共有（ユーザー横断設定） |

### 2.3 タブ統合

| 要件ID | 要件 | 詳細 |
|--------|------|------|
| WT-09 | tabbingIdentifier 設定 | すべてのウィンドウは `tabbingIdentifier: "SpecPrompt"` を持つ（`tauri.conf.json` + `WebviewWindow` options 両方で指定） |
| WT-10 | 自動タブ化 | macOS システム設定「書類をタブで開く」が "常に" の場合、新規ウィンドウは既存ウィンドウのタブとして開く |
| WT-11 | 手動統合 | システム設定が "しない" / "フルスクリーン時のみ" の場合、**View > Show Tab Bar** でタブバー表示 → ドラッグで統合、または **Window > Merge All Windows** で一括統合できる |
| WT-12 | タブ関連メニュー | Window サブメニューに `WINDOW_SUBMENU_ID` を設定することで、macOS/AppKit が **Show Tab Bar / Merge All Windows / Move Tab to New Window** を自動挿入する |
| WT-13 | タブ名 | 各ウィンドウのタイトル（`SpecPrompt — {projectName}`）がタブ名として表示される |

### 2.4 セッション復元

| 要件ID | 要件 | 詳細 |
|--------|------|------|
| WT-14 | ウィンドウ単位の復元 | メインウィンドウ閉鎖時、他の全 SpecPrompt ウィンドウの projectRoot を `specprompt-window-sessions` に統合保存する |
| WT-15 | 次回起動時の再生成 | メインウィンドウ起動時、前回セッションから追加ウィンドウを自動復元する（`src/lib/windowSession.ts`） |

### 2.5 互換性・マイグレーション

| 要件ID | 要件 | 詳細 |
|--------|------|------|
| WT-16 | 旧キーからの自動移行 | `spec-prompt-app-store`（無印）に保存された既存ユーザーの状態を、初回起動時に `spec-prompt-app-store:main` へ 1 回だけコピーする |
| WT-17 | 重複移行防止 | 新キーが既存の場合は no-op。旧キーのみ削除 |

---

## 3. ユーザー操作手順（macOS）

### 3.1 基本操作

1. SpecPrompt を起動する
2. `⌘N` または File > New Window で新規ウィンドウを開く
3. 新ウィンドウで別プロジェクトを開く

### 3.2 タブ統合（システム設定「常に」の場合）

新規ウィンドウが自動的に既存ウィンドウのタブとして開く。追加操作不要。

### 3.3 タブ統合（システム設定「しない」「フルスクリーン時のみ」の場合）

1. 既存ウィンドウをアクティブにする
2. **View > Show Tab Bar** を選択 → タブバーが表示される
3. もう一方のウィンドウのタイトルバーをタブバーへドラッグして統合
4. または **Window > Merge All Windows** で一括統合

### 3.4 タブの分離

- タブバー上でタブを右クリック > **Move Tab to New Window** で独立ウィンドウに戻す
- またはタブをタブバーから外にドラッグ

---

## 4. 実装ポイント

### 4.1 Tauri Menu

`src-tauri/src/lib.rs` の setup hook で以下を構築：

- **App サブメニュー**（macOS）: About / Services / Hide / Quit
- **File**: New Window（`CmdOrCtrl+N`）/ Close Window
- **Edit**: Undo / Redo / Cut / Copy / Paste / Select All
- **View**（macOS）: Enter Full Screen
- **Window**（`WINDOW_SUBMENU_ID` 付与）: Minimize / Maximize / Close Window
  → macOS が自動で Show Tab Bar / Merge All Windows 等を挿入

### 4.2 多重発火防止

メニューからの `new-window` アクションは `app.emit("menu-new-window", ())` で JS 側に通知するが、これは**全ウィンドウにブロードキャスト**される。したがって JS 側 listener では `getCurrentWindow().isFocused()` を await してチェックし、**フォーカスされたウィンドウのみが `openNewWindow()` を呼ぶ**ようにガードする。

### 4.3 `⌘N` 実装方針

JS 側 keydown ハンドラに `⌘N` 分岐は置かない。menu accelerator（`CmdOrCtrl+N`）に一本化する。理由は menu accelerator と keydown が並列発火して 1 押下で 2 ウィンドウ生成するバグを起こすため。

---

## 5. 既知の制約

| 制約 | 詳細 | 対応方針 |
|------|------|---------|
| tabbingMode 非露出 | Tauri v2 は `NSWindow.tabbingMode` を API で公開しない | VS Code 同等の強制自動タブ化は実装不可。システム設定に依存 |
| Tauri Issue #6548 | システム設定が "In Full Screen Only" のとき tabbingIdentifier が効かない | 既知バグ。手動統合で代替可能 |
| パレット表示中の `⌘N` | menu accelerator は webview keydown と独立して発火するため、パレット表示中でも `⌘N` で新規ウィンドウが開く | macOS 標準挙動として受け入れ。drafts はメモリ保持されるため元ウィンドウに戻れば復元可能 |
| dev と prod の混在 | `npx tauri dev` と `tauri build` の `.app`、`/Applications/SpecPrompt.app` は別プロセス扱い | タブ統合は同一プロセス内のウィンドウに限る。検証時はどれか 1 つに絞る |

---

## 6. 関連ファイル

| ファイル | 役割 |
|---------|------|
| `src-tauri/tauri.conf.json` | メインウィンドウの `label: "main"` と `tabbingIdentifier: "SpecPrompt"` |
| `src-tauri/src/lib.rs` | Menu 構築、`new-window` イベント発火 |
| `src/lib/tauriApi.ts`（`openNewWindow`） | WebviewWindow 動的生成、`tabbingIdentifier` 付与 |
| `src/components/Layout/AppLayout.tsx` | `menu-new-window` イベント購読、`isFocused` ガード |
| `src/stores/appStore.ts` | persist キー `spec-prompt-app-store:${label}` とマイグレーション |
| `src/lib/windowSession.ts` | ウィンドウセッション復元 |
| `src/components/TreePanel/TreePanel.tsx` | ウィンドウタイトル更新、新規ウィンドウボタン |

---

## 7. 参考

- [Apple Developer: NSWindow.tabbingIdentifier](https://developer.apple.com/documentation/appkit/nswindow/1644704-tabbingidentifier)
- [Tauri v2 Window Customization](https://v2.tauri.app/learn/window-customization/)
- [Tauri Issue #6548](https://github.com/tauri-apps/tauri/issues/6548)
- `docs/local/20260418-macOSウィンドウタブ統合/` — 設計・WBS
- `docs/working/20260418_macos-window-tabs-f1/` — F1 実装記録
- `docs/working/20260418_macos-window-tabs-f2-f3/` — F2+F3 実装記録
