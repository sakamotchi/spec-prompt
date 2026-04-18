# タスクリスト - prompt-palette-f1

WBS（`docs/local/20260415-プロンプト編集パレット/03_WBS.md`）フェーズ F1（F1-1 〜 F1-7）に対応。各タスク完了後は **必ずユーザー確認を得てから** コミット・マージする（CLAUDE.md 規約）。

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 9 |
| 進行中 | 0 |
| 未着手 | 0 |

## タスク一覧

### T-1: 要件定義・設計

- [x] 要件定義書の作成（`requirements.md`）
- [x] 設計書の作成（`design.md`）
- [x] テスト手順書の作成（`testing.md`）
- [x] ユーザーレビュー

### T-2: `promptPaletteStore` 新設（WBS F1-1）

- [x] `src/stores/promptPaletteStore.ts` 新設（`isOpen`, `targetPtyId`, `targetTabName`, `drafts`, `open/close/setDraft/getDraft/clearDraft`）
- [x] `src/stores/promptPaletteStore.test.ts` 新設（open / close / setDraft / getDraft / clearDraft の基本動作）
- [x] `npx vitest run src/stores/promptPaletteStore.test.ts` がパス（6 件）

### T-3: `PromptPalette` UI 骨格（WBS F1-2）

- [x] `src/components/PromptPalette/PromptPalette.tsx` 新設（Radix Dialog、textarea 8 行、ヘッダ、フッタ）
- [x] `src/i18n/locales/ja.json` に `promptPalette.*` 追加
- [x] `src/i18n/locales/en.json` に `promptPalette.*` 追加
- [x] モーダルオープン時に textarea に自動フォーカス（`onOpenAutoFocus`）
- [x] ストアの `drafts[targetPtyId]` と textarea value を双方向バインディング

### T-4: 送信ロジック（WBS F1-3）

- [x] `Cmd+Enter`（macOS）/ `Ctrl+Enter`（Win/Linux）で `writePty(targetPtyId, body + "\n")` を 1 回呼ぶ
- [x] 「送信」ボタンで同じ `handleSubmit` を呼ぶ
- [x] `body.trim().length === 0` のとき、送信ボタン disable・ショートカットを no-op
- [x] 送信成功時に `clearDraft(targetPtyId)` → `close()`

### T-5: `Cmd+Shift+P` グローバルショートカット（WBS F1-4）

- [x] `AppLayout.tsx` に keydown リスナを追加
- [x] 判定: `(e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'p' || e.key === 'P')`
- [x] アクティブ `ptyId` を `terminalStore` から解決（`focusedPane` 優先、primary/secondary フォールバック）
- [x] 解決できないときは no-op
- [x] パレット表示中の重複起動を防止（`isOpen` チェック）
- [x] `<PromptPalette />` を AppLayout にマウント
- [x] 既存 `Ctrl+P`（パス検索）と衝突しないよう `!shift` ガードを追加

### T-6: `TabContextMenu` 拡張（WBS F1-5）

- [x] `src/components/TerminalPanel/TabContextMenu.tsx` の先頭に「プロンプトを編集...」項目を追加
- [x] キーヒント表示（`⌘⇧P` / `Ctrl+⇧+P`）
- [x] クリック時に `usePromptPaletteStore.getState().open(ptyId, tabName)` を呼ぶ
- [x] `src/lib/shortcuts.ts` にも `promptPalette` エントリを追加しショートカット一覧に表示

### T-7: コンポーネントテスト（WBS F1-6）

- [x] `src/components/PromptPalette/PromptPalette.test.tsx` 新設
- [x] ドラフト初期値ロード
- [x] Enter で改行（送信しない）
- [x] `Cmd+Enter` / `Ctrl+Enter` で `writePty` が呼ばれる
- [x] IME 変換中（`isComposing=true`）の Cmd+Enter は送信しない
- [x] 空本文で送信ボタン disable
- [x] Esc / キャンセルボタンでパレットが閉じ、ドラフト保持
- [x] `npx vitest run src/components/PromptPalette` がパス（9 件）

### T-8: 結合・動作確認（WBS F1-7）

- [x] `npm run lint` 差分ファイルでエラーなし（既存 `settingsStore.ts` の pre-existing エラーは対象外）
- [x] `npm run build`（型チェック含む）がエラーなし
- [x] `npx vitest run` が全件パス（150/150）
- [x] `cd src-tauri && cargo check` がパス
- [x] `npx tauri dev` で `testing.md` の手動 E2E を実施（受け入れ基準 1〜5 OK、14 は F3 へ繰越合意）

### T-9: ドキュメント・マージ

- [x] `testing.md` の確認結果を記録（ケース 1〜7, 9, 10 OK、ケース 8 は NG→F3 繰越）
- [x] `03_WBS.md` に F1 積み残し（受け入れ基準 14）と F3-3 繰越を追記
- [x] ユーザー承認
- [ ] `feature/prompt-edit-palette` 上でコミット
- [ ] 必要なら PR 作成、`main` へマージ

## 完了条件

- [x] 全タスクが完了（コミット前）
- [x] `npm run lint` 差分ファイルでエラーなし
- [x] `npm run build`（型チェック含む）がエラーなし
- [x] `npx vitest run` が全件パス
- [x] `cd src-tauri && cargo check` がパス
- [x] `testing.md` の手動テストが全件 OK（受け入れ基準 14 は F3 繰越）
- [x] ユーザー承認済み

## F1 からの積み残し

| 項目 | 繰越先 | 理由 |
|---|---|---|
| 受け入れ基準 14（パレット表示中に `Ctrl+Tab`・`F2` 等のグローバルショートカットが発火しない） | **F3-3** | `AppLayout.tsx` のキャプチャフェーズ keydown が textarea の `stopPropagation` より先に発火するため、F1 の textarea 側抑止では解決できない。F3-3 で `AppLayout` 側に `isOpen` 早期 return を集約して対応する。 |

## PR 粒度（参考、WBS より）

- PR-F1a: `promptPaletteStore` + `PromptPalette` UI（T-2, T-3）
- PR-F1b: 送信・ショートカット・タブメニュー起動（T-4, T-5, T-6）
- PR-F1c: テスト + 手動 E2E フィードバック反映（T-7, T-8, T-9）

> 実装規模と差分量を見て、単一 PR に畳む判断をしても可。いずれにせよコミット前のユーザー確認は必須。
