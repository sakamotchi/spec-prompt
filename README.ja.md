# SpecPrompt

**生成AIを用いた仕様駆動開発のための軽量デスクトップアプリ。**

仕様書の確認・AIへの指示・ファイル操作を、重いIDEに頼らず一つのウィンドウで完結させます。

[English version](README.md)

---

## 概要

SpecPrompt はマークダウンプレビューと統合ターミナルを一体化したデスクトップアプリです。仕様書を参照しながら Claude Code などのAI CLIツールを横並びで操作できます。メモリ使用量の目標は **200MB 以下**（VS Codeの約1/5）。

## 機能

| 機能 | 説明 |
|---|---|
| ファイルツリー | プロジェクト内のファイル・フォルダを階層表示 |
| 統合ターミナル | フル PTY ターミナル — Claude Code 等の AI CLI をアプリ内で直接実行 |
| マークダウンプレビュー | Mermaid ダイアグラム対応のリアルタイムレンダリング |
| コードビューア | 15言語以上に対応したシンタックスハイライト（読み取り専用） |
| パスパレット | `Ctrl+P` fuzzy検索でファイルパスをターミナルへ挿入 |
| 分割表示 | コンテンツとターミナルを左右・上下に並べて表示 |
| タブ管理 | コンテンツタブ・ターミナルタブの複数管理 |
| ドキュメントステータス | フロントマター による `draft / reviewing / approved` ステータス管理 |
| テーマ | ダーク / ライトモード切り替え |

## 技術スタック

| レイヤー | 技術 |
|---|---|
| デスクトップフレームワーク | Tauri v2（Rustバックエンド） |
| フロントエンド | React 19 + TypeScript |
| スタイリング | Tailwind CSS v4 |
| MDレンダリング | unified（remark + rehype） |
| コードハイライト | Shiki |
| ターミナルエミュレータ | alacritty-terminal（Rustクレート）+ Canvas 2D レンダラー |
| PTY管理 | portable-pty（Rustクレート） |
| ファイル監視 | tauri-plugin-fs |
| 状態管理 | Zustand + persist middleware |

## 動作環境

- macOS（最優先）、Windows、Linux
- Node.js 20 以上
- Rust（stable）

## はじめかた

```bash
# リポジトリをクローン
git clone https://github.com/sakamotchi/spec-prompt.git
cd spec-prompt

# 依存パッケージをインストール
npm install

# 開発サーバー起動（フロントエンド＋バックエンド同時）
npx tauri dev
```

## ビルド

```bash
# プロダクションビルド（macOS では .app と .dmg を生成）
npx tauri build
```

## キーボードショートカット

| ショートカット | 操作 |
|---|---|
| `Ctrl+Tab` | コンテンツモード ↔ ターミナルモードの切り替え |
| `Ctrl+P` | パスパレットを開く |
| `Ctrl+Click` | ツリーのファイルパスをアクティブなターミナルへ挿入 |

## ライセンス

MIT
