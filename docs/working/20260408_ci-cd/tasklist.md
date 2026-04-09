# タスクリスト - Phase 4-C: CI/CD（GitHub Actions）

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 1 |
| 進行中 | 0 |
| 未着手 | 3 |

## タスク一覧

### T-1: 要件定義・設計

- [x] 要件定義書の作成 (`requirements.md`)
- [x] 設計書の作成 (`design.md`)
- [x] レビュー完了

**WBSリファレンス**: Phase 4-C 準備作業

---

### T-2: CI ワークフロー作成（4-C-1）

**WBSリファレンス**: 4-C-1

- [ ] `.github/workflows/ci.yml` を新規作成
  - `pull_request: branches: [main]` トリガー
  - `dorny/paths-filter@v3` によるパスフィルタ（`src/**` / `src-tauri/**`）
  - `test-frontend` ジョブ: `npm run lint` + `npm test`
  - `test-backend` ジョブ: `cargo test --manifest-path=src-tauri/Cargo.toml`
  - `build-check` ジョブ: `npm run build` + `cargo check --manifest-path=src-tauri/Cargo.toml`
- [ ] GitHub で PR を作成してワークフローの動作確認

**対象ファイル:**
- `.github/workflows/ci.yml`（新規）

---

### T-3: ビルドテストワークフロー作成（4-C-2 / 4-C-3）

**WBSリファレンス**: 4-C-2, 4-C-3

- [ ] `.github/workflows/build-test.yml` を新規作成
  - `workflow_dispatch` トリガー（platform 選択: all / macos / windows / linux）
  - macOS: `aarch64-apple-darwin` + `x86_64-apple-darwin` の matrix
  - Windows: `windows-latest`
  - Linux: `ubuntu-22.04`（Ubuntu 依存パッケージインストール含む）
  - 成果物を Artifact にアップロード（retention 7 日）
- [ ] GitHub の Actions 画面から手動実行して動作確認

**対象ファイル:**
- `.github/workflows/build-test.yml`（新規）

---

### T-4: リリースワークフロー作成

**WBSリファレンス**: 4-C 完了確認

- [ ] `.github/workflows/release.yml` を新規作成
  - `push: tags: ['v*']` トリガー
  - `tauri-apps/tauri-action@v0` を使用
  - matrix: macOS × 2（ARM + Intel）、Windows、Linux
  - macOS 署名・Notarization 用 Secrets を環境変数として定義（値は後で設定）
  - `GITHUB_TOKEN` で GitHub Releases に自動公開
- [ ] `v0.0.1-test` タグをプッシュして動作確認（macOS 署名なしでの動作確認）
- [ ] tasklist・testing.md を更新

**対象ファイル:**
- `.github/workflows/release.yml`（新規）

**ブランチ**: `feature/4-C-ci-cd`

---

## 完了条件

- [ ] 全タスクが完了
- [ ] PR 作成時に CI が自動実行されること
- [ ] `workflow_dispatch` でビルドテストが手動実行できること
- [ ] タグプッシュ時に GitHub Releases が自動作成されること
- [ ] `develop` ブランチへのマージ済み
