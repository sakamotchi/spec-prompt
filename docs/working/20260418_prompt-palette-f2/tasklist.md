# タスクリスト - prompt-palette-f2

WBS（`docs/local/20260415-プロンプト編集パレット/03_WBS.md`）フェーズ F2（F2-1 〜 F2-5）に対応。各タスク完了後は **必ずユーザー確認を得てから** コミット・マージする（CLAUDE.md 規約）。

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 8 |
| 進行中 | 0 |
| 未着手 | 0 |

## タスク一覧

### T-1: 要件定義・設計

- [x] 要件定義書の作成（`requirements.md`）
- [x] 設計書の作成（`design.md`）
- [x] テスト手順書の作成（`testing.md`）
- [x] ユーザーレビュー

### T-2: `promptPaletteStore` 拡張（WBS F2-1）

- [x] `src/stores/promptPaletteStore.ts` に `textareaRef` / `registerTextarea` / `insertAtCaret` を追加
- [x] `PromptPaletteState` 型を更新（F1 テストの型整合も維持）
- [x] `insertAtCaret` で選択範囲置換・キャレット移動・drafts 同期・再レンダ後のフォーカス復元（`requestAnimationFrame`）
- [x] `targetPtyId` null / ref null 時の no-op ガード

### T-3: `PromptPalette` の ref 登録（WBS F2-1 の UI 側）

- [x] `src/components/PromptPalette/PromptPalette.tsx` マウント時に `registerTextarea(textareaRef)` を呼ぶ
- [x] アンマウント時に `registerTextarea(null)` で解除
- [x] `modal={false}` + `Overlay.pointer-events: none` に変更し、ツリー／メニューへのクリックを透過させる
- [x] `onPointerDownOutside` / `onFocusOutside` でツリー・メニュー・Popper 経由の外側操作ではパレットを閉じないように preventDefault

### T-4: `usePathInsertion` ディスパッチ分岐（WBS F2-2）

- [x] `src/hooks/usePathInsertion.ts` の `insertPath` 先頭にパレット分岐を追加
- [x] パレット開時は `insertAtCaret(formatted)` を呼び、`terminal:focus` は発火させない
- [x] パレット閉時は既存どおり `writePty` + `terminal:focus`

### T-5: `PathPalette` の確定フォーカス戻し（WBS F2-3）

- [x] `src/components/PathPalette/PathPalette.tsx` の `Dialog.Content.onCloseAutoFocus` で、プロンプトパレット表示中なら textarea にフォーカスを戻す
- [x] 非表示時は従来どおり `terminal:focus` を維持

### T-6: ユニットテスト追加（WBS F2-4）

- [x] `src/stores/promptPaletteStore.test.ts` に `registerTextarea` / `insertAtCaret` のテストを追加（キャレット位置・選択範囲置換・drafts 同期・null ガード計 5 件）
- [x] `src/hooks/usePathInsertion.test.ts` を新設し、パレット開/閉のディスパッチ分岐と複数パス・pathFormat・ptyId 無しを検証（5 件）
- [x] `npx vitest run` が全件パス（160/160）

### T-7: 結合・動作確認（WBS F2-5）

- [x] `npm run lint` で差分ファイルのエラーなし
- [x] `npm run build`（型チェック含む）がエラーなし
- [x] `npx vitest run` が全件パス
- [x] `cd src-tauri && cargo check` がパス
- [x] `npx tauri dev` で `testing.md` の手動 E2E を全件実施（受け入れ基準 6〜8, 12）

### T-8: ドキュメント・コミット

- [x] `testing.md` の確認結果を記録（全ケース OK）
- [x] ユーザー承認
- [ ] `feature/prompt-edit-palette` 上でコミット
- [ ] 必要なら PR 作成、`main` へマージ

## 完了条件

- [x] 全タスクが完了（コミット前）
- [x] `npm run lint` 差分ファイルでエラーなし
- [x] `npm run build`（型チェック含む）がエラーなし
- [x] `npx vitest run` が全件パス
- [x] `cd src-tauri && cargo check` がパス
- [x] `testing.md` の手動テストが全件 OK（受け入れ基準 6, 7, 8, 12）
- [x] ユーザー承認済み

## 実装中の気付き（F1 との差分）

- 当初想定していた `onInteractOutside` による外側クリック抑止だけでは不十分だった。Radix Dialog の **modal=true** はオーバーレイが pointer events を全面的に吸収するため、ツリーへの `Cmd+Click` 自体が届かない。**`modal={false}` + `Overlay.pointer-events: none`** に切り替えることで、VS Code のコマンドパレット的な非モーダル UX に再設計した。
- この副作用で、パレット表示中もターミナル・コンテンツビューア等の操作が可能になるが、プロンプト執筆と並行して参照・確認できる利点の方が大きい。Esc / 送信 / キャンセルでの閉鎖は従来どおり動作。

## 前提

- F1 は 2026-04-18 にコミット済み（`d6076ed`）。`feature/prompt-edit-palette` ブランチ上で継続作業。
- F1 からの積み残し受け入れ基準 14 は F3 で対応するため F2 では扱わない。

## PR 粒度（参考、WBS より）

- PR-F2: パス挿入ディスパッチ（T-2 〜 T-7 一括）

> 差分量を見て複数 PR に分ける判断も可。コミット前のユーザー確認は必須。
