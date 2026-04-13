# 要件定義書 - Phase 3: 設定 UI + 仕上げ

## 概要

Phase 1-2 で構築した通知機能に対して、アプリ内設定画面から ON/OFF を切り替える UI を追加し、通知設定を永続化する。

## 背景・目的

通知を常時必要としないユーザーもいるため、設定画面から簡単に切り替えられる必要がある。ON/OFF は PTY 起動時の環境変数注入に連動し、settings.json の操作は不要。

## 要件一覧

### 機能要件

#### F-1: appStore に notificationEnabled 追加

- **説明**: 通知の ON/OFF 状態を Zustand ストアで管理し、persist ミドルウェアで永続化する
- **受け入れ条件**:
  - [ ] デフォルト値は `true`（ON）
  - [ ] アプリ再起動後も設定が維持される

#### F-2: 設定画面にトグル追加

- **説明**: 既存の設定画面に「Claude Code 通知」のトグルスイッチを追加する
- **受け入れ条件**:
  - [ ] トグルで ON/OFF を切り替えられる
  - [ ] 現在の状態が視覚的に分かる

#### F-3: PTY 起動時に設定値を参照

- **説明**: `spawn_pty` で PTY を起動する際に `notificationEnabled` の値を参照し、OFF なら環境変数を設定しない
- **受け入れ条件**:
  - [ ] 通知 ON → `SPEC_PROMPT_NOTIFICATION=1` と PATH が設定される
  - [ ] 通知 OFF → 環境変数が設定されず、ラッパーが素通しする
  - [ ] 設定変更は次回の PTY 起動から反映される（既存ターミナルには影響しない）

### 非機能要件

- **ユーザビリティ**: トグルの操作で即座に状態が反映されること（UI 上）
- **外観・デザイン**: 既存の設定画面のスタイルに統一する。`--color-bg-elevated`, `--color-border` 等の CSS カスタムプロパティを使用

## スコープ

### 対象

- appStore への `notificationEnabled` 追加
- 設定画面 UI の更新
- pty.rs での設定値参照
- 通知分類のユニットテスト

### 対象外

- アプリ内通知パネル（履歴・未読バッジ）
- 通知クリックでウィンドウフォーカス

## 実装対象ファイル（予定）

- `src/stores/appStore.ts` — `notificationEnabled` 追加
- `src/components/Settings.tsx` — トグル UI 追加
- `src-tauri/src/commands/pty.rs` — 設定値の参照
- `src/lib/tauriApi.ts` — 設定値を Rust に渡す（必要に応じて）

## 依存関係

- Phase 1, 2 が完了していること

## 参考資料

- 既存の Settings.tsx の実装
- `docs/steering/02_functional_design.md`
