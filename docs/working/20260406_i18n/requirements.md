# 要件定義書 - Phase 3-F: 多言語対応（日本語・英語）

**フェーズ**: 3-F
**作成日**: 2026年4月6日
**ステータス**: 作成中

---

## 1. 背景・目的

現在のUIはすべての文字列が日本語ハードコードされている。`i18next` + `react-i18next` を導入し、日本語と英語の切り替えを可能にする。MDプレビューのドキュメント内容は対象外で、UIラベル・プレースホルダー・エラーメッセージ・メニュー項目のみを対象とする。

---

## 2. 機能要件

### 2.1 i18n ライブラリ導入（3-F-1）

| 要件ID | 内容 | 優先度 |
|--------|------|--------|
| FR-01 | `i18next` + `react-i18next` を導入する | 必須 |
| FR-02 | 言語ファイルを `src/i18n/locales/ja.json` / `src/i18n/locales/en.json` に配置する | 必須 |
| FR-03 | デフォルト言語は日本語（`ja`）とする | 必須 |
| FR-04 | `settingsStore` の `language` フィールド（`'ja' \| 'en'`）に言語設定を永続化する | 必須 |

### 2.2 UI 文字列の抽出・翻訳（3-F-2）

| 要件ID | 内容 | 優先度 |
|--------|------|--------|
| FR-05 | 現在ハードコードされている日本語UI文字列（77件・14ファイル）を翻訳キーに置き換える | 必須 |
| FR-06 | 対応する英訳を `en.json` に用意する | 必須 |
| FR-07 | 動的な文字列（件数など）は `i18next` の補間構文（`{{count}}` 等）を使用する | 必須 |

### 2.3 言語切り替えUI（3-F-3）

| 要件ID | 内容 | 優先度 |
|--------|------|--------|
| FR-08 | 設定モーダル（`SettingsModal`）に言語セレクターを追加する | 必須 |
| FR-09 | 切り替えは即時反映（ページリロード不要）とする | 必須 |
| FR-10 | 選択した言語は `settingsStore` に保存し、再起動後も維持される | 必須 |

### 2.4 README 日英対応（3-F-4）

| 要件ID | 内容 | 優先度 |
|--------|------|--------|
| FR-11 | `README.md` を英語で整備する | 必須 |
| FR-12 | `README.ja.md` を日本語で整備する | 必須 |

---

## 3. 非機能要件

| 要件ID | 内容 |
|--------|------|
| NFR-01 | MDファイルのプレビュー内容・コードのシンタックスハイライトは翻訳対象外 |
| NFR-02 | `DocStatus`（`draft` / `reviewing` / `approved`）のフロントマター値（英語）は変更しない。表示ラベルのみ翻訳する |
| NFR-03 | ターミナル内の出力（シェルの出力）は翻訳対象外 |

---

## 4. 翻訳対象文字列（77件）

### TreePanel / TreeNode

| キー | 日本語 | 英語 |
|------|--------|------|
| `tree.placeholder.file` | `ファイル名...` | `File name...` |
| `tree.placeholder.folder` | `フォルダ名...` | `Folder name...` |
| `tree.loading` | `読み込み中...` | `Loading...` |
| `tree.emptyState` | `フォルダを開いてください` | `Open a folder to get started` |
| `tree.tooltip.openProject` | `プロジェクトを開く` | `Open Project` |
| `tree.tooltip.settings` | `設定` | `Settings` |

### ContextMenu

| キー | 日本語 | 英語 |
|------|--------|------|
| `contextMenu.status` | `ステータス` | `Status` |
| `contextMenu.insertPath` | `パスをターミナルに挿入` | `Insert Path to Terminal` |
| `contextMenu.insertAll` | `選択中 {{count}} 件をすべて挿入` | `Insert All {{count}} Selected` |
| `contextMenu.newFile` | `新規ファイル` | `New File` |
| `contextMenu.newFolder` | `新規フォルダ` | `New Folder` |
| `contextMenu.openInFinder` | `Finderで開く` | `Reveal in Finder` |
| `contextMenu.openInEditor` | `外部エディタで開く` | `Open in External Editor` |
| `contextMenu.rename` | `リネーム` | `Rename` |
| `contextMenu.delete` | `削除` | `Delete` |

### RecentProjectsMenu

| キー | 日本語 | 英語 |
|------|--------|------|
| `recentProjects.label` | `最近開いたプロジェクト` | `Recent Projects` |
| `recentProjects.empty` | `履歴がありません` | `No recent projects` |
| `recentProjects.defaultName` | `プロジェクト` | `Project` |

### DeleteDialog

| キー | 日本語 | 英語 |
|------|--------|------|
| `deleteDialog.titleFolder` | `フォルダを削除` | `Delete Folder` |
| `deleteDialog.titleFile` | `ファイルを削除` | `Delete File` |
| `deleteDialog.descFolder` | `{{name}} を削除します。フォルダ内のファイルもすべて削除されます。この操作は取り消せません。` | `Delete {{name}}? All files inside will also be deleted. This action cannot be undone.` |
| `deleteDialog.descFile` | `{{name}} を削除します。この操作は取り消せません。` | `Delete {{name}}? This action cannot be undone.` |
| `deleteDialog.cancel` | `キャンセル` | `Cancel` |
| `deleteDialog.confirm` | `削除` | `Delete` |

### ContentTabBar / ContentView

| キー | 日本語 | 英語 |
|------|--------|------|
| `content.newTab` | `新規タブ` | `New Tab` |
| `content.tooltip.split` | `コンテンツを左右分割` | `Split Content` |

### MainArea

| キー | 日本語 | 英語 |
|------|--------|------|
| `mainArea.tab.content` | `コンテンツ` | `Content` |
| `mainArea.tab.terminal` | `ターミナル` | `Terminal` |
| `mainArea.tooltip.splitView` | `Split View (Ctrl+\)` | `Split View (Ctrl+\)` |
| `mainArea.tooltip.disableSplit` | `Split を解除` | `Disable Split` |
| `mainArea.header.content` | `コンテンツ` | `Content` |
| `mainArea.header.terminal` | `ターミナル` | `Terminal` |

### TerminalTabs

| キー | 日本語 | 英語 |
|------|--------|------|
| `terminal.tooltip.newTab` | `新しいターミナルを開く` | `New Terminal` |
| `terminal.tooltip.split` | `ターミナルを左右分割` | `Split Terminal` |

### PathPalette

| キー | 日本語 | 英語 |
|------|--------|------|
| `pathPalette.ariaLabel` | `パス検索パレット` | `Path Search Palette` |
| `pathPalette.placeholder` | `ファイルを検索してターミナルに挿入...` | `Search files to insert into terminal...` |
| `pathPalette.hint` | `Esc で閉じる` | `Esc to close` |
| `pathPalette.noResults` | `一致するファイルが見つかりません` | `No matching files found` |
| `pathPalette.count` | `{{count}} 件` | `{{count}} results` |
| `pathPalette.countLimit` | `（上位100件）` | `(top 100)` |

### ShortcutsModal

| キー | 日本語 | 英語 |
|------|--------|------|
| `shortcuts.title` | `キーボードショートカット` | `Keyboard Shortcuts` |
| `shortcuts.category.pane` | `ペイン切り替え` | `Pane Switching` |
| `shortcuts.category.tab` | `タブ操作` | `Tab Operations` |
| `shortcuts.category.split` | `分割表示` | `Split View` |
| `shortcuts.category.focus` | `フォーカス移動` | `Focus Navigation` |
| `shortcuts.category.other` | `その他` | `Other` |
| `shortcuts.label.togglePane` | `コンテンツ↔ターミナル切り替え` | `Toggle Content/Terminal` |
| `shortcuts.label.newTerminalTab` | `ターミナルタブを新規作成` | `New Terminal Tab` |
| `shortcuts.label.closeTab` | `タブを閉じる` | `Close Tab` |
| `shortcuts.label.prevTab` | `前のタブへ移動` | `Previous Tab` |
| `shortcuts.label.nthTab` | `n 番目のタブへ移動` | `Go to Tab n` |
| `shortcuts.label.splitContent` | `コンテンツ分割切り替え` | `Toggle Content Split` |
| `shortcuts.label.splitTerminal` | `ターミナル分割切り替え` | `Toggle Terminal Split` |
| `shortcuts.label.parallelView` | `コンテンツ/ターミナル並列表示` | `Toggle Parallel View` |
| `shortcuts.label.focusTree` | `ツリーパネルへフォーカス` | `Focus Tree Panel` |
| `shortcuts.label.pathPalette` | `パス検索パレット` | `Path Search Palette` |
| `shortcuts.label.shortcutList` | `ショートカット一覧` | `Shortcut List` |

### SettingsModal

| キー | 日本語 | 英語 |
|------|--------|------|
| `settings.title` | `外観設定` | `Appearance` |
| `settings.section.theme` | `テーマ` | `Theme` |
| `settings.theme.dark` | `ダーク` | `Dark` |
| `settings.theme.light` | `ライト` | `Light` |
| `settings.theme.system` | `システム` | `System` |
| `settings.section.content` | `コンテンツ` | `Content` |
| `settings.label.font` | `フォント` | `Font` |
| `settings.label.size` | `サイズ` | `Size` |
| `settings.section.terminal` | `ターミナル` | `Terminal` |
| `settings.label.language` | `言語` | `Language` |
| `settings.language.ja` | `日本語` | `Japanese` |
| `settings.language.en` | `English` | `English` |
| `settings.button.apply` | `適用` | `Apply` |

### DocStatus

| キー | 日本語 | 英語 |
|------|--------|------|
| `docStatus.draft` | `草稿` | `Draft` |
| `docStatus.reviewing` | `レビュー中` | `Reviewing` |
| `docStatus.approved` | `承認済` | `Approved` |

### TerminalPanel

| キー | 日本語 | 英語 |
|------|--------|------|
| `terminal.error.ptyStart` | `PTY 起動エラー: {{error}}` | `PTY startup error: {{error}}` |

---

## 5. スコープ外

- MDファイルのプレビュー内容
- ターミナルのシェル出力
- `DocStatus` のフロントマター値（`draft` / `reviewing` / `approved` は英語固定）
- コードのシンタックスハイライト
