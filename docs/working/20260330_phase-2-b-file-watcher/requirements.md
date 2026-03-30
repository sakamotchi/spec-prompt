# 要件定義書 - Phase 2-B: ファイル監視・自動更新

## 概要

プロジェクトディレクトリのファイル変更を監視し、コンテンツビューアとファイルツリーを自動更新する機能を実装する。ファイルを外部エディタで編集・保存した際に、アプリを操作せずにリアルタイムで反映させる。

## 背景・目的

SpecPrompt は「仕様書を見ながら AI と対話する」ツールであり、Claude Code などの AI CLI がファイルを更新した場合に即座にプレビューが更新されることが重要。手動リロード不要の自動更新体験が差別化要素の一つ。

## 要件一覧

### 機能要件

#### F-1: ファイル監視開始（`watch_fs` コマンド）

- **説明**: プロジェクトルートディレクトリの監視を開始し、変更を検知したら `file-changed` イベントをフロントエンドに送信する。
- **受け入れ条件**:
  - [ ] `invoke('watch_fs', { path })` でディレクトリ監視を開始できる
  - [ ] `node_modules/`, `.git/` 等の変更は無視する
  - [ ] 監視はプロジェクトルート設定時（`setProjectRoot` 呼び出し時）に自動で開始する
  - [ ] 既に監視中の場合は重複して監視しない

#### F-2: コンテンツビューア自動更新

- **説明**: `file-changed` イベントを受け取ったとき、現在表示中のファイルなら自動で再読み込みする。
- **受け入れ条件**:
  - [ ] 現在表示中のファイル（`contentStore.filePath`）と変更されたファイルのパスが一致した場合に再読み込みする
  - [ ] 500ms 以内に表示が更新される（NFR-03）
  - [ ] 再読み込み中にスクロール位置がリセットされない（理想）

#### F-3: ファイルツリー自動更新

- **説明**: ファイルの追加・削除・リネームを検知したとき、ファイルツリーを再取得して再描画する。
- **受け入れ条件**:
  - [ ] ファイル追加時にツリーに新しいノードが表示される
  - [ ] ファイル削除時にツリーからノードが消える
  - [ ] ディレクトリ追加・削除時もツリーが更新される

### 非機能要件

- **パフォーマンス**: ファイル変更から表示更新まで 500ms 以内（NFR-03）
- **安定性**: `node_modules/`, `.git/` 等の大量変更でアプリがハングしない
- **保守性**: `watcher.rs` として独立モジュールに分離する

## スコープ

### 対象

- Rust バックエンド: `watch_fs` コマンド + `watcher.rs` モジュール
- フロントエンド: `file-changed` イベントの受信処理（`appStore` / `ContentView`）

### 対象外

- ファイル編集機能（スコープ外）
- 複数ディレクトリの同時監視
- リモートファイルシステムの監視

## 実装対象ファイル（予定）

- `src-tauri/src/watcher.rs`（新規）
- `src-tauri/src/commands/filesystem.rs`（`watch_fs` コマンド追加）
- `src-tauri/src/lib.rs`（コマンド登録）
- `src/stores/appStore.ts`（`watch_fs` 呼び出し・`file-changed` イベント購読）
- `src/components/ContentView/ContentView.tsx`（`file-changed` で再読み込み）

## 依存関係

- `tauri-plugin-fs`（Cargo.toml に既に追加済み）
- `appStore.setProjectRoot` — プロジェクトルート設定時に監視を開始するトリガー

## 既知の制約

- `tauri-plugin-fs` の `watch` は Tauri v2 で利用可能
- `node_modules/` などは除外しないと大量のイベントが発生してパフォーマンスが劣化する
- macOS の FSEvents は短時間に大量のイベントをバッチで通知する場合がある（デバウンス推奨）

## 参考資料

- `docs/steering/features/content-viewer.md` — CV-10, CV-11 要件
- `docs/steering/03_architecture_specifications.md` — `file-changed` イベント仕様
