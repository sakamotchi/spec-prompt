# タスクリスト - prompt-palette-history-template-p1-foundation

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 0 |
| 進行中 | 0 |
| 未着手 | 5 |

## タスク一覧

### T1-1: promptPaletteStore のスキーマ拡張

- [ ] 型 `PromptHistoryEntry` / `PromptTemplate` / `DropdownKind` / `PaletteEditorState` を定義・export
- [ ] `PromptPaletteState` に追加フィールド（`history`, `templates`, `historyCursor`, `dropdown`, `editorState`）を宣言
- [ ] 追加アクション（`pushHistory`, `setHistoryCursor`, `openDropdown`, `closeDropdown`, `upsertTemplate`, `removeTemplate`, `openEditor`, `closeEditor`）を実装
- [ ] 初期値を空配列・null で設定
- [ ] `pushHistory` の直前重複排除 + 100 件上限を実装
- [ ] `upsertTemplate` の id 自動生成 + 同 id 上書きを実装
- [ ] `cd /Users/sakamotoyoshitaka/Documents/Github/spec-prompt && npm run lint` エラーなし

### T1-2: persist middleware の適用

- [ ] `zustand/middleware` から `persist`, `createJSONStorage` を import
- [ ] `create<PromptPaletteState>()(persist(..., { name, version, storage, partialize }))` に置き換え
- [ ] `partialize` で `history` と `templates` のみ永続化対象に指定
- [ ] storage 名を `spec-prompt:prompt-palette` に設定
- [ ] `version: 1` を設定（`migrate` は未実装で可）
- [ ] 既存の `promptPaletteStore` 利用箇所（`PromptPalette.tsx`, `usePathInsertion.ts`）に API 互換性の崩れがないことを確認

### T1-3: ストアテスト拡張

- [ ] `promptPaletteStore.test.ts` 既存テストが全件グリーンを維持
- [ ] `pushHistory` の連続重複排除テストを追加
- [ ] `pushHistory` の 100 件上限テストを追加
- [ ] `pushHistory` の末尾空白 trim テストを追加
- [ ] `setHistoryCursor` の境界値テスト（null / 負値 / 範囲外）を追加
- [ ] `upsertTemplate` の新規 / 上書きテストを追加
- [ ] `removeTemplate` のテストを追加
- [ ] `beforeEach` で `localStorage.clear()` + ストア状態リセットを実装
- [ ] `cd /Users/sakamotoyoshitaka/Documents/Github/spec-prompt && npm run test -- promptPaletteStore` が全件 pass

### T1-4: プレースホルダユーティリティの新規実装

- [ ] `src/lib/templatePlaceholders.ts` を新規作成
- [ ] `Placeholder` 型を export
- [ ] `parsePlaceholders(body: string): Placeholder[]` を実装（正規表現 `/\{\{([^{}]*)\}\}/g`）
- [ ] 空 `{{}}` は無視するロジックを実装
- [ ] `findNextPlaceholder(body: string, caret: number): Placeholder | null` を実装
- [ ] エスケープ非対応である旨を TSDoc コメントで明記
- [ ] `src/lib/templatePlaceholders.test.ts` を新規作成
- [ ] parse の正常系・空 `{{}}` 無視・閉じなし無視・ネスト外側のみのテストを追加
- [ ] findNext のキャレット以降検索・見つからず null のテストを追加
- [ ] `npm run test -- templatePlaceholders` が全件 pass

### T1-5: i18n キー雛形の追加

- [ ] `src/i18n/locales/ja.json` に `promptPalette.history.*` を追加
- [ ] `src/i18n/locales/ja.json` に `promptPalette.template.*`（`editor.*` 含む）を追加
- [ ] `src/i18n/locales/ja.json` に `promptPalette.hint.*` の新規キー（`historyUp`, `historyDown`, `historyOpen`, `templateOpen`）を追加
- [ ] `src/i18n/locales/en.json` に同じ構造で英訳（暫定値）を追加
- [ ] `npm run build` の型チェック（TypeScript resources 解決）が通る
- [ ] 既存の `promptPalette.*` キーに変更がないこと（削除・リネームしない）

### T1-F: 最終確認・コミット

- [ ] `npm run lint` エラーなし
- [ ] `npm run test` 全件 pass
- [ ] `npm run build` 型エラーなし
- [ ] `cd src-tauri && cargo check` エラーなし（変更していないが念のため）
- [ ] `cd src-tauri && cargo test` 全件 pass
- [ ] testing.md の手動確認ケース（永続化）を実施
- [ ] ユーザーに確認を依頼してからコミット（CLAUDE.md 作業ルール）
- [ ] コミットメッセージ案: `feat(prompt-palette): 履歴・テンプレート機能の基盤整備（Phase 1）`

## 完了条件

- [ ] 全タスクが完了
- [ ] `npm run lint` がエラーなし
- [ ] `npm run test` が全件 pass
- [ ] `npm run build` が型エラーなし
- [ ] `cd src-tauri && cargo check` がエラーなし
- [ ] 手動テスト（永続化の再起動確認）が OK
- [ ] 既存の `PromptPalette.tsx` UX にリグレッションなし（起動・送信・挿入フラッシュ）
- [ ] プロジェクトドキュメント（`docs/projects/20260418-プロンプトパレット履歴テンプレート/03_WBS.md`）Phase 1 のチェックボックスを埋める
