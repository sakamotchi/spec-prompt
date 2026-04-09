# テスト手順書 - Phase 4-C: CI/CD（GitHub Actions）

## 概要

GitHub Actions ワークフローが意図通りに動作することを確認します。

## 前提条件

- ワークフローファイルが `main` または PR ブランチにプッシュ済みであること
- GitHub リポジトリが公開または Actions が有効化されていること

---

## ケース 1: CI ワークフローの確認（PR トリガー）

### 手順

1. `feature/4-C-ci-cd` ブランチから `main` への PR を作成する
2. GitHub の「Actions」タブを開く
3. `CI` ワークフローが自動実行されることを確認する

### 期待結果

- `changes` ジョブが実行され、変更されたパスに応じてフィルタが機能していること
- フロントエンド変更がある場合:
  - `test-frontend` ジョブが実行され `npm run lint` + `npm test` が通ること
  - `build-check` ジョブが実行されること
- バックエンド変更がある場合:
  - `test-backend` ジョブが実行され `cargo test` が通ること
  - `build-check` ジョブが実行されること
- 変更がないパスのジョブはスキップ（`skipped`）されること

**確認結果:**

- [ ] OK / NG

---

## ケース 2: パスフィルタの動作確認

### 手順

1. `src/` 配下のみを変更した PR を作成する
2. CI の各ジョブの実行状況を確認する

### 期待結果

- `test-frontend`: 実行される
- `test-backend`: スキップされる
- `build-check`: 実行される

**確認結果:**

- [ ] OK / NG

---

## ケース 3: ビルドテストワークフローの手動実行

### 手順

1. GitHub の「Actions」タブを開く
2. 「Build Test」ワークフローを選択する
3. 「Run workflow」をクリックし、`platform: macos` を選択して実行する
4. ジョブの完了を待つ
5. 「Artifacts」セクションに成果物が添付されていることを確認する

### 期待結果

- macOS ビルドが成功し、`build-macos-aarch64-apple-darwin` と `build-macos-x86_64-apple-darwin` の Artifact が生成されること
- Artifact の保持期間が 7 日と表示されること

**確認結果:**

- [ ] OK / NG

---

## ケース 4: リリースワークフローの確認（タグプッシュ）

### 手順

1. テスト用タグをプッシュする:
   ```bash
   git tag v0.0.1-test
   git push origin v0.0.1-test
   ```
2. GitHub の「Actions」タブで「Release」ワークフローが起動することを確認する
3. 「Releases」タブでドラフトまたは公開リリースが作成されることを確認する

### 期待結果

- 4 つの matrix ジョブ（macOS × 2、Windows、Linux）が実行されること
- GitHub Releases に `.dmg`（macOS）、`.msi`（Windows）、`.deb`（Linux）が添付されること
- macOS は証明書なし（Secrets 未設定）でもビルド自体は完了すること（署名はスキップ）

**確認結果:**

- [ ] OK / NG

---

## 回帰テスト

- [ ] CI でのテスト実行結果が `npm test`（ローカル）と一致すること
- [ ] ワークフロー追加後もローカル開発フロー（`npm run dev`, `npx tauri dev`）に影響がないこと

---

## エッジケース

| ケース | 期待動作 | 確認結果 |
|--------|---------|---------|
| フロントエンドとバックエンド両方を変更した PR | 3 ジョブすべて実行される | |
| 変更なし（ドキュメントのみ変更） | `test-frontend`・`test-backend` ともスキップ | |
| Windows ビルドで依存関係エラー | ジョブが失敗し原因がログに出力される | |
