# 設計書 - Phase 4-C: CI/CD（GitHub Actions）

## アーキテクチャ

### ワークフロー構成図

```
.github/workflows/
├── ci.yml          — PR 時: lint + test + build-check（パスフィルタ付き）
├── build-test.yml  — 手動: マルチプラットフォームビルド確認
└── release.yml     — タグプッシュ時: 全プラットフォームリリース
```

### トリガー一覧

| ワークフロー | トリガー | 実行タイミング |
|------------|---------|--------------|
| `ci.yml` | `pull_request: branches: [main]` | main への PR 作成・更新時 |
| `build-test.yml` | `workflow_dispatch` | 手動実行 |
| `release.yml` | `push: tags: ['v*']` | `v1.0.0` 等のタグプッシュ時 |

---

## 実装方針

### パスフィルタ設計（ci.yml）

`sql-query-build` の構成をベースに、spec-prompt のディレクトリ構造に合わせてフィルタを調整する。

```yaml
filters: |
  frontend:
    - 'src/**'
    - 'index.html'
    - 'package.json'
    - 'package-lock.json'
    - 'vite.config.ts'
    - 'tsconfig.json'
  backend:
    - 'src-tauri/**'
```

`sql-query-build` は `app/**` と `nuxt.config.ts` を対象にしているが、spec-prompt は `src/**` と `vite.config.ts` を使用する。

### ジョブ依存関係（ci.yml）

```
changes ──┬──► test-frontend  (frontend == true の場合)
           ├──► test-backend   (backend == true の場合)
           └──► build-check    (frontend OR backend == true の場合)
```

### コマンドマッピング

| spec-prompt コマンド | sql-query-build との差分 |
|--------------------|------------------------|
| `npm test` | sql-query-build は `npm run test:run`。spec-prompt の scripts には `test` が定義済み |
| `npm run lint` | 同一 |
| `npm run build` | `tsc && vite build`（scripts の `build` で実行） |
| `cargo test --manifest-path=src-tauri/Cargo.toml` | 同一 |
| `cargo check --manifest-path=src-tauri/Cargo.toml` | 同一 |

### Ubuntu 依存関係

Tauri v2 のビルドに必要なパッケージ（`sql-query-build` と同一）：

```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

### macOS ビルドターゲット（build-test.yml / release.yml）

| ターゲット | 説明 |
|-----------|------|
| `aarch64-apple-darwin` | Apple Silicon（M1/M2/M3） |
| `x86_64-apple-darwin` | Intel Mac |

### リリースワークフロー（release.yml）の Secrets

証明書設定は後から行うため、Secrets の参照は実装しておき値は空でも動作するよう設計する。

| Secret 名 | 用途 |
|-----------|------|
| `APPLE_CERTIFICATE` | .p12 証明書（base64） |
| `APPLE_CERTIFICATE_PASSWORD` | .p12 パスワード |
| `APPLE_SIGNING_IDENTITY` | Developer ID |
| `APPLE_ID` | Apple ID（Notarization） |
| `APPLE_PASSWORD` | App-specific password |
| `APPLE_TEAM_ID` | Team ID |
| `GITHUB_TOKEN` | リリース作成（自動提供） |

---

## ワークフロー詳細設計

### ci.yml 全体構造

```yaml
name: CI
on:
  pull_request:
    branches: [main]

jobs:
  changes:        # パスフィルタ判定
  test-frontend:  # npm run lint + npm test
  test-backend:   # cargo test
  build-check:    # npm run build + cargo check
```

### build-test.yml 全体構造

```yaml
name: Build Test
on:
  workflow_dispatch:
    inputs:
      platform: { type: choice, options: [all, macos, windows, linux] }

jobs:
  build-macos:    # matrix: aarch64 + x86_64
  build-windows:
  build-linux:
```

### release.yml 全体構造

```yaml
name: Release
on:
  push:
    tags: ['v*']

jobs:
  build-tauri:
    strategy:
      matrix:
        include:
          - platform: macos-latest, args: --target aarch64-apple-darwin
          - platform: macos-latest, args: --target x86_64-apple-darwin
          - platform: ubuntu-22.04, args: ''
          - platform: windows-latest, args: ''
    uses: tauri-apps/tauri-action@v0
```

---

## データ構造

### 生成ファイル構成

```
.github/
└── workflows/
    ├── ci.yml          （新規）
    ├── build-test.yml  （新規）
    └── release.yml     （新規）
```

---

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| `dorny/paths-filter@v3` でパスフィルタ | 変更のないジョブをスキップし CI 時間を短縮。sql-query-build と同一 Action | フィルタなし（変更毎に全ジョブ実行、時間・コスト増） |
| `npm test`（`vitest run`）を CI で使用 | package.json の `test` スクリプトがすでに `vitest run`（非ウォッチ）に設定済み | `npx vitest run` を直接指定（冗長） |
| リリースは `tauri-apps/tauri-action@v0` | 公式 Action。ビルド・GitHub Releases 作成・アーティファクト添付を一括処理 | 手動で `cargo tauri build` → `gh release upload`（複雑） |
| 証明書 Secrets は変数として記述しておく | 実装時に Secrets が空でも CI は通る（macOS の署名はスキップされる）。後から値を設定するだけで有効化できる | 証明書設定後に実装（CI の整備が後ろ倒しになる） |
| Ubuntu ランナーでビルドチェック（CI） | 高速・無料枠が大きい。macOS ランナーはコスト高（分単価 10 倍） | macOS ランナーでビルドチェック（コスト大） |

## 未解決事項

- [ ] `typecheck` スクリプト（`tsc --noEmit`）の追加検討 — `npm run build` に `tsc` が含まれるため必須ではないが、sql-query-build に合わせて追加するか判断する
