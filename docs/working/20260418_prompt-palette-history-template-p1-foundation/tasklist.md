# タスクリスト - prompt-palette-history-template-p1-foundation

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 6 |
| 進行中 | 0 |
| 未着手 | 0 |

## タスク一覧

### T1-1: promptPaletteStore のスキーマ拡張

- [x] 型 `PromptHistoryEntry` / `PromptTemplate` / `DropdownKind` / `PaletteEditorState` を定義・export
- [x] `PromptPaletteState` に追加フィールド（`history`, `templates`, `historyCursor`, `dropdown`, `editorState`）を宣言
- [x] 追加アクション（`pushHistory`, `setHistoryCursor`, `openDropdown`, `closeDropdown`, `upsertTemplate`, `removeTemplate`, `openEditor`, `closeEditor`）を実装
- [x] 初期値を空配列・null で設定
- [x] `pushHistory` の直前重複排除 + 100 件上限を実装
- [x] `upsertTemplate` の id 自動生成 + 同 id 上書きを実装
- [x] `npm run lint` 本変更分でエラーなし（※既存 `settingsStore.ts` のプリエグジストエラーのみ、本変更の影響外）

### T1-2: persist middleware の適用

- [x] `zustand/middleware` から `persist`, `createJSONStorage` を import
- [x] `create<PromptPaletteState>()(persist(..., { name, version, storage, partialize }))` に置き換え
- [x] `partialize` で `history` と `templates` のみ永続化対象に指定
- [x] storage 名を `spec-prompt:prompt-palette` に設定
- [x] `version: 1` を設定（`migrate` は未実装で可）
- [x] 既存の `promptPaletteStore` 利用箇所（`PromptPalette.tsx`, `usePathInsertion.ts`）に API 互換性の崩れがないことを確認

### T1-3: ストアテスト拡張

- [x] `promptPaletteStore.test.ts` 既存テストが全件グリーンを維持
- [x] `pushHistory` の連続重複排除テストを追加
- [x] `pushHistory` の 100 件上限テストを追加
- [x] `pushHistory` の末尾空白 trim テストを追加
- [x] `setHistoryCursor` の境界値テスト（null / 負値 / 範囲外）を追加
- [x] `upsertTemplate` の新規 / 上書きテストを追加
- [x] `removeTemplate` のテストを追加
- [x] `beforeEach` で `localStorage.removeItem` + ストア状態リセットを実装
- [x] `npm run test -- promptPaletteStore` が全件 pass（14 既存 + 24 新規 = 38 件）

### T1-4: プレースホルダユーティリティの新規実装

- [x] `src/lib/templatePlaceholders.ts` を新規作成
- [x] `Placeholder` 型を export
- [x] `parsePlaceholders(body: string): Placeholder[]` を実装（正規表現 `/\{\{([^{}]+)\}\}/g`、空 `{{}}` を自動除外）
- [x] 空 `{{}}` は無視するロジックを実装
- [x] `findNextPlaceholder(body: string, caret: number): Placeholder | null` を実装
- [x] エスケープ非対応である旨を TSDoc コメントで明記
- [x] `src/lib/templatePlaceholders.test.ts` を新規作成
- [x] parse の正常系・空 `{{}}` 無視・閉じなし無視・ネスト外側のみのテストを追加
- [x] findNext のキャレット以降検索・見つからず null のテストを追加
- [x] `npm run test -- templatePlaceholders` が全件 pass（11 件）

### T1-5: i18n キー雛形の追加

- [x] `src/i18n/locales/ja.json` に `promptPalette.history.*` を追加
- [x] `src/i18n/locales/ja.json` に `promptPalette.template.*`（`editor.*` 含む）を追加
- [x] `src/i18n/locales/ja.json` に `promptPalette.hint.*` の新規キー（`historyUp`, `historyDown`, `historyOpen`, `templateOpen`）を追加
- [x] `src/i18n/locales/en.json` に同じ構造で英訳（暫定値）を追加
- [x] `npm run build` の型チェック（TypeScript resources 解決）が通る
- [x] 既存の `promptPalette.*` キーに変更がないこと（削除・リネームしない）

### T1-F: 最終確認・コミット

- [x] `npm run lint` 本変更分でエラーなし
- [x] `npm run test` 全件 pass（218 / 218）
- [x] `npm run build` 型エラーなし
- [x] 本フェーズで Rust 変更なし（`cargo check` / `cargo test` は差分対象外）
- [x] testing.md の手動確認ケース（永続化・リグレッション）を実施・OK
- [x] ユーザーに確認を依頼してからコミット（CLAUDE.md 作業ルール）
- [x] コミットメッセージ案: `feat(prompt-palette): 履歴・テンプレート機能の基盤整備（Phase 1）`

## 完了条件

- [x] 全タスクが完了
- [x] `npm run lint` がエラーなし（本変更分）
- [x] `npm run test` が全件 pass
- [x] `npm run build` が型エラーなし
- [x] 手動テスト（永続化の再起動確認）が OK
- [x] 既存の `PromptPalette.tsx` UX にリグレッションなし（起動・送信・挿入フラッシュ）
- [x] プロジェクトドキュメント（`docs/projects/20260418-プロンプトパレット履歴テンプレート/03_WBS.md`）Phase 1 のチェックボックスを埋める
