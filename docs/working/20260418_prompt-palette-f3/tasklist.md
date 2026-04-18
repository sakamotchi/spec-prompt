# タスクリスト - prompt-palette-f3

WBS（`docs/local/20260415-プロンプト編集パレット/03_WBS.md`）フェーズ F3（F3-1 〜 F3-5）に対応。各タスク完了後は **必ずユーザー確認を得てから** コミット・マージする（CLAUDE.md 規約）。

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 7 |
| 進行中 | 0 |
| 未着手 | 0 |

## タスク一覧

### T-1: 要件定義・設計

- [x] 要件定義書の作成（`requirements.md`）
- [x] 設計書の作成（`design.md`）
- [x] テスト手順書の作成（`testing.md`）
- [x] ユーザーレビュー

### T-2: タブ閉鎖時の下書き破棄（WBS F3-1）

- [x] `src/stores/terminalStore.ts` の `closeTab` / `handlePtyExited` / `closeActiveTab` に `promptPaletteStore.clearDraft` フックを追加
- [x] 閉じられた `ptyId` が `targetPtyId` と一致する場合は `promptPaletteStore.close()` を呼ぶ
- [x] 依存方向は `terminalStore` → `promptPaletteStore`（`getState()` 一方向参照）
- [x] `src/stores/terminalStore.test.ts` に連携テストを追加（下書き破棄・他タブ下書きの保持・パレット自動クローズ・最後の 1 枚保護、計 6 件）

### T-3: IME 抑止の仕上げ（WBS F3-2）

- [x] `src/components/PromptPalette/PromptPalette.tsx` に `isComposing` ローカル state を追加
- [x] textarea の `onCompositionStart` / `onCompositionEnd` で state 更新
- [x] `handleKeyDown` の送信条件を `!(isComposing || e.nativeEvent.isComposing)` に強化
- [x] `src/components/PromptPalette/PromptPalette.test.tsx` に IME ガードのテストを追加（compositionstart 中 / compositionend 後 の 2 件）

### T-4: グローバルショートカット競合の整理（WBS F3-3、**F1 繰越**）

- [x] `src/components/Layout/AppLayout.tsx` の keydown 冒頭に `isOpen` の早期 return + allow list を配置
- [x] allow list: `Ctrl+P` / `Cmd+Shift+P` / `Ctrl+Shift+P`
- [x] `Ctrl+Tab` / `F2` / `Cmd+T` / `Cmd+W` / `Cmd+0` / `Cmd+1-9` / `Cmd+\` / `Cmd+Shift+\` / `?` / `Ctrl+Shift+Tab` がパレット表示中に発火しないことを手動 E2E で確認
- [x] F1 で NG だった受け入れ基準 14 が F3 で解消

### T-5: 送信失敗時のトースト（WBS F3-4）

- [x] `src/components/PromptPalette/PromptPalette.tsx` の `handleSubmit` で `writePty` を try/catch
- [x] 失敗時 `toast.error(t('promptPalette.error.sendFailed', { message }))` を呼ぶ
- [x] 失敗時は `clearDraft` / `close` / `terminal:focus` を呼ばない（パレット・本文維持）
- [x] `src/i18n/locales/ja.json` / `en.json` に `promptPalette.error.sendFailed` を追加
- [x] `PromptPalette.test.tsx` に失敗時 toast 発火 + パレット維持のテストを追加

### T-6: 結合・動作確認（WBS F3-5）

- [x] `npm run lint` で差分ファイルのエラーなし
- [x] `npm run build`（型チェック含む）がエラーなし
- [x] `npx vitest run` が全件パス（169/169）
- [x] `cd src-tauri && cargo check` がパス
- [x] `npx tauri dev` で `testing.md` の手動 E2E を実施（受け入れ基準 9, 10, 11, 13, 14）
- [x] 受け入れ基準 15（送信失敗時トースト）の手動 E2E は **スキップ**。コンポーネントテスト（`PromptPalette.test.tsx` の `writePty reject` ケース）で代替担保する合意（2026-04-18）。

### T-7: ドキュメント・コミット

- [x] `testing.md` の確認結果を記録（ケース 9 はスキップ、他すべて OK）
- [x] F1 の `testing.md` ケース 8 が F3-3 で解消されたことを記録
- [x] ユーザー承認
- [ ] `feature/prompt-edit-palette` 上でコミット
- [ ] 必要なら PR 作成、`main` へマージ

## 完了条件

- [x] 全タスクが完了（コミット前）
- [x] `npm run lint` 差分ファイルでエラーなし
- [x] `npm run build`（型チェック含む）がエラーなし
- [x] `npx vitest run` が全件パス（169/169）
- [x] `cd src-tauri && cargo check` がパス
- [x] `testing.md` の手動テストが全件 OK（受け入れ基準 9, 10, 11, 13, 14。15 は自動テストで代替担保）
- [x] ユーザー承認済み

## v1 受け入れ基準達成状況（F1 + F2 + F3）

| # | 受け入れ基準（元要件 §7） | 担保フェーズ | 確認方法 |
|---|---|---|---|
| 1 | タブ右クリック「プロンプトを編集...」でパレット起動 | F1 | 手動 |
| 2 | `Cmd+Shift+P` でパレット起動 | F1 | 手動 |
| 3 | Enter は改行 | F1 | 手動 + 自動 |
| 4 | Cmd+Enter で送信 | F1 | 手動 + 自動 |
| 5 | 空本文は no-op | F1 | 手動 + 自動 |
| 6 | パレット表示中の `Cmd+Click` で textarea に挿入 | F2 | 手動 |
| 7 | 右クリック「パスをターミナルに挿入」で textarea に挿入 | F2 | 手動 |
| 8 | `Ctrl+P` → 確定で textarea に挿入 + フォーカス戻し | F2 | 手動 |
| 9 | 下書き復元（同一タブ） | F3 | 手動 |
| 10 | 送信成功で下書きクリア | F3 | 手動 |
| 11 | タブ閉鎖で下書き破棄 | F3 | 手動 + 自動（terminalStore.test.ts） |
| 12 | パレット閉時は既存どおり PTY 直書き | F2 | 手動 |
| 13 | IME 変換中の Enter 抑止 | F3 | 手動 + 自動 |
| 14 | パレット表示中のグローバルショートカット抑止 | F3（F1 繰越解消） | 手動 |
| 15 | 送信失敗時トースト + パレット維持 | F3 | 自動テストで代替担保 |

## 前提

- F1 コミット済み: `d6076ed`
- F2 コミット済み: `2773a53`
- `feature/prompt-edit-palette` ブランチ上で継続作業
- F1 からの受け入れ基準 14 繰越は T-4 で解消済み

## PR 粒度（参考、WBS より）

- PR-F3: 体験仕上げ（T-2 〜 T-6 一括）

> 差分量を見て分割判断も可。コミット前のユーザー確認は必須。
