# リポジトリ構造定義書

**バージョン**: 1.1
**作成日**: 2026年3月28日
**最終更新**: 2026年4月14日

---

## 1. ディレクトリ構造

### 1.1 ルートディレクトリ

```
spec-prompt/
├── .claude/                  # Claude Code設定・スキル
├── .git/                     # Git管理
├── .github/                  # GitHub設定（テンプレート等）
├── dist/                     # Viteビルド成果物（自動生成）
├── docs/                     # プロジェクトドキュメント
├── node_modules/             # npm依存関係（自動生成）
├── src/                      # フロントエンドソース（React）
├── src-tauri/                # バックエンドソース（Rust/Tauri）
├── .gitignore
├── .prettierrc
├── .prettierignore
├── CLAUDE.md                 # Claude Code用ガイド
├── README.md
├── eslint.config.js
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
└── vite.config.ts
```

### 1.2 src/ ディレクトリ（フロントエンド）

```
src/
├── components/
│   ├── TreePanel/            # プロジェクトツリー
│   ├── MainArea/             # メインエリア（タブ切り替え）
│   ├── ContentView/          # コンテンツビューア（MD/Code/Plain）
│   ├── TerminalPanel/        # 統合ターミナル（xterm.js、複数タブ）
│   ├── SplitPane/             # 分割表示
│   ├── PathPalette/           # パス検索パレット
│   ├── Settings/              # 設定画面（テーマ、フォント、通知 ON/OFF）
│   ├── KeyboardShortcuts/     # ショートカット一覧オーバーレイ
│   └── Layout/                # 全体レイアウト管理
│
├── stores/
│   ├── appStore.ts           # アプリ全体の状態
│   ├── contentStore.ts       # コンテンツタブ・分割レイアウト
│   ├── terminalStore.ts      # ターミナルタブ・PTY ID・OSC/手動タイトル・未読通知
│   └── settingsStore.ts      # 外観設定（テーマ・フォント・通知 ON/OFF）
│
├── hooks/
├── lib/
│   ├── markdown.ts           # MDレンダリング設定
│   └── tauriApi.ts           # Tauriコマンド呼び出しラッパー
│
├── i18n/                     # 多言語化リソース
├── test/                     # Vitest セットアップ
├── App.tsx
├── index.css                 # Tailwind CSS v4エントリー
├── main.tsx
└── vite-env.d.ts
```

### 1.3 src-tauri/ ディレクトリ（バックエンド）

```
src-tauri/
├── capabilities/
│   └── default.json          # Tauri v2 権限設定
├── icons/                    # アプリアイコン
│   ├── 32x32.png
│   ├── 128x128.png
│   ├── 128x128@2x.png
│   ├── icon.icns
│   └── icon.ico
├── src/
│   ├── commands/
│   │   ├── mod.rs
│   │   ├── filesystem.rs     # read_dir, read_file, create/rename/delete, open_in_editor
│   │   ├── pty.rs            # PTY管理（PtyManager + spawn/write/resize/close）
│   │   ├── config.rs         # 外観設定（AppearanceSettings）、recent_projects
│   │   ├── fonts.rs          # load_font_bytes（設定画面のフォント選択用）
│   │   ├── git.rs            # git_status
│   │   └── notification.rs   # HTTP フックサーバ、OSC 9 通知、DisplayTitleCache
│   ├── terminal/
│   │   ├── mod.rs
│   │   ├── instance.rs       # TerminalManager / 個別ターミナル状態
│   │   ├── grid.rs           # グリッド・スクロール制御
│   │   └── event.rs          # alacritty_terminal イベント（OSC 0/1/2/9、ベル等）
│   ├── lib.rs                # ライブラリクレート（コマンド登録・setup）
│   └── main.rs               # エントリーポイント
├── build.rs
├── Cargo.lock
├── Cargo.toml
├── rustfmt.toml
└── tauri.conf.json
```

### 1.4 docs/ ディレクトリ

```
docs/
├── local/                    # ローカル開発用ドキュメント（git管理外推奨）
│   └── {YYYYMMDD}_{件名}/
├── steering/                 # 永続化ドキュメント（正式仕様）
│   ├── 01_product_requirements.md  # プロダクト要求定義書
│   ├── 02_functional_design.md     # 機能設計書
│   ├── 03_architecture_specifications.md # 技術仕様書
│   ├── 04_repository_structure.md  # リポジトリ構造定義書（本ドキュメント）
│   ├── 05_development_guidelines.md # 開発ガイドライン
│   ├── 06_ubiquitous_language.md   # ユビキタス言語定義書
│   └── features/                   # 機能詳細仕様
│       ├── terminal.md
│       ├── file-tree.md
│       ├── content-viewer.md
│       ├── path-palette.md
│       └── notification.md         # Claude Code 通知（OSC 9 + HTTP hook）
└── working/                  # 開発作業ドキュメント（一時的）
    └── {YYYYMMDD}_{要件名}/
        ├── requirements.md
        ├── design.md
        ├── tasklist.md
        └── testing.md
```

---

## 2. 命名規則

### 2.1 ファイル・ディレクトリ命名

| 種類 | 規則 | 例 |
|------|------|---|
| React コンポーネント | PascalCase | `TerminalPanel.tsx` |
| TypeScript ファイル | camelCase or kebab-case | `tauriApi.ts`, `useTerminal.ts` |
| Rust ファイル | snake_case | `filesystem.rs`, `pty.rs` |
| ディレクトリ | PascalCase（コンポーネント）or camelCase | `TerminalPanel/`, `stores/` |

### 2.2 コード命名規則

#### TypeScript / React

| 種類 | 規則 | 例 |
|------|------|---|
| 変数・関数 | camelCase | `ptyId`, `spawnPty()` |
| 定数 | UPPER_SNAKE_CASE | `MAX_TERMINALS` |
| クラス・型・インターフェース | PascalCase | `FileNode`, `PtyOutput` |
| コンポーネント | PascalCase | `TerminalPanel` |
| カスタムフック | useXxx | `useTerminal()` |
| Zustand ストア | useXxxStore | `useAppStore()` |

#### Rust

| 種類 | 規則 | 例 |
|------|------|---|
| 変数・関数 | snake_case | `pty_id`, `spawn_pty()` |
| 定数 | UPPER_SNAKE_CASE | `MAX_PTY_INSTANCES` |
| 構造体・列挙型・トレイト | PascalCase | `PtyManager`, `FileNode` |
| モジュール | snake_case | `pty`, `filesystem` |

---

## 3. バージョン管理方針

### 3.1 ブランチ戦略

```
main (本番リリース)
 │
 ├── develop (開発統合)
 │    │
 │    ├── feature/{WBS-ID}-{機能名}  # 機能開発
 │    │   例: feature/1-A-layout
 │    │
 │    ├── fix/{件名}                 # バグ修正
 │    │
 │    └── refactor/{件名}            # リファクタリング
 │
 └── release/vX.X.X (リリース準備)
```

### 3.2 ブランチ命名規則

| プレフィックス | 用途 | 例 |
|--------------|------|---|
| `feature/` | 新機能開発（WBS IDを含める） | `feature/1-C-terminal` |
| `fix/` | バグ修正 | `fix/pty-crash` |
| `refactor/` | リファクタリング | `refactor/store-structure` |
| `docs/` | ドキュメント更新 | `docs/update-steering` |
| `release/` | リリース準備 | `release/v0.2.0` |

### 3.3 コミットメッセージ規則

```
[type] 概要（50文字以内）

詳細説明（任意）
```

#### タイプ一覧

| タイプ | 説明 |
|--------|------|
| `feat` | 新機能追加 |
| `fix` | バグ修正 |
| `refactor` | リファクタリング |
| `docs` | ドキュメント更新 |
| `test` | テスト追加・修正 |
| `chore` | ビルド・設定変更 |
| `style` | コードスタイル変更 |

---

## 4. Git管理対象外 (.gitignore)

```gitignore
# 依存関係
node_modules/
dist/

# Rust/Tauri
src-tauri/target/
src-tauri/gen/

# 環境設定
.env
.env.*

# IDE設定
.idea/
*.swp
*.swo

# OS生成ファイル
.DS_Store
Thumbs.db

# ログ
*.log
```

---

## 5. 設定ファイル一覧

| ファイル | 説明 |
|---------|------|
| `vite.config.ts` | Viteビルド設定・開発サーバー設定 |
| `tsconfig.json` | TypeScript設定 |
| `eslint.config.js` | ESLint設定（ESLint v9 flat config） |
| `.prettierrc` | Prettier設定 |
| `package.json` | npm依存関係・スクリプト |
| `src-tauri/Cargo.toml` | Rust依存関係 |
| `src-tauri/tauri.conf.json` | Tauriアプリ設定 |
| `src-tauri/rustfmt.toml` | Rustコードフォーマット設定 |
| `src-tauri/capabilities/default.json` | Tauri v2権限設定 |

---

## 変更履歴

| 日付 | バージョン | 変更内容 | 作成者 |
|------|----------|---------|--------|
| 2026-03-28 | 1.0 | 初版作成（Phase 0実装内容を反映） | - |
| 2026-04-14 | 1.1 | commands/notification.rs・terminal/ サブモジュール・Settings コンポーネント・settingsStore・features/notification.md を追加 | - |
