# 要件定義書 - Phase 4-B: テスト整備

## 概要

アプリケーションの品質を保証するためのテストスイートを整備する。フロントエンド（Vitest + Testing Library）と バックエンド（cargo test）の両軸でカバレッジを確保し、主要なビジネスロジックとコンポーネントの動作を自動検証できる状態にする。

## 背景・目的

Phase 1〜3-H の実装が進み、コアとなるロジック・ユーティリティ・コンポーネントが出揃った。現時点でテストが存在するが部分的であり、以下のリスクがある：

- `frontmatter.ts`（ドキュメントステータス）や `windowSession.ts`（セッション管理）などの重要なユーティリティが未テスト
- Rust 側の `filesystem.rs`・`config.rs` にすでにテストが存在するが、`cargo test` として CI で実行できる状態かの確認が必要
- リグレッションを検知する仕組みがない

## 現状整理

### 既存テスト（実装済み）

| ファイル | テスト数 | 概要 |
|--------|--------|------|
| `src/lib/viewMode.test.ts` | 12 | ファイル拡張子 → ビューモード変換 |
| `src/stores/appStore.test.ts` | 8 | アプリストア・persist |
| `src/stores/contentStore.test.ts` | 21 | コンテンツタブ・分割・openFile |
| `src/stores/terminalStore.test.ts` | 10 | ターミナルタブ・分割・PTY ID |
| `src/components/SplitPane/SplitPane.test.tsx` | 2 | SplitPane レンダリング |
| `src-tauri/src/commands/filesystem.rs` | 10 | ファイル操作ロジック（cargo test） |
| `src-tauri/src/commands/config.rs` | 9 | 設定読み書きロジック（cargo test） |
| `src-tauri/src/commands/fonts.rs` | 3 | フォント名バリデーション（cargo test） |
| **合計** | **75** | |

### 未テストの重要モジュール

| モジュール | 理由 |
|-----------|------|
| `src/lib/frontmatter.ts` | ステータス解析・書き込みロジックが複雑 |
| `src/lib/windowSession.ts` | Phase 3-H で追加。localStorage 操作を含む |
| `src/lib/shortcuts.ts` | キーボードショートカット定義 |

## 要件一覧

### 機能要件

#### F-1: フロントエンドユーティリティのテスト追加

- **説明**: 未テストの `frontmatter.ts` と `windowSession.ts` に対して Vitest テストを追加する
- **受け入れ条件**:
  - [ ] `frontmatter.ts` の `parseStatus` と `setStatus` に対するテストが実装されている
  - [ ] `windowSession.ts` の `saveMySession`, `loadWindowSessions`, `consolidateAndSave`, `clearWindowSessions` に対するテストが実装されている
  - [ ] `npm test` ですべてのテストが通る

#### F-2: Rust ユニットテストの実行確認と補完

- **説明**: 既存の Rust テストが `cargo test` で全件パスすることを確認し、カバレッジが薄い箇所を補完する
- **受け入れ条件**:
  - [ ] `cd src-tauri && cargo test` がエラーなく全件パスする
  - [ ] `pty.rs` の `cwd` チルダ展開ロジックに対するテストが追加されている

#### F-3: React コンポーネントテストの補完

- **説明**: SplitPane 以外のコンポーネントにもテストを追加し、レンダリングと基本インタラクションを検証する
- **受け入れ条件**:
  - [ ] `ContentView.tsx` が「ファイル未選択時の空メッセージ」「ローディング状態」を正しくレンダリングすることを検証するテストがある
  - [ ] `InlineInput.tsx`（ファイル名インライン入力）の Enter/Escape 操作テストがある

### 非機能要件

- **保守性**: テストは `describe` / `it` で意図が読み取れる日本語で記述する（既存テストのスタイルに合わせる）
- **独立性**: 各テストは他のテストに依存せず、`beforeEach` でストアをリセットする

## スコープ

### 対象

- `src/lib/frontmatter.ts` — ユニットテスト
- `src/lib/windowSession.ts` — ユニットテスト（localStorage モック使用）
- `src-tauri/src/commands/pty.rs` — チルダ展開ロジックのユニットテスト補完
- `src/components/ContentView/ContentView.tsx` — コンポーネントテスト
- `src/components/TreePanel/InlineInput.tsx` — コンポーネントテスト

### 対象外

- E2E テスト（4-B-3: `tauri-driver` を使った E2E は工数・環境整備コストが高く、別タスクで対応）
- PTY の統合テスト（外部プロセス依存のため自動テスト困難）
- VisualRegressionテスト

## 実装対象ファイル（予定）

- `src/lib/frontmatter.test.ts`（新規）
- `src/lib/windowSession.test.ts`（新規）
- `src-tauri/src/commands/pty.rs`（既存ファイルにテスト追加）
- `src/components/ContentView/ContentView.test.tsx`（新規）
- `src/components/TreePanel/InlineInput.test.tsx`（新規）

## 依存関係

- Vitest、@testing-library/react、jsdom は既にセットアップ済み（`vite.config.ts` + `src/test/setup.ts`）
- 追加パッケージは不要

## 参考資料

- `src/test/setup.ts` — テスト環境設定
- `src/stores/contentStore.test.ts` — ストアテストのパターン例
- `src/components/SplitPane/SplitPane.test.tsx` — コンポーネントテストのパターン例
