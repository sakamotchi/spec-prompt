# テスト手順書 - prompt-palette-history-template-p1-foundation

## 概要

このドキュメントでは、プロンプトパレット履歴・テンプレート機能 Phase 1（基盤整備）のテスト手順を記載します。

Phase 1 は **UI 変更なし**のため、確認の主軸は以下:
- 自動テスト（ストア・ユーティリティのユニットテスト）
- 既存 UX にリグレッションがないことの回帰確認
- 永続化が実際に localStorage に書き込まれ、再起動後に復元されることの手動確認

## 前提条件

- `npm install` 済み
- `npx tauri dev` でアプリが起動できる状態
- ブラウザ DevTools（Tauri WebView の DevTools）が使える状態

## 手動テスト

### ケース 1: 既存 UX のリグレッション確認（起動・送信）

**手順:**

1. `npx tauri dev` でアプリを起動する
2. 任意のターミナルタブを開く（PTY が立ち上がった状態にする）
3. `⌘⇧P`（macOS）または `Ctrl+⇧+P`（Windows/Linux）でプロンプトパレットを起動する
4. textarea に `echo phase1-test` を入力する
5. `⌘Enter` / `Ctrl+Enter` で送信する

**期待結果:**

- パレットが閉じ、ターミナルに `echo phase1-test` が送信されて実行される
- ターミナルにフォーカスが戻る
- 既存の挿入フラッシュ動作（`lastInsertAt` による枠線ハイライト）に変化なし

**確認結果:**

- [ ] OK / NG

---

### ケース 2: 既存 UX のリグレッション確認（パス挿入）

**手順:**

1. プロンプトパレットを開いた状態でファイルツリー上のファイルを `Ctrl+Click`（あるいは右クリックメニュー「パスをターミナルに挿入」）
2. textarea にパスが挿入されるのを確認

**期待結果:**

- パスが textarea のキャレット位置に挿入される
- 挿入完了時に textarea がフラッシュする（既存挙動）
- `prefers-reduced-motion` 有効時はフラッシュが抑制される（既存挙動）

**確認結果:**

- [ ] OK / NG

---

### ケース 3: 永続化（localStorage 書き込み確認）

**手順:**

1. アプリを起動し、DevTools（Tauri WebView）を開く
2. DevTools のコンソールで以下を実行して履歴とテンプレを直接追加する:

   ```javascript
   const store = window.__ZUSTAND_STORE__ ?? null  // ストア公開されていなければ使えない
   // 代替: DOM から直接操作できないため、下記コマンドで追加する想定
   ```

   ※ ストアが `window` に公開されていない場合は、DevTools Application タブで localStorage に直接キーを追加する:

   ```
   Key:   spec-prompt:prompt-palette
   Value: {"state":{"history":[{"id":"test-1","body":"hello","createdAt":1745000000000}],"templates":[{"id":"tpl-1","name":"test","body":"{{path}}","updatedAt":1745000000000}]},"version":1}
   ```

3. DevTools の Application → Local Storage で `spec-prompt:prompt-palette` エントリが存在することを確認
4. アプリを閉じる
5. 再度 `npx tauri dev` で起動する
6. DevTools → Application → Local Storage で `spec-prompt:prompt-palette` が復元されていることを確認

**期待結果:**

- localStorage に `spec-prompt:prompt-palette` キーが存在する
- 値は `{"state":{"history":[...],"templates":[...]},"version":1}` の形式
- 再起動後も同じデータが保持されている
- `drafts`, `isOpen`, `dropdown`, `editorState` など**ランタイム状態は永続化されていない**（JSON に含まれない）

**確認結果:**

- [ ] OK / NG

---

### ケース 4: ストア API の健全性（DevTools 手動呼び出し）

**手順:**

1. アプリを起動し DevTools コンソールを開く
2. ストアがグローバルに露出していなければ、Phase 1 のデバッグ用途限定で `src/main.tsx` などに `window.__promptPaletteStore = usePromptPaletteStore` を一時追加（確認後に削除する方針で OK）
3. コンソールで以下を順に実行:

   ```javascript
   const s = window.__promptPaletteStore.getState()
   s.pushHistory('hello')
   s.pushHistory('hello')  // 直前重複なので増えない
   s.pushHistory('world')
   console.log(s.history.map((h) => h.body))  // ["world", "hello"]
   const t = s.upsertTemplate({ name: 'x', body: '{{path}}' })
   console.log(s.templates)  // [{ id: ..., name: 'x', body: '{{path}}', updatedAt: ... }]
   s.removeTemplate(t.id)
   console.log(s.templates)  // []
   ```

**期待結果:**

- `pushHistory` の挙動が想定通り（重複排除）
- `upsertTemplate` で template が追加される
- `removeTemplate` で削除される

**確認結果:**

- [ ] OK / NG

※ 確認完了後、デバッグ用の `window.__promptPaletteStore` 代入は**必ず削除**してからコミットすること。

---

## 自動テスト

### フロントエンドテスト（Vitest）

```bash
cd /Users/sakamotoyoshitaka/Documents/Github/spec-prompt
npm run test
```

以下が全件グリーンであること:

- `src/stores/promptPaletteStore.test.ts` — 既存テスト＋ Phase 1 追加テスト
- `src/lib/templatePlaceholders.test.ts`（新規）

**期待結果:**

- 全テストが pass
- `promptPaletteStore.test.ts` に Phase 1 で追加した `pushHistory`, `setHistoryCursor`, `upsertTemplate`, `removeTemplate` のテストが含まれる
- `templatePlaceholders.test.ts` の parse / findNext 系が pass

### 型チェック

```bash
npm run build
```

**期待結果:**

- TypeScript エラーなし
- i18n キー（`promptPalette.history.*` など）の参照箇所がないため、未使用警告が出る可能性はあるが、キー追加自体は型エラーにならない

### Lint

```bash
npm run lint
```

**期待結果:**

- エラーなし

### Rustテスト・型チェック

```bash
cd src-tauri && cargo check
cd src-tauri && cargo test
```

**期待結果:**

- Phase 1 で Rust は変更していないため、既存のまま全件 pass

---

## エッジケース

| ケース | 期待動作 | 確認結果 |
|--------|---------|---------|
| localStorage が満杯で書き込み失敗 | `persist` がコンソールエラーを出すが、メモリ上の状態は継続。アプリはクラッシュしない | [ ] OK / NG |
| localStorage に不正 JSON が入っている状態で起動 | `persist` の rehydrate 失敗を検知し、初期値（空配列）で起動する | [ ] OK / NG |
| 空文字列を `pushHistory('')` | 何も追加されない（`trimmed.length === 0` で no-op） | [ ] OK / NG |
| 末尾改行のみの文字列を `pushHistory('\n')` | 何も追加されない（trim 後に空になるため） | [ ] OK / NG |
| 101 件目の `pushHistory` | 最古が削除される（100 件維持） | [ ] OK / NG |
| `{{a{{b}}c}}` のパース | 外側の `{{a{{b}}` は不正記法として無視、内側 `{{b}}` のみ検出（正規表現 `[^{}]*` の結果） | [ ] OK / NG |
| `findNextPlaceholder(body, body.length)` | null を返す | [ ] OK / NG |

---

## 回帰テスト

既存機能への影響がないことを確認します。

- [ ] ファイルツリーが正常に表示される
- [ ] ターミナルが正常に起動・動作する
- [ ] コンテンツビューアでファイルが正常に表示される
- [ ] プロンプトパレット起動 `⌘⇧P` が動作する
- [ ] プロンプトパレットからの送信 `⌘Enter` が動作する
- [ ] プロンプトパレットの Esc クローズが動作する
- [ ] パス挿入（`Ctrl+Click` / 右クリック / `⌘P`）が textarea に反映される
- [ ] ターミナル本体の右クリックメニュー（F4-1）が動作する
- [ ] 挿入フラッシュ（F4-2）が動作する
- [ ] IME 変換中の `⌘Enter` 誤発火がない（日本語入力で確認）
- [ ] `prefers-reduced-motion` 有効時のフラッシュ抑制が機能する
