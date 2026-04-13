# 要件定義書 - Phase 1: 通知基盤（HTTP サーバー + 通知プラグイン）

## 概要

Claude Code 通知機能の基盤として、Tauri バックエンドに軽量 HTTP サーバーと macOS デスクトップ通知の仕組みを構築する。このフェーズでは hooks 連携は行わず、curl で直接 POST して通知が発火できる状態を目指す。

## 背景・目的

Claude Code の hooks コマンドから SpecPrompt に通知を送るには、外部プロセスから Tauri アプリにメッセージを送る IPC が必要。localhost HTTP サーバーを Tauri のセットアップフックで起動し、hooks スクリプトが curl で POST するエンドポイントを提供する。

## 要件一覧

### 機能要件

#### F-1: HTTP サーバー起動

- **説明**: Tauri アプリ起動時に `127.0.0.1:19823` で HTTP サーバーを起動する
- **受け入れ条件**:
  - [ ] アプリ起動後に `curl http://127.0.0.1:19823/health` で応答が返る
  - [ ] 外部（LAN 内の他端末）からはアクセスできない

#### F-2: Claude hook エンドポイント

- **説明**: `POST /claude-hook/{event}` で JSON を受け取り、通知分類・メッセージ抽出を行う
- **受け入れ条件**:
  - [ ] `POST /claude-hook/notification` に JSON を送ると macOS 通知が表示される
  - [ ] `POST /claude-hook/stop` に JSON を送ると完了通知が表示される
  - [ ] 不正な JSON でもサーバーがクラッシュしない

#### F-3: 通知分類ロジック

- **説明**: JSON ペイロードのキーワードから通知タイプ（承認待ち / 完了 / エラー / 入力待ち / 注意喚起）を分類する
- **受け入れ条件**:
  - [ ] `permission` / `approve` を含む → 「承認待ち」
  - [ ] `complet` / `finish` を含む → 「完了」
  - [ ] `error` / `failed` を含む → 「エラー」
  - [ ] 分類不能 → 「注意喚起」

#### F-4: フォーカス判定による通知抑制

- **説明**: SpecPrompt がアクティブウィンドウの場合は macOS 通知を抑制する
- **受け入れ条件**:
  - [ ] SpecPrompt にフォーカスがある状態では通知が表示されない
  - [ ] SpecPrompt が背面にある状態では通知が表示される

### 非機能要件

- **パフォーマンス**: HTTP リクエスト処理が 100ms 以内に完了すること
- **保守性**: 通知分類ロジックはユニットテスト可能な純関数として実装すること
- **安全性**: HTTP サーバーは `127.0.0.1` のみにバインドし、外部アクセスを遮断すること

## スコープ

### 対象

- HTTP サーバーの起動・エンドポイント実装
- `tauri-plugin-notification` の導入
- 通知分類・メッセージ抽出ロジック
- フォーカス判定

### 対象外

- hooks スクリプトの作成・配置（Phase 2）
- claude ラッパースクリプト（Phase 2）
- 設定 UI（Phase 3）

## 実装対象ファイル（予定）

- `src-tauri/Cargo.toml` — 依存クレート追加
- `src-tauri/src/commands/notification.rs` — 新規
- `src-tauri/src/commands/mod.rs` — モジュール追加
- `src-tauri/src/lib.rs` — プラグイン登録・HTTP サーバー起動
- `src-tauri/capabilities/default.json` — 権限追加

## 依存関係

- `tauri-plugin-notification` — macOS デスクトップ通知
- HTTP サーバーライブラリ（`actix-web`, `tiny_http`, または `axum` 等）
- `serde_json` — JSON パース（既存）

## 参考資料

- `docs/local/20260413-claude-code通知機能/02_概要設計書.md`
- cmux の通知分類: `cmux/CLI/cmux.swift:13303-13326`
