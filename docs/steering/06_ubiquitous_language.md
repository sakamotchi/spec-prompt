# ユビキタス言語定義書

**バージョン**: 1.1
**作成日**: 2026年3月28日
**最終更新**: 2026年4月14日

---

## 1. 概要

このドキュメントは、SpecPromptプロジェクトで使用する共通用語（ユビキタス言語）を定義します。開発チーム、ドキュメント、コード内で一貫した用語を使用することで、コミュニケーションの齟齬を防ぎます。

---

## 2. コアドメイン用語

### 2.1 プロジェクト管理（Project Management）

| 用語 | 英語表記 | 定義 | コード上の表現 |
|------|---------|------|---------------|
| プロジェクト | Project | SpecPromptで開くフォルダの単位。ルートパスを持つ | `project` |
| プロジェクトルート | Project Root | プロジェクトの最上位ディレクトリパス | `projectRoot: string` |
| 最近開いたプロジェクト | Recent Projects | 過去に開いたプロジェクトの履歴リスト | `recentProjects: string[]` |
| プロジェクトを開く | Open Project | フォルダ選択ダイアログでプロジェクトを指定する操作 | `openProject()` |

### 2.2 ファイルツリー（File Tree）

| 用語 | 英語表記 | 定義 | コード上の表現 |
|------|---------|------|---------------|
| ファイルノード | File Node | ファイルまたはディレクトリを表すツリーの1要素 | `FileNode` |
| ファイルツリー | File Tree | プロジェクト配下のファイル・フォルダを階層表示するデータ構造・UI | `fileTree: FileNode[]` |
| ツリーパネル | Tree Panel | 左カラムに表示されるファイルツリーのUIコンポーネント | `TreePanel` |
| 展開状態 | Expansion State | ディレクトリの展開/折りたたみ状態 | `expandedDirs: Set<string>` |
| 選択ファイル | Selected File | ユーザーが選択したファイルのパス | `selectedFile: string \| null` |
| ルートパス | Root Path | ツリーの最上位ディレクトリのパス | `rootPath: string` |

### 2.3 コンテンツビューア（Content Viewer）

| 用語 | 英語表記 | 定義 | コード上の表現 |
|------|---------|------|---------------|
| コンテンツビューア | Content Viewer | ファイルの内容を表示する領域の総称 | `ContentView` |
| ビューモード | View Mode | ファイルの表示形式（マークダウン/コード/プレーンテキスト） | `ViewMode` |
| マークダウンプレビュー | Markdown Preview | MDファイルをHTMLにレンダリングして表示するコンポーネント | `MarkdownPreview` |
| コードビューア | Code Viewer | シンタックスハイライト付きでソースコードを表示するコンポーネント | `CodeViewer` |
| プレーンテキストビューア | Plain Text Viewer | テキストをそのまま表示するコンポーネント | `PlainTextViewer` |
| コンテンツタブ | Content Tab | コンテンツビューアで開いているファイルを示すタブ | `ContentTab` |
| アクティブコンテンツ | Active Content | 現在フォーカスされているコンテンツタブのファイル | `activeContentId: string` |

### 2.4 ターミナル（Terminal）

| 用語 | 英語表記 | 定義 | コード上の表現 |
|------|---------|------|---------------|
| PTY | PTY (Pseudo Terminal) | 仮想端末デバイス。シェルプロセスとの双方向通信に使用 | `pty` |
| PTY ID | PTY ID | PTYインスタンスを一意に識別するUUID文字列 | `ptyId: string` |
| PTYマネージャー | PTY Manager | 全PTYインスタンスを管理するRust側の構造体 | `PtyManager` |
| PTYインスタンス | PTY Instance | 1つのシェルプロセスに対応するPTYのデータ | `PtyInstance` |
| ターミナルパネル | Terminal Panel | xterm.jsを使ったターミナルエミュレータのUIコンポーネント | `TerminalPanel` |
| ターミナルタブ | Terminal Tab | ターミナルパネルで開いている1つのターミナルセッション | `TerminalTab` |
| PTY出力 | PTY Output | PTYから受け取るシェルの出力データ | `ptyOutput` |
| リサイズ | Resize | ターミナルのサイズ変更操作（列数・行数の更新） | `resizePty()` |
| xterm.js | xterm.js | ブラウザで動作するターミナルエミュレータライブラリ | `Terminal` (xterm) |
| alacritty_terminal | alacritty_terminal | Rust 側で OSC・グリッド解析に使うターミナルパーサクレート | `terminal/` |
| OSC タイトル | OSC Title | OSC 0/1/2 で受信した動的タブタイトル | `oscTitle: string \| null` |
| 手動タイトル | Manual Title | ユーザーが明示的にリネームしたタブ名 | `manualTitle: string \| null` |
| ピン留め | Pinned | 手動タイトルを表示に優先し OSC 更新を無視する状態 | `pinned: boolean` |
| 表示タイトル | Display Title | 算出後のタブ表示名（pinned manualTitle > oscTitle > fallbackTitle） | `computeDisplayTitle()` |
| 未読通知 | Unread Notification | 通知発火後、タブが非アクティブなままであることを示すフラグ | `hasUnreadNotification: boolean` |
| PTY 終了 | PTY Exited | シェルが終了し PTY が切断された状態。タブ自動クローズの契機 | `"pty-exited"` イベント |

### 2.5 分割表示（Split Pane）

| 用語 | 英語表記 | 定義 | コード上の表現 |
|------|---------|------|---------------|
| 分割ペイン | Split Pane | コンテンツまたはターミナルを複数列に分割表示するレイアウト | `SplitPane` |
| 分割方向 | Split Direction | 水平分割（horizontal）または垂直分割（vertical） | `SplitDirection` |
| ペイン | Pane | 分割表示の1つの区画 | `Pane` |
| アクティブペイン | Active Pane | 現在フォーカスされているペイン | `activePaneId: string` |

### 2.6 Claude Code 通知（Notification）

| 用語 | 英語表記 | 定義 | コード上の表現 |
|------|---------|------|---------------|
| Claude Code 通知 | Claude Code Notification | Claude Code などの AI CLI 処理状況を OS ネイティブ通知で知らせる機能 | `send_notification()` |
| OSC 9 | OSC 9 | `ESC ] 9 ; <msg> BEL` 形式のエスケープシーケンス。通知メッセージ本体を運ぶ | - |
| HTTP フックサーバ | Hook Server | `127.0.0.1:19823` で Claude Code hook を受信するローカルサーバ | `start_hook_server()` |
| 通知種別 | Notification Type | Permission / Completed / Error / Waiting / Attention の分類 | `NotificationType` |
| 発火元タブ | Source Tab | 通知を発火した PTY に紐づくターミナルタブ | `pty_id` |
| 表示タイトルキャッシュ | Display Title Cache | 発火元タブ名を Rust 側で引くための `ptyId -> title` マップ | `DisplayTitleCache` |
| 通知 ON/OFF | Notification Enabled | 通知の有効/無効設定 | `appearance.notification_enabled` |

### 2.7 パス入力支援（Path Insertion）

| 用語 | 英語表記 | 定義 | コード上の表現 |
|------|---------|------|---------------|
| パス挿入 | Path Insertion | ファイルパスをターミナルのカーソル位置に挿入する操作 | `insertPath()` |
| パス検索パレット | Path Palette | Ctrl+Pで起動するファイルパスのインクリメンタル検索UI | `PathPalette` |
| パス形式 | Path Format | 挿入するパスが相対パスか絶対パスかの設定 | `pathFormat: 'relative' \| 'absolute'` |
| Ctrl+クリック | Ctrl+Click | ツリーからターミナルへのワンアクション挿入操作 | - |
| インクリメンタルサーチ | Incremental Search | 入力と同時に検索結果を更新するリアルタイム検索 | - |

---

## 3. ファイルシステムドメイン用語

| 用語 | 英語表記 | 定義 | コード上の表現 |
|------|---------|------|---------------|
| ファイル監視 | File Watching | ファイルの変更を検知してイベントを発火する機能 | `watchFs()` |
| ファイル変更イベント | File Changed Event | ファイル変更検知時にバックエンドが送信するTauriイベント | `"file-changed"` |
| 自動更新 | Auto Update | ファイル変更検知時にコンテンツビューアを自動で再読み込みする動作 | - |
| 除外対象 | Excluded Targets | ファイルツリーおよびファイル監視から除外するパス（node_modules, .git等） | `EXCLUDED_DIRS` |

---

## 4. アーキテクチャドメイン用語

| 用語 | 英語表記 | 定義 | コード上の表現 |
|------|---------|------|---------------|
| Tauriコマンド | Tauri Command | フロントエンドからRustバックエンドを呼び出すIPC関数 | `#[tauri::command]` |
| Tauriイベント | Tauri Event | RustバックエンドからフロントエンドへのPush通知 | `app.emit()` |
| invoke | invoke | TauriコマンドをTypeScriptから呼び出すIPC関数 | `invoke()` |
| アプリストア | App Store | アプリ全体の状態を管理するZustandストア | `useAppStore` |
| コンテンツストア | Content Store | コンテンツタブ・分割レイアウトの状態を管理するZustandストア | `useContentStore` |
| ターミナルストア | Terminal Store | ターミナルタブ・PTY IDの状態を管理するZustandストア | `useTerminalStore` |
| Tauriラッパー | Tauri API Wrapper | Tauriコマンドを型付きでラップしたTypeScript関数群 | `tauriApi` |

---

## 5. UIコンポーネント用語

| 用語 | 英語表記 | 定義 | コード上の表現 |
|------|---------|------|---------------|
| メインエリア | Main Area | 右カラムのコンテンツ表示・ターミナル表示を含む領域 | `MainArea` |
| メインタブ | Main Tab | コンテンツとターミナルを切り替えるトップレベルのタブ | `MainTabs` |
| タブバー | Tab Bar | 複数のタブを横並びに表示するUI | - |
| コンテキストメニュー | Context Menu | 右クリックで表示されるメニュー | - |
| ダイアログ | Dialog | 確認や入力を求めるモーダル画面 | `dialog` |
| オーバーレイ | Overlay | 全画面に重なるように表示されるUI（PathPaletteなど） | - |

---

## 6. 設定ドメイン用語

| 用語 | 英語表記 | 定義 | コード上の表現 |
|------|---------|------|---------------|
| 設定ファイル | Config File | アプリ設定を保存するJSONファイル（~/.config/spec-prompt/config.json） | `Config` |
| 外観設定 | Appearance Settings | テーマ・フォント・通知 ON/OFF をまとめた設定セクション | `AppearanceSettings` |
| テーマ | Theme | ダーク/ライトの配色テーマ | `appearance.theme: string` |
| コンテンツフォント | Content Font | マークダウン／コード表示で使うフォント | `appearance.content_font_family` |
| ターミナルフォント | Terminal Font | xterm.js で使うフォント | `appearance.terminal_font_family` |
| 通知 ON/OFF | Notification Enabled | Claude Code 通知の有効/無効 | `appearance.notification_enabled` |

---

## 7. 開発用語

| 用語 | 英語表記 | 定義 | コード上の表現 |
|------|---------|------|---------------|
| ストア | Store | Zustandによる状態管理モジュール | `useXxxStore` |
| カスタムフック | Custom Hook | React Composition APIに相当するロジック再利用関数 | `useXxx()` |
| コマンド | Command | TauriのIPC呼び出しで実行されるRust関数 | `#[tauri::command]` |
| マネージャー | Manager | Rustでリソースを管理する構造体 | `XxxManager` |
| アドオン | Addon | xterm.jsに機能を追加するモジュール | `FitAddon` |

---

## 8. コンテキスト別用語の使い方

### 8.1 ユーザー向け（UI/ドキュメント）

| コード上の用語 | ユーザー向け表現 |
|--------------|----------------|
| FileNode | ファイル、フォルダ |
| PTY | ターミナル |
| invoke | - (内部実装のため表出しない) |
| pathFormat | パス形式（相対パス / 絶対パス） |
| ViewMode | 表示モード |

### 8.2 開発者向け（コード/コメント）

| 日本語 | 英語（コード内） |
|-------|-----------------|
| PTYを起動する | `spawnPty()` |
| PTYにデータを書き込む | `writePty()` |
| PTYのサイズを変更する | `resizePty()` |
| PTYを終了する | `closePty()` |
| ディレクトリを読み込む | `readDir()` |
| ファイルを読み込む | `readFile()` |
| パスを挿入する | `insertPath()` |
| ファイル監視を開始する | `watchFs()` |

---

## 9. 略語集

| 略語 | 正式名称 | 説明 |
|------|---------|------|
| PTY | Pseudo Terminal | 仮想端末デバイス |
| IPC | Inter-Process Communication | Tauri フロント/バック間通信 |
| MD | Markdown | マークダウン記法 |
| UI | User Interface | ユーザーインターフェース |
| API | Application Programming Interface | アプリケーションプログラミングインターフェース |
| UUID | Universally Unique Identifier | 汎用一意識別子 |
| PR | Pull Request | プルリクエスト |
| WBS | Work Breakdown Structure | 作業分解構造 |
| POC | Proof of Concept | 技術検証 |
| OSC | Operating System Command | ターミナルで OS 連携を行うエスケープシーケンス（OSC 0/1/2/9 等） |
| CR | Carriage Return | `\r`。Enter キーで送られる改行コード（コマンド実行） |
| LF | Line Feed | `\n`。Shift+Enter で送られる改行コード（Claude Code 等で改行挿入） |

---

## 変更履歴

| 日付 | バージョン | 変更内容 | 作成者 |
|------|----------|---------|--------|
| 2026-03-28 | 1.0 | 初版作成 | - |
| 2026-04-14 | 1.1 | Claude Code 通知・OSC タイトル・手動リネーム・未読通知・alacritty_terminal・外観設定の用語を追加 | - |
