# CLAUDE.md

このファイルは、リポジトリ内のコードを操作する際に Claude Code (claude.ai/code) へのガイダンスを提供します。

## プロジェクト概要

**SpecPrompt** は、生成AIを用いた仕様駆動開発を支援する軽量デスクトップアプリケーション（Tauri v2 + React 19 + TypeScript）。マークダウンプレビュー・統合ターミナル・ファイルツリーを一体化した、VS Codeの軽量代替（メモリ目標200MB以下、VS Codeの約1/5）。

現在は**開発初期段階**。リポジトリには企画ドキュメントとGitHubテンプレートのみが存在し、アプリケーションコードはまだ実装されていない。

## 技術スタック

| レイヤー | 技術 |
|---|---|
| デスクトップフレームワーク | Tauri v2（Rustバックエンド） |
| フロントエンド | React 19 + TypeScript |
| スタイリング | Tailwind CSS v4 |
| MDレンダリング | unified（remark + rehype） |
| コードハイライト | Shiki |
| ターミナルエミュレータ（フロント） | xterm.js |
| PTY管理（バックエンド） | portable-pty クレート |
| ファイル監視 | tauri-plugin-fs |
| 状態管理 | Zustand + persist middleware |

## ビルド・開発コマンド

```bash
# 開発サーバー起動（フロントエンド＋バックエンド同時）
npx tauri dev

# プロダクションビルド（.app と .dmg を生成）
npx tauri build

# フロントエンドのみ
npm run dev

# フロントエンドのlint
npm run lint

# Rustテスト（全件）
cargo test

# Rustテスト（単体指定）
cargo test <test_name>
```

## アーキテクチャ

画面は左ペイン（プロジェクトツリー）と右ペイン（メインエリア）の2カラム構成。メインエリアは**コンテンツモード**（MD/コードビューア）と**ターミナルモード**を `Ctrl+Tab` で切り替える。

### IPCの境界

フロントエンドからRustの機能はすべて `invoke()` でTauri IPCを経由して呼び出す。

**Rustコマンドハンドラ**（`src-tauri/src/commands/`）:
- `filesystem.rs` — `read_dir`, `read_file`, `watch_fs`
- `pty.rs` — `spawn_pty`, `write_pty`, `resize_pty`, `close_pty`
- `config.rs` — `load_config`, `save_config`, `get_project_list`

**RustからフロントエンドへのTauriイベント**:
- `"file-changed" { path }` — コンテンツビューアの再読み込みをトリガー
- `"pty-output" { id, data }` — ターミナル出力をxterm.jsへストリーミング

### フロントエンドの状態管理（`src/stores/`）

- `appStore.ts` — ファイルツリー、アクティブプロジェクト、メインタブ（`"content" | "terminal"`）
- `contentStore.ts` — コンテンツタブ・分割レイアウトの状態
- `terminalStore.ts` — ターミナルタブ・分割レイアウトの状態・PTY ID

### コンテンツビューのルーティング

ファイル拡張子に応じてレンダリングコンポーネントを切り替える：
- `.md`, `.mdx` → `MarkdownPreview`（unifiedパイプライン）
- `.ts`, `.js`, `.py`, `.rs`, `.go`, `.java`, `.html`, `.css`, `.json`, `.yaml`, `.toml`, `.sql` 等 → `CodeViewer`（Shiki、読み取り専用）
- その他 → `PlainTextViewer`

### Tauri v2 の権限設定

PTYプロセス起動には `src-tauri/capabilities/default.json` への明示的な権限設定が必須：
```json
{
  "permissions": ["fs:read-all", "fs:write-all", "shell:allow-execute", "path:default"]
}
```

### 設定ファイルの保存先

`~/.config/spec-prompt/config.json`

## 実装上の注意：PTY

PTY統合（`portable-pty` クレート ↔ xterm.js ↔ Tauri IPC）は最大リスクのコンポーネント。実装開始時はほかの機能より先にこのエンドツーエンドの動作確認を行うこと。複数のPTYインスタンスが同時に動作し（ターミナルタブごとに1つ）、すべてのイベント・コマンドはIDで識別する。

## パス挿入機能

ツリーからアクティブなターミナルへファイルパスを挿入する方法：
- `Ctrl+Click`（ツリーノード上）
- 右クリックメニュー「パスをターミナルに挿入」
- `Ctrl+P` パス検索パレット（fuzzy検索、`Enter` で挿入、`Esc` で閉じる）

すべての挿入は `write_pty(id, formattedPath)` を経由する。パス形式（相対/絶対）はユーザー設定で切り替え可能。

## 作業ルール

### コミットのタイミング

ファイルの作成・変更（コード・ドキュメント・設定を問わず）の後は、**必ずユーザーに確認を依頼してから**コミットすること。

```
NG: ファイル作成 → 即コミット
OK: ファイル作成 → 「確認をお願いします」と報告 → ユーザー承認 → コミット
```

## 仕様ドキュメント

詳細な仕様は `docs/local/20260328-初期開発ドキュメント/` に格納されている：
- `01_要件定義書.md` — 機能・非機能要件
- `02_設計書.md` — アーキテクチャ・コンポーネント設計
- `03_WBS.md` — 作業分解・フェーズ別スケジュール
