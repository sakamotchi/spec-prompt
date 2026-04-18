# 要件定義書 - prompt-palette-f2

## 概要

プロンプト編集パレットのフェーズ F2 として、既存のパス挿入 3 経路（ツリー `Cmd+Click`、ツリー右クリックメニュー、`Ctrl+P` パス検索パレット）を **パレット表示中のみ textarea へ差し込む** ようにディスパッチ分岐を追加する。パレットが閉じているときの挙動は従来どおり（PTY 直書き込み）を維持する。

- 元仕様: `docs/local/20260415-プロンプト編集パレット/01_要件定義書.md`, `02_概要設計書.md`, `03_WBS.md`
- WBS 対応: フェーズ F2（F2-1 〜 F2-5）
- 対応する受け入れ基準（元要件 §7）: **6, 7, 8, 12**
- 前提: F1（`promptPaletteStore` / `PromptPalette.tsx` / `Cmd+Shift+P` 起動 / 送信）はコミット済み（`d6076ed`）

## 背景・目的

- F1 時点では、パレット表示中に `Cmd+Click` やツリー右クリックで挿入するとパレットの外のクリックとして処理され、パレットが閉じたうえで PTY へ書き込まれる。プロンプト執筆中にファイルパスを差し込む自然な流れにならない。
- `Ctrl+P` パス検索パレットは、パレット表示中に使ってもそのまま PTY に書き込まれるため、プロンプト文中への参照挿入ができない。
- F2 でディスパッチ分岐を導入することにより、元要件の「執筆中に参照を挿入する」ユースケースが完成する（受け入れ基準 6〜8, 12）。

## 要件一覧

### 機能要件

#### F2-1: `promptPaletteStore` に textarea ref 登録 API を追加（WBS F2-1）

- **説明**: パレットの textarea を ref として store に登録し、キャレット位置を起点に文字列を挿入する API を公開する。`drafts` の更新もあわせて行う。
- **受け入れ条件**:
  - [ ] `textareaRef: React.RefObject<HTMLTextAreaElement> | null` を store に追加
  - [ ] `registerTextarea(ref): void` / `registerTextarea(null)` で登録・解除できる
  - [ ] `insertAtCaret(text: string): void` が次を実行する:
    - [ ] `selectionStart` / `selectionEnd` の範囲を `text` で置換（選択範囲がなければキャレット位置に挿入）
    - [ ] キャレットを挿入文字列の末尾へ移動
    - [ ] `drafts[targetPtyId]` を挿入後の値に同期
    - [ ] textarea にフォーカスを戻す
  - [ ] `targetPtyId` が null、または textarea ref が null の場合は no-op
  - [ ] `PromptPalette.tsx` 側でマウント時に `registerTextarea`、アンマウント時に `registerTextarea(null)` を呼ぶ
  - [ ] ユニットテスト（jsdom）で `insertAtCaret` の挿入・キャレット移動・drafts 同期を検証

#### F2-2: `usePathInsertion` のディスパッチ分岐（WBS F2-2）

- **説明**: `insertPath` の先頭に「パレット開時は textarea へ、閉時は PTY へ」の分岐を追加する。呼び出し側（`TreeNode` / `ContextMenu` / `PathPalette`）は **改修しない**。
- **受け入れ条件**:
  - [ ] `usePromptPaletteStore.getState()` を参照し、`isOpen && targetPtyId` の場合は `insertAtCaret(formatted)` を呼ぶ
  - [ ] 上記以外（パレット閉）は従来どおり `writePty(ptyId, text)` を呼ぶ
  - [ ] 複数パス挿入時の区切り（スペース区切り + 末尾スペース）は既存と同じ整形ルール
  - [ ] `pathFormat`（relative / absolute）は既存どおり尊重される
  - [ ] パレット分岐で挿入した場合、`terminal:focus` イベントは発火させない（フォーカスは textarea にある）

#### F2-3: `PathPalette` の確定ハンドラ調整（WBS F2-3）

- **説明**: `Ctrl+P` で開いたパス検索パレットから確定したとき、プロンプトパレット表示中なら `Ctrl+P` のみ閉じてプロンプトパレットにフォーカスを戻す。
- **受け入れ条件**:
  - [ ] `PathPalette.handleSelect`（もしくは同等関数）で `insertPath()` を呼んだ後、プロンプトパレット表示中なら `onCloseAutoFocus` の `terminal:focus` ディスパッチを抑制
  - [ ] 確定後、プロンプトパレット表示中なら `promptPaletteStore.textareaRef.current?.focus()` でフォーカスを戻す
  - [ ] プロンプトパレット非表示時は既存挙動（`terminal:focus`）を維持

#### F2-4: ユニットテスト追加（WBS F2-4）

- **説明**: `usePathInsertion` のディスパッチ分岐と `promptPaletteStore.insertAtCaret` をテストで担保する。
- **受け入れ条件**:
  - [ ] `src/hooks/usePathInsertion.test.ts` を新設または拡張し、次を検証:
    - [ ] パレット閉時に `writePty` が呼ばれ `insertAtCaret` が呼ばれない
    - [ ] パレット開時に `insertAtCaret` が呼ばれ `writePty` が呼ばれない
    - [ ] パレット開かつ `targetPtyId=null` の場合は PTY へフォールバックしない（no-op または PTY 直書き）※F2 の設計決定で明文化する
  - [ ] `promptPaletteStore.test.ts` を拡張し、`registerTextarea` / `insertAtCaret` の基本動作を jsdom 環境で検証（キャレット位置、選択範囲置換、drafts 同期）

#### F2-5: 動作確認 → ユーザー確認 → コミット（WBS F2-5）

- **説明**: `testing.md` に沿って受け入れ基準 6〜8, 12 を手動で確認し、ユーザー承認を得てからコミットする。
- **受け入れ条件**:
  - [ ] 受け入れ基準 6（`Cmd+Click` で textarea に挿入）
  - [ ] 受け入れ基準 7（右クリック「パスをターミナルに挿入」で textarea に挿入）
  - [ ] 受け入れ基準 8（`Ctrl+P` → 確定 → プロンプトパレットへフォーカス戻し + 挿入）
  - [ ] 受け入れ基準 12（パレット閉時は既存挙動どおり PTY へ直書き）
  - [ ] `npm run lint` / `npm run build` / `npx vitest run` / `cd src-tauri && cargo check` が全てパス

### 非機能要件

- **パフォーマンス**: `insertAtCaret` は 10,000 文字の textarea に対しても目視で即時反応すること。
- **ユーザビリティ**: 挿入後は textarea にフォーカスが残り、続けてタイプ可能。キャレットは挿入文字列の末尾。
- **保守性**: 呼び出し側（`TreeNode` / `ContextMenu`）は既存のまま。ディスパッチ変更は `usePathInsertion` 内に閉じる。
- **互換性**: `useAppStore.pathFormat` / `useAppStore.selectedFiles` の既存依存は維持。

### F2 で扱わない項目（後続フェーズに持ち越し）

- **F3 に持ち越し**: タブ閉鎖時の下書き破棄、IME 抑止仕上げ、グローバルショートカット競合整理（受け入れ基準 14 含む）、送信失敗トースト。
- **F4 以降**: ターミナル本体右クリックからの起動、挿入プレビューのハイライト。
- **今回設計に含めない選択肢**: 挿入時の末尾スペースの扱いをユーザー設定で切替（既存挙動「末尾にスペース 1 つ」を踏襲）。

## スコープ

### 対象

- `promptPaletteStore` の拡張（`textareaRef`, `registerTextarea`, `insertAtCaret`）
- `PromptPalette.tsx` の ref 登録
- `usePathInsertion.ts` のディスパッチ分岐
- `PathPalette.tsx` の確定後フォーカス戻し
- ストア / フックのユニットテスト

### 対象外

- `TreeNode.tsx` / `ContextMenu.tsx`（呼び出し側）の改修
- 新規 Rust コマンド（変更なし）
- secondary ペイン向けのアクティブ解決強化（別タスクで検討）

## 実装対象ファイル（予定）

**変更**
- `src/stores/promptPaletteStore.ts` — `textareaRef`, `registerTextarea`, `insertAtCaret` 追加
- `src/stores/promptPaletteStore.test.ts` — `insertAtCaret` 等のテスト追加
- `src/components/PromptPalette/PromptPalette.tsx` — マウント時に `registerTextarea` 呼び出し
- `src/hooks/usePathInsertion.ts` — ディスパッチ分岐
- `src/components/PathPalette/PathPalette.tsx` — プロンプトパレット表示時の確定フォーカス戻し

**新設**
- `src/hooks/usePathInsertion.test.ts` — ディスパッチ分岐テスト

## 依存関係

- F1 で導入した `promptPaletteStore` / `PromptPalette` を拡張
- Rust 側は変更なし（`write_pty` の利用状況も変わらない）

## 既知の制約

- `usePathInsertion` は現状 primary pane のアクティブタブのみを PTY 先として解決している。F2 では **この既存仕様を変更しない**（secondary 対応は別途）。
- パレット開時に `targetPtyId` がアクティブ PTY と異なる場合、ユーザーの意図と逆になる可能性がある。F2 の仕様では「パレット表示中はパレットに挿入」を優先する（元要件どおり）。

## 参考資料

- `docs/local/20260415-プロンプト編集パレット/02_概要設計書.md` §2.2, §3.5
- `docs/working/20260418_prompt-palette-f1/design.md` — F1 の前提設計
- `src/hooks/usePathInsertion.ts:10-35` — 現行 `insertPath`
- `src/components/PathPalette/PathPalette.tsx:90-96, 134-137` — `handleSelect` と `onCloseAutoFocus`
- `src/components/TreePanel/TreeNode.tsx:116`, `src/components/TreePanel/ContextMenu.tsx:170-172` — 呼び出し側（改修しない）
