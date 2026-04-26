---
name: release
description: main ブランチで前回タグからの差分を集計し、CHANGELOG.md に新バージョンエントリを追加してから patch/minor/major リリースを実行します。「リリースして」「patchリリース」「minorリリースお願い」などで呼び出されます。引数 patch/minor/major/x.y.z が必須です。
---

# リリーススキル

## 概要

`main` ブランチで前回リリースタグからの差分を `git log` で集計し、
CHANGELOG.md に新バージョンエントリを追記してから `npm run release {type}` を
実行する一連のフローを自動化します。

複数 PR をまとめてリリースするケースにも対応します。

## 使用シーン

- マージ済みの PR をまとめてリリースしたいとき
- バージョン更新と CHANGELOG 更新を同時に正しく行いたいとき
- リリース前のブランチ・CI 状態チェックを忘れたくないとき

## 引数

**必須**: `patch` | `minor` | `major` | `x.y.z`

| 引数 | 例 (現在 0.3.3) | 用途 |
|------|---------------|------|
| `patch` | 0.3.3 → 0.3.4 | バグ修正・小さな改善 |
| `minor` | 0.3.3 → 0.4.0 | 後方互換のある機能追加 |
| `major` | 0.3.3 → 1.0.0 | 後方互換のない変更 |
| `x.y.z` | 任意 | 明示指定 |

引数なしで呼ばれた場合は使い方を表示してエラー終了します。

## 実行手順

### 0. 引数バリデーション

引数を確認します。`patch` / `minor` / `major` / `^\d+\.\d+\.\d+(-[\w.]+)?$` のいずれにも
合致しない場合は使い方を表示してエラー終了します。

### 1. 前提条件チェック（すべて満たさなければエラー停止）

```bash
# 現在ブランチが main か
git branch --show-current  # → "main"

# 未コミット変更がないか
git status --porcelain  # → 空

# origin/main と同期済みか
git fetch origin main
git rev-parse HEAD  # ローカル
git rev-parse origin/main  # リモート → 一致

# main HEAD の CI が SUCCESS か
gh run list --branch main --limit 1 --json conclusion,status,name
# conclusion=success かつ status=completed
```

いずれか NG ならその旨をユーザーに伝えて停止します。
**自動で git pull / git stash 等の修正は行いません**（ユーザーが意図して整える）。

### 2. 前回タグから HEAD までの差分を収集

```bash
# 前回タグ
PREV_TAG=$(git describe --tags --abbrev=0)

# マージコミットを除いた user-facing 変更を抽出
git log ${PREV_TAG}..HEAD --no-merges --pretty="%h|%s|%b---END---"
```

`--no-merges` で素のマージコミット（"Merge pull request #N from ..."）を除外しつつ、
squash merge / rebase merge / 通常 commit すべてを拾えます。

### 3. 新バージョンの計算と表示

引数からバージョンを計算してユーザーに提示します:
- `patch`: `[major].[minor].[patch+1]`
- `minor`: `[major].[minor+1].0`
- `major`: `[major+1].0.0`
- `x.y.z`: そのまま

```
📦 リリース準備
  前回タグ: v0.3.3
  新バージョン: v0.3.4
  対象 commit: 5 件
```

### 4. CHANGELOG エントリを分類して案を生成

各 commit を type プレフィックスで分類します:

| プレフィックス | CHANGELOG セクション |
|--------------|-------------------|
| `feat:` / `feat(...):` | **Added** |
| `fix:` / `fix(...):` | **Fixed** |
| `BREAKING CHANGE:` を含む / `!:` 付き | **Changed**（注釈付き） |
| `refactor:` / `chore:` / `docs:` / `test:` / `style:` / `ci:` | **スキップ**（user-facing でないため） |
| その他（type プレフィックスなし等） | **Changed** |

各エントリは:
- `feat: 通知クリックで...` → `- 通知クリックで...` （プレフィックスを除去）
- `(#11)` などの issue 参照は本文から抽出して末尾に保持

エントリ案をマークダウン形式でユーザーに提示し、承認を求めます。
ユーザーが「修正したい」と言った場合は対話で編集してから次へ進みます。

### 5. CHANGELOG.md への挿入

`[Unreleased]` セクションの**直下**に新バージョンセクションを挿入します。
日付は `git log` の現在日時ではなく、**今日の日付** (`YYYY-MM-DD` 形式) を使います。

挿入例:

```markdown
## [Unreleased]

## [0.3.4] - 2026-04-26     ← 新規挿入

### Fixed
- ...

## [0.3.3] - 2026-04-26     ← 既存
...
```

`[Unreleased]` セクション自体は触りません（PR 側で Unreleased を運用する将来運用への移行を阻害しないため）。

### 6. CHANGELOG コミット & push

```bash
git add CHANGELOG.md
git commit -m "docs: CHANGELOG に v{new_version} を追記

{ユーザーに見せた CHANGELOG エントリ本文を要約}

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

git push origin main
```

push が `branch protection bypass` 警告を出すのは既知（管理者権限で main に直接 push する運用）。
push 自体が失敗したら停止します。

### 7. `npm run release {引数}` を実行

```bash
npm run release {引数}
```

`scripts/release.js` が以下を実行:
1. `npm version {引数} -m "release: v%s"` （preversion でテスト、version でファイル同期）
2. `git push && git push --tags`
3. GitHub Actions のリリースワークフローが起動

### 8. 完了報告

GitHub Actions の進捗 URL を表示します:

```
✅ リリース完了!
  バージョン: v{new_version}
  Actions: https://github.com/sakamotchi/sddesk/actions
```

必要に応じて `gh run list --limit 1` で起動した workflow の run id も表示します。

## エラーハンドリング指針

| 状況 | 対応 |
|------|------|
| 引数なし / 不正引数 | 使い方表示 → エラー終了 |
| 現在ブランチが main でない | 「main に切り替えてから再実行してください」→ 停止 |
| 未コミット変更あり | 該当ファイルを表示 → 停止 |
| origin/main と乖離 | `git pull` / `git push` を案内 → 停止 |
| 直近の CI が失敗 | 失敗 workflow の URL を表示 → 停止 |
| 対象 commit が 0 件 | 「前回リリースから新規 commit がありません」→ 停止 |
| 全 commit が `refactor:` / `docs:` のみ等で CHANGELOG 空になる | ユーザーに警告し「リリースをスキップ / 強制続行」を確認 |
| `npm run release` が失敗 | エラー内容を表示。バージョン同期コミット (`release: v{x}`) が中途半端に残っている可能性があるため、リカバリ手順を案内 |

## やらないこと（明示的にスコープ外）

- `git pull` / `git stash` / `git checkout main` などの自動実行
- 失敗 commit のリカバリ（rollback）
- リリース後の GitHub Release ページの編集（GitHub Actions に委譲）
- バージョン種別の自動推奨（`feat:` あれば minor 推奨、など）
  - 引数で明示することで意図を確実にする方針

## 関連ファイル

- `scripts/release.js` — npm version + tag push を実行するスクリプト本体
- `scripts/sync-version.js` — package.json → tauri.conf.json / Cargo.toml への version 同期
- `scripts/README.md` — リリースプロセスのリファレンス
- `CHANGELOG.md` — 形式は Keep a Changelog 1.1.0 + Semantic Versioning 準拠
