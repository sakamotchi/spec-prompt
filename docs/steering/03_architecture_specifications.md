# 技術仕様書

**バージョン**: 1.0
**作成日**: 2026年3月28日
**最終更新**: 2026年3月28日

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
tauri-plugin-fs = "2"
tauri-plugin-dialog = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
portable-pty = "0.8"
tokio = { version = "1", features = ["full"] }
uuid = { version = "1", features = ["v4"] }
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
│  ┌──────────────────────────────────────────────────┐  │
│  │              Tauri Command Handlers              │  │
│  ├─────────────┬──────────────┬─────────────────────┤  │
│  │ FileSystem  │ PTY Manager  │ Config Manager      │  │
│  │ Handler     │              │                     │  │
│  │ - read_dir  │ - spawn_pty  │ - load_config       │  │
│  │ - read_file │ - write_pty  │ - save_config       │  │
│  │ - watch_fs  │ - resize_pty │ - get_project_list  │  │
│  │             │ - close_pty  │                     │  │
│  └─────────────┴──────────────┴─────────────────────┘  │
└────────────────────────────────────────────────────────┘
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
│   ├── ContentView/        # コンテンツビューア（MD/コード切り替え）
│   │   ├── ContentTabs.tsx
│   │   ├── MarkdownPreview.tsx
│   │   ├── CodeViewer.tsx
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
│   ├── filesystem.rs        # read_dir, read_file
│   ├── pty.rs               # spawn_pty, write_pty, resize_pty, close_pty + PtyManager
│   └── config.rs            # load_config, save_config, get_project_list
│
└── watcher.rs               # ファイル監視（file-changed イベント送信）
```

---

## 4. Tauri IPC設計

### 4.1 コマンド一覧

| カテゴリ | コマンド名 | 説明 |
|---------|-----------|------|
| ファイルシステム | `read_dir` | ディレクトリを再帰取得しツリー構造で返す |
| ファイルシステム | `read_file` | ファイル内容を文字列で返す |
| ファイルシステム | `watch_fs` | ディレクトリ監視開始（file-changed イベントを送信） |
| PTY | `spawn_pty` | 新しいPTYプロセスを生成しIDを返す |
| PTY | `write_pty` | PTYにデータ（キー入力）を書き込む |
| PTY | `resize_pty` | PTYのサイズを変更する |
| PTY | `close_pty` | PTYプロセスを終了する |
| 設定 | `load_config` | 設定ファイルを読み込む |
| 設定 | `save_config` | 設定ファイルを保存する |
| 設定 | `get_project_list` | 最近開いたプロジェクト一覧を返す |

### 4.2 Tauriイベント

| イベント名 | ペイロード | 説明 |
|-----------|----------|------|
| `pty-output` | `{ id: string, data: string }` | PTYからの出力をフロントエンドにストリーミング |
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
  "pathFormat": "relative",
  "recentProjects": [],
  "terminal": {
    "shell": "/bin/zsh",
    "fontSize": 14,
    "colorScheme": "dark"
  },
  "preview": {
    "mermaidEnabled": true
  }
}
```

---

## 6. Tauri v2 権限設定

PTY プロセス起動には `src-tauri/capabilities/default.json` への明示的な権限設定が必須：

```json
{
  "permissions": [
    "core:default",
    "opener:default",
    "fs:read-all",
    "fs:write-all",
    "dialog:default"
  ]
}
```

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
