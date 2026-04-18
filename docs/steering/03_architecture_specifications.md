# 技術仕様書

**バージョン**: 1.1
**作成日**: 2026年3月28日
**最終更新**: 2026年4月14日

---

## 1. 技術スタック

### 1.1 概要

| レイヤー | 技術 | バージョン |
|---------|------|-----------|
| デスクトップフレームワーク | Tauri | 2.x |
| フロントエンドフレームワーク | React | 19.x |
| 言語 | TypeScript | ~5.6 |
| スタイリング | Tailwind CSS | 4.x |
| UIプリミティブ | Radix UI | 最新 |
| アイコン | Lucide React | 最新 |
| フォント | Geist / Geist Mono | - |
| MDレンダリング | unified (remark + rehype) | - |
| コードハイライト | Shiki | - |
| ターミナルエミュレータ (フロント) | xterm.js (@xterm/xterm) | 5.x |
| PTY管理 (バックエンド) | portable-pty | 0.8.x |
| ターミナルパーサ (バックエンド) | alacritty_terminal | 0.25.1 |
| ネイティブ通知 | tauri-plugin-notification | 2.x |
| HTTPフックサーバ | tiny_http | 0.12.x |
| ファイル監視 | tauri-plugin-fs | 2.x |
| 状態管理 | Zustand + persist middleware | - |
| ビルドツール | Vite | 6.x |
| バックエンド言語 | Rust | 1.70+ |

### 1.2 主要依存関係

#### フロントエンド (package.json)
```json
{
  "dependencies": {
    "@radix-ui/react-tabs": "latest",
    "@radix-ui/react-context-menu": "latest",
    "@radix-ui/react-dialog": "latest",
    "@tauri-apps/api": "^2",
    "@xterm/addon-fit": "^0.10.0",
    "@xterm/xterm": "^5.5.0",
    "lucide-react": "latest",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@tauri-apps/cli": "^2",
    "@vitejs/plugin-react": "^4.3.4",
    "tailwindcss": "^4.0.0",
    "typescript": "~5.6.2",
    "vite": "^6.0.3"
  }
}
```

#### バックエンド (src-tauri/Cargo.toml)
```toml
[dependencies]
tauri = "2"
tauri-plugin-opener = "2"
tauri-plugin-fs = { version = "2", features = ["watch"] }
tauri-plugin-dialog = "2"
tauri-plugin-notification = "2"
tiny_http = "0.12"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
portable-pty = "0.8"
alacritty_terminal = "=0.25.1"
tokio = { version = "1", features = ["full"] }
uuid = { version = "1", features = ["v4"] }
log = "0.4"
```

---

## 2. システムアーキテクチャ

### 2.1 全体構成図

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (WebView)                 │
│                                                      │
│  ┌────────────┐ ┌───────────────────────┐              │
│  │ TreePanel   │ │     MainArea          │              │
│  │ Component   │ │  ┌─────────────────┐  │              │
│  │             │ │  │ ContentView     │  │              │
│  │             │ │  │ (MD/Code/Plain) │  │              │
│  │             │ │  │ 複数タブ＋分割   │  │              │
│  │             │ │  ├─────────────────┤  │              │
│  │             │ │  │ TerminalPanel   │  │              │
│  │             │ │  │ (xterm.js)      │  │              │
│  │             │ │  │ 複数タブ＋分割   │  │              │
│  │             │ │  └─────────────────┘  │              │
│  └──────┬─────┘ └──────────┬────────────┘              │
│         │                  │                            │
│  ┌──────┴──────────────────┴─────────────────────────┐ │
│  │              Zustand Store                         │ │
│  │  appStore / contentStore / terminalStore           │ │
│  └──────────────────────┬────────────────────────────┘ │
│                         │                              │
│  PathPalette (オーバーレイ)                              │
└─────────────────────────┼─────────────────────────────┘
                          │ Tauri IPC (invoke / events)
┌─────────────────────────┼─────────────────────────────┐
│                   Backend (Rust)                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    Tauri Command Handlers                         │  │
│  ├─────────────┬──────────────┬──────────────┬────────────────────┤  │
│  │ FileSystem  │ PTY Manager  │ Config / Git │ Notification        │  │
│  │ Handler     │ + Terminal   │ / Fonts      │ (HTTP Hook Server)  │  │
│  │ - read_dir  │ - spawn_pty  │ - appearance │ - send_notification │  │
│  │ - read_file │ - write_pty  │ - recent_    │ - set_pty_display_  │  │
│  │ - watch_fs  │ - resize_pty │   projects   │   title             │  │
│  │             │ - close_pty  │ - git_status │ - 127.0.0.1:19823   │  │
│  │             │ - scroll/    │ - load_font_ │ - OSC 9 検出        │  │
│  │             │   resize_    │   bytes      │                     │  │
│  │             │   terminal   │              │                     │  │
│  └─────────────┴──────────────┴──────────────┴────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

#### 通知発火フロー

```
[Claude Code] OSC 9 を PTY に書き出す / HTTP hook を POST
    │
    ▼
[Rust] terminal/event.rs (OSC 9) or notification.rs (HTTP サーバ)
    │
    ▼
[Rust] DisplayTitleCache から発火元タブ名を引いて通知タイトル生成
    │
    ▼
[Rust → OS]  tauri-plugin-notification でネイティブ通知
[Rust → FE]  emit("claude-notification-fired", { pty_id })
    │
    ▼
[Frontend] terminalStore.markUnread(ptyId) で琥珀ハイライト付与
```

### 2.2 データフロー

#### コンテンツビューア更新フロー

```
[Rust] File Watcher が変更検知
    │
    ▼
[Rust → Frontend] Tauri Event: "file-changed" { path }
    │
    ▼
[Frontend] appStore が selectedFile と一致するか判定
    │ (一致する場合)
    ▼
[Frontend → Rust] invoke("read_file", { path })
    │
    ▼
[Frontend] viewMode を判定 → MD/Code/Plain コンポーネントを再レンダリング
```

#### ターミナル入出力フロー

```
[Frontend] xterm.js がキー入力を受け取る
    │
    ▼
[Frontend → Rust] invoke("write_pty", { id, data })
    │
    ▼
[Rust] PTY にデータを書き込む
    │
    ▼
[Rust] PTY からの出力を読み取る
    │
    ▼
[Rust → Frontend] Tauri Event: "pty-output" { id, data }
    │
    ▼
[Frontend] xterm.js に出力データを書き込む
```

---

## 3. モジュール構成

### 3.1 フロントエンドモジュール

```
src/
├── components/
│   ├── TreePanel/          # プロジェクトツリー
│   ├── MainArea/           # メインエリア（タブ切り替え）
│   │   └── MainTabs.tsx
│   ├── ContentView/        # コンテンツビューア（MD/コード/画像切り替え）
│   │   ├── ContentTabs.tsx
│   │   ├── MarkdownPreview.tsx
│   │   ├── CodeViewer.tsx
│   │   ├── ImageViewer.tsx
│   │   └── PlainTextViewer.tsx
│   ├── TerminalPanel/      # 統合ターミナル（複数タブ対応）
│   │   └── TerminalTabs.tsx
│   ├── SplitPane/          # 分割表示コンポーネント
│   ├── PathPalette/        # パス検索パレット
│   └── Layout/             # 全体レイアウト管理
│
├── stores/
│   ├── appStore.ts         # アプリ全体の状態（ファイルツリー、アクティブプロジェクト等）
│   ├── contentStore.ts     # コンテンツタブ・分割レイアウトの状態
│   └── terminalStore.ts    # ターミナルタブ・分割レイアウトの状態・PTY ID
│
├── hooks/
│   ├── useFileTree.ts
│   ├── useTerminal.ts
│   └── usePathInsertion.ts
│
├── lib/
│   ├── markdown.ts         # MDレンダリング設定（unified パイプライン）
│   └── tauriApi.ts         # Tauriコマンド呼び出しラッパー
│
├── App.tsx
└── main.tsx
```

### 3.2 バックエンドモジュール

```
src-tauri/src/
├── main.rs                  # エントリーポイント
├── lib.rs                   # ライブラリクレート（コマンド登録）
│
├── commands/
│   ├── mod.rs
│   ├── filesystem.rs        # read_dir, read_file, create/rename/delete, open_in_editor, write_file
│   ├── pty.rs               # spawn_pty, write_pty, resize_pty, close_pty + PtyManager
│   ├── config.rs            # get/save_appearance, recent_projects, AppearanceSettings
│   ├── fonts.rs             # load_font_bytes（設定画面のフォント一覧用）
│   ├── git.rs               # git_status
│   └── notification.rs      # send_notification, set_pty_display_title,
│                            # start_hook_server (tiny_http), DisplayTitleCache
│
└── terminal/                # alacritty_terminal ベースのターミナル状態管理
    ├── mod.rs
    ├── instance.rs          # TerminalManager / セル状態
    ├── grid.rs              # 画面グリッド・スクロール制御
    └── event.rs             # alacritty イベント購読（OSC 0/1/2/9、ベル等）
```

---

## 4. Tauri IPC設計

### 4.1 コマンド一覧

| カテゴリ | コマンド名 | 説明 |
|---------|-----------|------|
| ファイルシステム | `read_dir` | ディレクトリを再帰取得しツリー構造で返す |
| ファイルシステム | `read_file` | ファイル内容を文字列で返す |
| ファイルシステム | `write_file` | ファイルに文字列を書き込む |
| ファイルシステム | `create_file` / `create_dir` | ファイル・フォルダを新規作成 |
| ファイルシステム | `rename_path` / `delete_path` | リネーム・削除 |
| ファイルシステム | `open_in_editor` | 外部エディタでファイルを開く |
| PTY | `spawn_pty` | 新しいPTYプロセスを生成しIDを返す |
| PTY | `write_pty` | PTYにデータ（キー入力）を書き込む |
| PTY | `resize_pty` | PTYのサイズを変更する |
| PTY | `close_pty` | PTYプロセスを終了する |
| ターミナル | `resize_terminal` | alacritty_terminal グリッドサイズを変更 |
| ターミナル | `scroll_terminal` | ターミナルバッファをスクロール |
| 設定 | `get_appearance` | 外観設定（テーマ・フォント・通知）を読み込む |
| 設定 | `save_appearance` | 外観設定を保存する |
| 設定 | `get_recent_projects` / `add_recent_project` | 最近開いたプロジェクト履歴の取得・追加 |
| フォント | `load_font_bytes` | システムフォントのバイト列を返す |
| Git | `git_status` | プロジェクトの git status を返す |
| 通知 | `send_notification` | OSネイティブ通知を発火 |
| 通知 | `set_pty_display_title` | フロント算出の表示タイトルを Rust 側キャッシュに登録 |

### 4.2 Tauriイベント

| イベント名 | ペイロード | 説明 |
|-----------|----------|------|
| `pty-output` | `{ id: string, data: string }` | PTYからの出力をフロントエンドにストリーミング |
| `pty-exited` | `{ id: string }` | シェル終了を通知（フロントでタブ自動クローズ／最後の1枚なら再作成） |
| `terminal-title-changed` | `{ pty_id: string, title: string \| null }` | OSC 0/1/2 / Reset Title を受信したときに発火 |
| `claude-notification-fired` | `{ pty_id: string }` | Claude Code 通知を OS に投げた直後に発火（未読マーク用） |
| `file-changed` | `{ path: string }` | ファイル変更検知をフロントエンドに通知 |

### 4.3 PTY管理の注意点

- 複数の PTY インスタンスが同時に動作する（ターミナルタブごとに1つ）
- すべてのイベント・コマンドはPTY IDで識別する
- `PtyManager` は `Mutex<HashMap<String, PtyInstance>>` で管理する
- PTY出力の読み取りは専用スレッドで行い、Tauriイベントとして送信する

---

## 5. データ永続化

### 5.1 設定ファイルの保存先

`~/.config/spec-prompt/config.json`

### 5.2 設定ファイル構造

```json
{
  "recent_projects": [],
  "appearance": {
    "theme": "dark",
    "content_font_family": "Geist",
    "content_font_size": 16,
    "terminal_font_family": "Geist Mono",
    "terminal_font_size": 14,
    "notification_enabled": true
  }
}
```

- `recent_projects`: 最近開いたプロジェクトパス履歴
- `appearance.theme`: `"dark"` | `"light"`
- `appearance.notification_enabled`: Claude Code 通知の ON/OFF（デフォルト `true`）

---

## 6. Tauri v2 権限設定

PTY プロセス起動・ファイル監視・通知には `src-tauri/capabilities/default.json` への明示的な権限設定が必須：

```json
{
  "permissions": [
    "core:default",
    "opener:default",
    "fs:read-all",
    "fs:write-all",
    { "identifier": "fs:allow-watch", "allow": [{ "path": "**" }] },
    { "identifier": "fs:allow-unwatch", "allow": [{ "path": "**" }] },
    "dialog:default",
    "core:window:allow-create",
    "core:window:allow-set-title",
    "core:window:allow-destroy",
    "core:webview:allow-create-webview-window",
    "notification:default"
  ]
}
```

---

## 6.1 HTTP フックサーバ

Claude Code の hook からの通知を受け取るため、Rust 側で `tiny_http` クレートを使ったローカルサーバを常駐させる。

| 項目 | 値 |
|------|----|
| バインド | `127.0.0.1:19823`（ループバックのみ） |
| 起動タイミング | `tauri::Builder::setup()` 内で別スレッド起動 |
| エンドポイント | `GET /health` / `POST /claude-hook/{event}` |
| ペイロード | `ClaudeHookPayload`（`message`/`body`/`text`/`description`/`error`/`last_assistant_message`/`notification`/`tool_name`） |
| 実装 | `src-tauri/src/commands/notification.rs` |

詳細は [features/notification.md](features/notification.md) を参照。

---

## 7. パフォーマンス考慮事項

### 7.1 フロントエンド

- `TreePanel` は大量ファイル時に仮想スクロール（`@tanstack/react-virtual`）を導入予定
- `PathPalette` のfuzzy match結果は上位100件に制限
- ファイル監視の除外設定（`node_modules`, `.git` 等）

### 7.2 バックエンド

- PTYの非同期ストリーミング（Tokio）
- ファイル監視は `tauri-plugin-fs`（notify クレートのTauri公式ラッパー）

### 7.0 UIデザイン方針

VS Code / Linear 系のダークテーマを基調とする。カラーパレットは CSS カスタムプロパティで一元管理し、Phase 3-B のライト/ダーク切り替えにも対応できる設計とする。

```css
/* src/index.css */
@import "tailwindcss";
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap');

:root {
  --color-bg-base:      #0d0d0d;  /* アプリ最背面 */
  --color-bg-panel:     #141414;  /* ペイン背景 */
  --color-bg-elevated:  #1e1e1e;  /* タブバー・ホバー */
  --color-border:       #2a2a2a;  /* ペイン境界・セパレーター */
  --color-text-primary: #e8e8e8;
  --color-text-muted:   #888888;
  --color-accent:       #7c6af7;  /* アクティブタブ・ハイライト */
}

* { font-family: 'Geist', sans-serif; }
code, pre { font-family: 'Geist Mono', monospace; }
```

Radix UI のコンポーネントを使用する際はスタイルなしのヘッドレスプリミティブとして導入し、Tailwind CSS v4 のユーティリティクラスでスタイリングする。

### 7.3 目標指標

| 指標 | 目標値 |
|------|--------|
| 起動時間 | < 3秒 |
| マークダウン更新遅延 | < 500ms |
| メモリ使用量 | < 200MB |

---

## 変更履歴

| 日付 | バージョン | 変更内容 | 作成者 |
|------|----------|---------|--------|
| 2026-03-28 | 1.0 | 初版作成（Phase 0実装内容を反映） | - |
| 2026-04-14 | 1.1 | Claude Code 通知機能・alacritty_terminal・HTTP フックサーバ・pty-exited/terminal-title-changed/claude-notification-fired イベント・appearance 設定・capabilities を反映 | - |
