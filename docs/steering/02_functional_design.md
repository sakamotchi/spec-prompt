# 機能設計書

**バージョン**: 1.3
**作成日**: 2026年3月28日
**最終更新**: 2026年4月18日

---

## 1. 機能一覧

### 1.1 機能カテゴリ

| カテゴリ | 説明 | 詳細ドキュメント |
|---------|------|-----------------|
| プロジェクトツリー | ファイル・フォルダの階層表示と操作 | [features/file-tree.md](features/file-tree.md) |
| コンテンツビューア | MD/コード/プレーンテキストの表示 | [features/content-viewer.md](features/content-viewer.md) |
| 統合ターミナル | PTYベースのターミナルエミュレータ | [features/terminal.md](features/terminal.md) |
| パス入力支援 | ツリーからターミナルへのパス挿入 | [features/path-palette.md](features/path-palette.md) |
| プロンプト編集パレット | 対話 CLI 宛てのプロンプトを誤送信なく推敲する非モーダル UI | [features/prompt-palette.md](features/prompt-palette.md) |
| Claude Code 通知 | OSC 9・HTTP フックを検出して OS ネイティブ通知を発火 | [features/notification.md](features/notification.md) |

---

## 2. 画面レイアウト

### 2.1 全体構成

画面は左ペイン（プロジェクトツリー）と右ペイン（メインエリア）の2カラム構成。メインエリアは「コンテンツ」と「ターミナル」をメインタブで切り替える。

```
┌──────────┬─────────────────────────────────────┐
│          │ [コンテンツ▼] [ターミナル]              │
│プロジェクト├─────────────────────────────────────┤
│  ツリー   │ [01_要件.md] [02_設計.md] [App.ts]   │
│          │                                     │
│ 📁 docs  │  # 要件定義書                         │
│  📄 01_..│  ## 1. 概要                           │
│  📄 02_..│  生成AIを用いた仕様駆動開発を...        │
│ 📁 src   │                                     │
│  📄 App..│                                     │
└──────────┴─────────────────────────────────────┘
```

### 2.2 ターミナルモード

```
┌──────────┬─────────────────────────────────────┐
│          │ [コンテンツ] [ターミナル▼]              │
│プロジェクト├─────────────────────────────────────┤
│  ツリー   │ [Terminal 1] [Terminal 2]            │
│          │                                     │
│          │ $ claude                             │
│          │ > docs/02_design.md を参照して...     │
│          │                                     │
└──────────┴─────────────────────────────────────┘
```

### 2.3 分割表示（コンテンツ）

```
┌──────────┬──────────────────┬──────────────────┐
│          │ [01_要件.md]      │ [App.ts]         │
│プロジェクト│                  │                  │
│  ツリー   │ # 要件定義書      │ const app = ...  │
│          │ ## 1. 概要        │ function main()  │
└──────────┴──────────────────┴──────────────────┘
```

---

## 3. 機能詳細サマリー

### 3.1 プロジェクトツリー機能（FR-01）

| 機能 | 説明 | 対応コンポーネント |
|------|------|------------------|
| ファイルツリー表示 | ディレクトリを再帰的に取得し階層表示 | `TreePanel` |
| 展開/折りたたみ | フォルダの開閉 | `TreePanel` |
| ファイル選択 | クリックでコンテンツビューアに表示 | `TreePanel` |
| プロジェクトを開く | フォルダ選択ダイアログ | `TreePanel` |
| ファイル新規作成 | 右クリックメニュー | `TreePanel` |
| フォルダ新規作成 | 右クリックメニュー | `TreePanel` |
| リネーム | インライン編集 | `TreePanel` |
| 削除 | 確認ダイアログ後に削除 | `TreePanel` |

### 3.2 コンテンツビューア機能（FR-02, FR-07）

| 機能 | 説明 | 対応コンポーネント |
|------|------|------------------|
| マークダウンプレビュー | unified でMD→HTMLレンダリング（`<img>` は asset プロトコル経由で表示） | `MarkdownPreview` |
| Mermaidダイアグラム | 図表記法のレンダリング | `MarkdownPreview` |
| コードビューア | Shikiによるシンタックスハイライト（読み取り専用） | `CodeViewer` |
| 画像ビューア | PNG/JPEG/GIF/WebP/BMP/ICO/AVIF/SVG をコンテナ内にフィット表示 | `ImageViewer` |
| プレーンテキスト表示 | その他のテキストファイル | `PlainTextViewer` |
| 自動更新 | ファイル変更検知で再読み込み | `ContentView` |
| 複数タブ | 複数ファイルをタブで開く | `ContentView` |
| 分割表示 | 水平/垂直分割 | `SplitPane` |

### 3.3 統合ターミナル機能（FR-03）

| 機能 | 説明 | 対応コンポーネント |
|------|------|------------------|
| ターミナル表示 | xterm.jsベースのターミナルエミュレータ | `TerminalPanel` |
| PTY管理 | portable-pty によるプロセス管理 | Rust `commands/pty.rs` |
| ターミナル状態管理 | alacritty_terminal によるグリッド／OSC 解析 | Rust `terminal/` |
| 複数タブ | 複数ターミナルを同時に開く | `TerminalPanel` |
| 分割表示 | 水平/垂直分割 | `SplitPane` |
| リサイズ対応 | ウィンドウリサイズ時にPTYサイズを更新 | `TerminalPanel` |
| 動的タブタイトル | OSC 0/1/2 を検出しタブ名を自動更新 | `terminalStore.setOscTitle` |
| タブ手動リネーム | ダブルクリックでピン留めリネーム・自動タイトル復帰 | `TerminalTabs` |
| シェル終了自動クローズ | PTY exit 検知でタブを自動クローズ（最後の1枚は再作成） | `terminalStore.handlePtyExited` |
| 未読通知マーク | 通知発火タブに琥珀ハイライト＋ドット表示 | `terminalStore.markUnread/clearUnread` |
| Shift+Enter で LF | Claude Code 等の改行入力に LF を送信（通常 Enter は CR） | `useTerminalInput` |

### 3.4 Claude Code 通知機能

| 機能 | 説明 | 対応コンポーネント |
|------|------|------------------|
| OSC 9 検出 | PTY 出力から `ESC ] 9 ; <msg> BEL` を検知して通知 | Rust `terminal/event.rs`, `commands/pty.rs` |
| HTTP フックサーバ | `127.0.0.1:19823` で Claude Code の hook を受信 | Rust `commands/notification.rs` |
| 発火元タブ識別 | 通知タイトルに `Claude Code — {タブ名}` を差し込む | `DisplayTitleCache` + `set_pty_display_title` |
| 通知種別分類 | Permission / Completed / Error / Waiting / Attention を自動判定 | `classify_notification()` |
| 設定 ON/OFF | 設定画面で通知の有効/無効を切り替え | `Settings` + `appearance.notification_enabled` |

### 3.5 パス入力支援機能（FR-04）

| 機能 | 説明 | 対応コンポーネント |
|------|------|------------------|
| Ctrl+クリック挿入 | ツリーからターミナルへワンアクション挿入 | `TreePanel` |
| 右クリックメニュー | 「パスをターミナルに挿入」 | `TreePanel` |
| パス検索パレット | Ctrl+P でインクリメンタルサーチ | `PathPalette` |
| 複数ファイル一括挿入 | 複数選択して一括挿入 | `TreePanel` |
| パス形式設定 | 相対/絶対パスを設定で切り替え | `Config` |
| ディスパッチ分岐 | プロンプト編集パレット表示中は PTY ではなく textarea に挿入する | `usePathInsertion` |

### 3.6 プロンプト編集パレット機能（FR-15）

| 機能 | 説明 | 対応コンポーネント |
|------|------|------------------|
| パレット起動 | `Cmd+Shift+P` / タブ右クリック / ターミナル本体右クリックから非モーダルで起動 | `PromptPalette`, `TabContextMenu`, `TerminalBodyContextMenu` |
| 複数行編集 | textarea で Enter は改行、Cmd+Enter で送信 | `PromptPalette` |
| 送信 | `writePty(ptyId, body + "\n")` を 1 回で実行。空本文は no-op | `PromptPalette.handleSubmit` |
| 下書き保持 | ターミナルタブごとにメモリで下書きを保持、再オープン時に復元 | `promptPaletteStore.drafts` |
| タブ閉鎖で破棄 | タブを閉じる／PTY が終了すると該当下書きを破棄し、送信先だった場合はパレットも close | `terminalStore` → `promptPaletteStore` |
| パス挿入連携 | `Cmd+Click` / 右クリック / `Ctrl+P` 確定時、パレット開なら textarea に挿入 | `usePathInsertion`, `PathPalette` |
| IME 抑止 | `compositionstart/end` と `isComposing` の二重ガードで変換中の Enter を抑止 | `PromptPalette` |
| ショートカット抑止 | 表示中は allow list（`Ctrl+P` / `Cmd+Shift+P`）以外のグローバルショートカットを `AppLayout` で早期 return | `AppLayout` |
| 送信失敗トースト | `writePty` 失敗時に `toast.error` を出しパレットと本文を維持 | `PromptPalette`, `Toast` |
| 挿入フラッシュ | パス挿入直後に textarea 枠を 300ms フラッシュ（`prefers-reduced-motion` スキップ） | `PromptPalette`, `promptPaletteStore.lastInsertAt` |

---

## 4. ユーザー操作フロー

### 4.1 ドキュメント確認フロー

1. プロジェクトツリーからMDファイルをクリック
2. コンテンツタブにマークダウンプレビューが表示される
3. AIに修正を指示したい場合はターミナルタブに切り替え
4. ターミナルでAI CLIを操作
5. ファイル保存時にコンテンツビューアが自動更新

### 4.2 パス入力フロー

1. ターミナルでAI CLIにプロンプトを入力中
2. 参照させたいファイルをプロジェクトツリーで Ctrl+クリック
3. ターミナルのカーソル位置にファイルパスが挿入される
4. またはCtrl+Pでパレットを開き、ファイル名でインクリメンタルサーチ
5. Enterで選択してパスを挿入

---

## 5. キーボードショートカット

| ショートカット | 操作 |
|-------------|------|
| `Ctrl+Tab` | コンテンツ↔ターミナル切り替え |
| `Ctrl+P` | パス検索パレットを開く |
| `Escape` | パレットを閉じる |
| `Cmd+T` | ターミナルタブを新規作成 |
| `Cmd+W` | アクティブタブを閉じる |
| `Cmd+1`～`Cmd+9` | n番目のタブをアクティブ化 |
| `Ctrl+Shift+Tab` | 前のタブへ移動 |
| `Cmd+\` | コンテンツペインの分割/統合切り替え |
| `Cmd+Shift+\` | ターミナルペインの分割/統合切り替え |
| `Cmd+0` | ツリーパネルへフォーカス |
| `Shift+Enter`（ターミナル） | LF を送信（Claude Code 等で改行を挿入、コマンド実行はしない） |
| `Cmd+Shift+P` / `Ctrl+Shift+P` | プロンプト編集パレットを開く |
| `Cmd+Enter` / `Ctrl+Enter`（パレット内） | パレットの本文 + `\n` をアクティブ PTY へ送信 |
| `?` | ショートカット一覧を開く/閉じる |

---

## 変更履歴

| 日付 | バージョン | 変更内容 | 作成者 |
|------|----------|---------|--------|
| 2026-03-28 | 1.0 | 初版作成 | - |
| 2026-04-05 | 1.1 | Phase 3-C キーボードショートカット追加 | - |
| 2026-04-14 | 1.2 | Claude Code 通知機能・OSC 0/1/2 タイトル・手動リネーム・未読マーク・自動クローズ・Shift+Enter を反映 | - |
| 2026-04-18 | 1.3 | プロンプト編集パレット（FR-15）を機能カテゴリ §3.6・ショートカット・パス挿入ディスパッチ分岐に反映 | - |
