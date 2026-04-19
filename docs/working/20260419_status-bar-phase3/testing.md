# テスト手順書 - status-bar-phase3

## 概要

Phase 3 は自動テストの追加・ドキュメント整備・PR 作成が主で、UI プロダクション変更を伴わない。そのため手動テストは「Phase 2 の回帰確認」程度に留め、主に自動テストと成果物（ドキュメント・PR）の確認に重点を置く。

## 前提条件

- Phase 1/2 のコミット（`4bff2c4`, `3424e13`）が `feature/status-bar` ブランチに反映済み
- `npm install` 済み、Vitest が起動できる
- `gh` CLI が認証済みで PR 作成可能

## 手動テスト

### ケース 1: Phase 2 機能の回帰なし（簡易確認）

**手順:**

1. `npx tauri dev` でアプリを起動
2. Git リポジトリのプロジェクトを開き、ステータスバー左端にブランチ名が表示されることを確認
3. ターミナルで `git switch -c test/phase3-verify` → 3 秒以内に表示が切り替わることを確認
4. `git switch -` で元のブランチに戻す
5. コンテンツタブで `.md` / `.ts` / `.png` / `.txt` を開き、それぞれ `Markdown` / `Code` / `Image` / `Plain` と表示されることを確認
6. `Ctrl+Tab` でターミナルモードへ切替 → ファイル種別が非表示になることを確認

**期待結果:**

- Phase 2 完了時と同じ挙動（テスト追加によるリグレッションなし）

**確認結果:**

- [ ] OK / NG

---

### ケース 2: steering ドキュメント確認

**手順:**

1. `docs/steering/02_functional_design.md` を開く
2. ステータスバー節が追加されていることを確認
3. 以下の情報が記載されていることを確認:
   - 画面下段に高さ 28px の帯として配置
   - 左端: Git ブランチ名（3 秒間隔ポーリング、非 Git 時非表示）
   - 右端: アクティブファイルのビューア種別（Markdown / Code / Image / Plain、ターミナルモード時非表示）
   - 関連ファイル: `src/components/StatusBar/*`, `src/hooks/useGitBranch.ts`, `src-tauri/src/commands/git.rs::git_branch`
4. 機密情報（メールアドレス・トークン・社内 URL 等）が含まれていないか grep

**期待結果:**

- 上記項目がすべて記載されている
- 機密情報の混入なし

**確認結果:**

- [ ] OK / NG

---

### ケース 3: WBS 更新確認

**手順:**

1. `docs/projects/20260419-ステータスバー機能/03_WBS.md` を開く
2. Phase 3 の T3-1 〜 T3-4 のチェック欄が実態に合わせて更新されていることを確認
3. マイルストーン M1 / M2 / M3 の状態を確認

**期待結果:**

- 実施したタスクは `[x]`、未実施は `[ ]` のまま
- M1 / M2 は Phase 1/2 完了時に達成済みのため `[x]`
- M3 は Phase 3 完了時点で達成

**確認結果:**

- [ ] OK / NG

---

### ケース 4: PR 作成確認

**手順:**

1. `gh pr list` で `feature/status-bar` の PR が 1 件存在することを確認
2. ブラウザで PR を開き、以下を確認:
   - タイトルが 70 文字以内で具体的
   - 本文に Summary / Test plan セクションがある
   - 方針変更（watch → ポーリング）の経緯が明記されている
   - Issue #9 が本 PR のスコープ外である旨の記載がある

**期待結果:**

- PR が作成され、レビュー可能な状態

**確認結果:**

- [ ] OK / NG

## 自動テスト

### フロントエンドテスト（Vitest）

```bash
npm run test
```

- 新規テスト（`useGitBranch` / `BranchIndicator` / `FileTypeIndicator`）がすべてパス
- 既存テストもすべてパス（回帰なし）

### 型チェック

```bash
npx tsc --noEmit
```

- エラーなし

### Lint

```bash
npm run lint
```

- エラーなし

### Rustテスト

```bash
cd src-tauri && cargo test commands::git
```

- Phase 1 の `git_branch` テスト 3 件が引き続きパス

## エッジケース

| ケース | 期待動作 | 確認結果 |
|--------|---------|---------|
| `vi.useFakeTimers()` と `await` の併用でテストがハング | `vi.advanceTimersByTimeAsync` + `waitFor` を適切に使い、タイムアウトさせない | [ ] OK / NG |
| Zustand persist ミドルウェアがテストに副作用を残す | `useXxxStore.setState(initial)` または `zustand/middleware` のモックで対処 | [ ] OK / NG |
| PR 作成時に CI が赤になる | 原因を調査し、修正を本 PR 内でコミットする | [ ] OK / NG |

## 回帰テスト

既存機能への影響がないことを確認する（Phase 3 ではプロダクションコードを触らないため最小限）。

- [ ] ファイルツリー・コンテンツビューア・ターミナルが正常に動作する
- [ ] ステータスバーの表示（ブランチ名・ファイル種別）が Phase 2 完了時と同一
- [ ] `npm run build` が成功する
