# Changelog

本プロジェクトの変更履歴。
形式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に準拠し、
[Semantic Versioning](https://semver.org/lang/ja/) を採用する。

## [Unreleased]

## [0.3.3] - 2026-04-26

### Added
- OS 通知クリックで発信元 SDDesk ウィンドウをフォアグラウンド化し、発信元 PTY に紐づくターミナルタブを自動アクティブ化 (#11)
  - コンテンツモード表示中の場合はターミナルモードへ自動切替
  - 複数ウィンドウ運用に対応（`is_app_focused` を `is_window_focused(label)` に置換、対象ウィンドウのみへ `notification-activate` を `emit_to`）

## [0.3.0] - 2026-04-25

### Changed
- **プロダクト名を SpecPrompt から SDDesk に改名**
  - 同名の別プロダクト [specprompt.com](https://specprompt.com/) との衝突を回避するため
  - 由来: `SDD`（Spec-Driven Development）+ `Desk`（作業机）
- Bundle Identifier を `com.specprompt.desktop` → `io.github.sakamotchi.sddesk` に変更
- macOS ウィンドウタイトル・メニューラベル・通知タイトル等の表示文字列を SDDesk に更新
- リポジトリ URL を `github.com/sakamotchi/sddesk` に変更（旧 URL からは自動リダイレクト）

### Added
- 旧 config dir (`~/.config/spec-prompt/`) から新 config dir (`~/.config/sddesk/`) への自動マイグレーション
  - 旧 `config.json` は `config.json.migrated` にリネームして保全
- 旧 localStorage キー（`spec-prompt-*` / `specprompt-*`）から新キー（`sddesk-*`）への自動マイグレーション
- 共通ヘルパー `src/lib/legacyStorageMigration.ts` を新設

### Migration Notes (既存 v0.2.x ユーザー向け)
- ✅ **継承される**: 最近のプロジェクト履歴・外観設定（テーマ・フォント・通知 ON/OFF）
- ⚠️ **初期化される**: ウィンドウセッション・プロンプトパレットの履歴/テンプレート・展開ディレクトリ等の UI 状態
  - Bundle ID 変更による WebView ストレージのサンドボックス分離のため、本バージョンでは引き継ぎ不可
- 旧 config が必要な場合: `~/.config/spec-prompt/config.json.migrated` から手動取り出し可能

## [0.2.9] - 2026-04-19

### Fixed
- ターミナルのスクロール中に範囲選択解除すると描画が消える不具合を修正

## [0.2.8] - 2026-04-18

### Changed
- macOS のウィンドウタブを 11 以降の丸型スタイルで描画するように `LSMinimumSystemVersion` を 11.0 に引き上げ

[Unreleased]: https://github.com/sakamotchi/sddesk/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/sakamotchi/sddesk/compare/v0.2.9...v0.3.0
[0.2.9]: https://github.com/sakamotchi/sddesk/compare/v0.2.8...v0.2.9
[0.2.8]: https://github.com/sakamotchi/sddesk/releases/tag/v0.2.8
