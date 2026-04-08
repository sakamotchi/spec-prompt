# テスト手順書 - Phase 4-B: テスト整備

## 概要

テスト整備フェーズ自体のテスト確認方法を記載します。「テストが正しく動作すること」を確認します。

## 前提条件

- `npm install` が完了していること
- Rust ツールチェーンがインストールされていること（`cargo --version` で確認）

---

## 自動テスト実行手順

### フロントエンドテスト（Vitest）

```bash
# 全テストを実行
npm test

# ウォッチモード（開発中）
npm run test:watch

# 特定ファイルのみ実行
npx vitest run src/lib/frontmatter.test.ts
npx vitest run src/lib/windowSession.test.ts
```

**期待結果:**

```
 Test Files  X passed (X)
      Tests  XX passed (XX)
   Duration  ...
```

- すべてのテストが `passed` になること
- `failed` が 0 件であること

---

### Rust ユニットテスト（cargo test）

```bash
cd src-tauri
cargo test
```

**期待結果:**

```
running X tests
test commands::filesystem::tests::... ok
test commands::config::tests::... ok
test commands::pty::tests::... ok
...
test result: ok. X passed; 0 failed; 0 ignored
```

- `0 failed` であること

---

## 手動テスト

### ケース 1: 新規追加テストの内容確認

**手順:**

1. `src/lib/frontmatter.test.ts` を開く
2. `npm test` を実行する
3. frontmatter テストの結果を確認する

**期待結果:**

- `parseStatus` 関連テストがすべて `✓` になる
- `setStatus` 関連テストがすべて `✓` になる

**確認結果:**

- [ ] OK / NG

---

### ケース 2: windowSession テストの確認

**手順:**

1. `src/lib/windowSession.test.ts` を開く
2. `npm test` を実行する

**期待結果:**

- `saveMySession`, `loadWindowSessions`, `consolidateAndSave`, `clearWindowSessions` の各テストが `✓` になる
- localStorage の分離（`beforeEach` で `clear()`）が機能している

**確認結果:**

- [ ] OK / NG

---

### ケース 3: ContentView コンポーネントテストの確認

**手順:**

1. `src/components/ContentView/ContentView.test.tsx` を開く
2. `npm test` を実行する

**期待結果:**

- ファイル未選択時のメッセージ表示テストが `✓` になる
- ローディング状態のテストが `✓` になる

**確認結果:**

- [ ] OK / NG

---

### ケース 4: InlineInput コンポーネントテストの確認

**手順:**

1. `src/components/TreePanel/InlineInput.test.tsx` を開く
2. `npm test` を実行する

**期待結果:**

- テキスト入力・Enter・Escape の各テストが `✓` になる

**確認結果:**

- [ ] OK / NG

---

### ケース 5: Rust `pty.rs` チルダ展開テストの確認

**手順:**

1. `cd src-tauri && cargo test` を実行する
2. `pty::tests` セクションの出力を確認する

**期待結果:**

- `test_resolve_cwd_tilde` などのテストが `ok` になる

**確認結果:**

- [ ] OK / NG

---

### ケース 6: 既存テストへのリグレッションがないこと

**手順:**

1. `npm test` を実行する
2. テスト結果を確認する

**期待結果:**

- 既存 5 ファイル（`viewMode`, `appStore`, `contentStore`, `terminalStore`, `SplitPane`）のテストがすべてパスしている
- 追加テストファイルも含めて全件 `passed`

**確認結果:**

- [ ] OK / NG

---

## エッジケース

| ケース | 期待動作 | 確認結果 |
|--------|---------|---------|
| テスト間で localStorage が汚染されていないか | `beforeEach(() => localStorage.clear())` により各テストが独立している | |
| Tauri IPC モックが意図しない副作用を起こしていないか | `vi.mock` のスコープが各テストファイル内に閉じている | |
| cargo test が CI 環境でも通るか（HOME 環境変数あり） | `std::env::var("HOME")` が取れない場合に fallback する | |

---

## 回帰テスト

- [ ] `npm run lint` がエラーなし
- [ ] `cd src-tauri && cargo check` がエラーなし
- [ ] `npm test` で既存テスト（53件）がすべてパス
- [ ] アプリ本体の動作に影響がないこと（テストファイルのみ追加のため影響なし）
