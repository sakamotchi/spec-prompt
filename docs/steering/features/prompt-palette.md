# プロンプト編集パレット機能仕様書

**バージョン**: 1.0
**作成日**: 2026年4月18日
**最終更新**: 2026年4月18日

---

## 1. 概要

プロンプト編集パレットは、Claude Code などの対話 CLI へ送るプロンプトを **誤送信なく推敲** できる軽量なモーダル編集 UI です。複数行のプロンプトを textarea で組み立て、明示的な送信操作（`Cmd+Enter` / `Ctrl+Enter` またはボタン）で初めてアクティブなターミナル PTY へ書き込みます。パレット表示中はファイルツリーの `Cmd+Click` / 右クリック挿入 / `Ctrl+P` パス検索パレットの確定がすべて **パレットの textarea にキャレット挿入** されるように挙動を切り替えます。

**機能ID**: FR-15

---

## 2. 機能要件

### 2.1 パレットの起動

| 要件ID | 要件 | 詳細 |
|--------|------|------|
| PE-01 | ショートカット起動 | `Cmd+Shift+P`（macOS）/ `Ctrl+Shift+P`（Win/Linux）でアクティブターミナル宛に開く |
| PE-02 | タブ右クリック起動 | ターミナルタブの右クリックメニュー先頭「プロンプトを編集...」 |
| PE-03 | ターミナル本体右クリック起動 | ターミナル描画領域の右クリックメニュー「プロンプトを編集...」（v1.1 追加） |
| PE-04 | アクティブタブなしは no-op | ターミナルタブが無い、または `ptyId` 未解決時は起動しない |
| PE-05 | 送信先の固定 | 起動時点のアクティブターミナル（`ptyId`）を固定。表示中にタブを切り替えても送信先は変えない |
| PE-06 | 重複起動防止 | パレット表示中に同ショートカットを再押下しても多重起動しない |

### 2.2 編集 UX

| 要件ID | 要件 | 詳細 |
|--------|------|------|
| PE-07 | textarea 8 行・縦リサイズ可 | 初期 8 行、CSS `resize: vertical` |
| PE-08 | Enter は改行 | 通常 Enter は送信せず改行のみ |
| PE-09 | Cmd/Ctrl+Enter で送信 | 本文 + `\n` をアクティブ PTY に 1 回で書き込み、パレットを閉じる |
| PE-10 | 送信ボタン | フッタの「送信」ボタンでも同じ送信処理 |
| PE-11 | 空本文は no-op | `body.trim().length === 0` なら送信ボタン disable、ショートカットは無視 |
| PE-12 | Esc / キャンセル | パレットを閉じる。下書き（テキスト）はメモリに保持 |
| PE-13 | 非モーダル | Radix Dialog を `modal={false}` + overlay `pointer-events: none` で表示。ツリーやターミナルへのクリックを遮らない |

### 2.3 パス挿入ディスパッチ

| 要件ID | 要件 | 詳細 |
|--------|------|------|
| PE-14 | パレット閉時は従来どおり PTY 直書き | `Cmd+Click` / 右クリック挿入 / `Ctrl+P` 確定は `writePty` 経由（既存挙動維持） |
| PE-15 | パレット開時は textarea に挿入 | 上記 3 経路とも `promptPaletteStore.insertAtCaret` で textarea のキャレット位置に挿入 |
| PE-16 | 選択範囲は置換 | textarea に選択範囲があれば置換。なければキャレット位置に挿入 |
| PE-17 | `Ctrl+P` 確定後のフォーカス | パレット開時は `Ctrl+P` だけ閉じ textarea にフォーカスを戻す |
| PE-18 | フォーカスを textarea に維持 | 挿入後 `terminal:focus` は発火させない |

### 2.4 下書き管理

| 要件ID | 要件 | 詳細 |
|--------|------|------|
| PE-19 | タブごとに下書き保持 | `drafts: Record<ptyId, string>` で保持（メモリのみ、永続化しない） |
| PE-20 | 開き直しで復元 | 同一タブで再度開くと直前の下書きを初期値にロード |
| PE-21 | 送信成功でクリア | `writePty` 成功時に `clearDraft(ptyId)` を呼ぶ |
| PE-22 | タブ閉鎖で破棄 | `terminalStore.closeTab` / `handlePtyExited` / `closeActiveTab` 時に `clearDraft`。パレットの送信先なら `close()` |

### 2.5 入力・エラー

| 要件ID | 要件 | 詳細 |
|--------|------|------|
| PE-23 | IME 二重ガード | `compositionstart/end` の state と `e.nativeEvent.isComposing` の OR で判定。変換中の Enter / Cmd+Enter は送信しない |
| PE-24 | グローバルショートカット抑止 | 表示中は allow list（`Ctrl+P` / `Cmd+Shift+P` / `Ctrl+Shift+P`）以外のグローバルショートカット（`Ctrl+Tab` / `F2` / `Cmd+T/W/0/1-9/\` 等）を `AppLayout` で早期 return |
| PE-25 | 送信失敗時トースト | `writePty` reject 時は `toast.error` を出し、パレットと本文を維持して再送信を可能にする |

### 2.6 視覚フィードバック

| 要件ID | 要件 | 詳細 |
|--------|------|------|
| PE-26 | ヘッダに送信先表示 | 「プロンプトを編集 → {タブ名} に送信」を表示 |
| PE-27 | キーヒント | フッタに `Enter: 改行 · ⌘Enter: 送信 · Esc: 閉じる`（プラットフォーム分岐） |
| PE-28 | 挿入フラッシュ | パス挿入直後に textarea 枠を 300ms フラッシュ（`--color-accent` の box-shadow）。`prefers-reduced-motion: reduce` ではスキップ |

---

## 3. 技術仕様

### 3.1 フロントエンド

**コンポーネント**:
- `src/components/PromptPalette/PromptPalette.tsx` — Radix Dialog（`modal={false}`）ベースのパレット本体
- `src/components/TerminalPanel/TerminalBodyContextMenu.tsx` — ターミナル本体の右クリック起動（v1.1）
- `src/components/TerminalPanel/TabContextMenu.tsx` — タブ右クリック起動項目（先頭）
- `src/components/Layout/AppLayout.tsx` — `Cmd+Shift+P` グローバルリスナと `isOpen` 早期 return（allow list）

**ストア**: `src/stores/promptPaletteStore.ts`

```typescript
interface PromptPaletteState {
  isOpen: boolean
  targetPtyId: string | null
  targetTabName: string | null
  drafts: Record<string, string>
  textareaRef: RefObject<HTMLTextAreaElement | null> | null
  lastInsertAt: number  // 挿入シグナル（UI フラッシュ購読用、単調増加）

  open(ptyId: string, tabName: string): void
  close(): void
  setDraft(ptyId: string, value: string): void
  getDraft(ptyId: string): string
  clearDraft(ptyId: string): void
  registerTextarea(ref): void
  insertAtCaret(text: string): void  // 選択範囲置換 + drafts 同期 + rAF でキャレット復元
}
```

**ディスパッチ**: `src/hooks/usePathInsertion.ts`

```typescript
// 呼び出し側（TreeNode / ContextMenu / PathPalette）は無改修。
// hook 内部で分岐する。
const insertPath = (paths) => {
  const formatted = formatPaths(paths, pathFormat, projectRoot)
  const palette = usePromptPaletteStore.getState()
  if (palette.isOpen && palette.targetPtyId) {
    palette.insertAtCaret(formatted)    // パレット開時
    return
  }
  if (ptyId) {
    tauriApi.writePty(ptyId, formatted) // パレット閉時（従来）
    window.dispatchEvent(new CustomEvent('terminal:focus'))
  }
}
```

### 3.2 バックエンド

新規 Rust コマンドは追加せず、既存 `write_pty`（`src-tauri/src/commands/pty.rs`）を流用する。

### 3.3 状態の連携

- `terminalStore.closeTab` / `handlePtyExited` / `closeActiveTab` から `promptPaletteStore.clearDraft(ptyId)` を呼ぶ（依存方向は `terminalStore` → `promptPaletteStore`、`getState()` による一方向参照）。
- パレットの `targetPtyId` と閉じられた `ptyId` が一致する場合は `promptPaletteStore.close()` を呼ぶ。

---

## 4. UX考慮事項

- パレットは **非モーダル** なので、ツリー・ターミナル・コンテンツビューアを同時に操作できる（VS Code のコマンドパレット的な UX）。
- ツリーから Cmd+Click した場合、クリック自体で Radix Dialog が close するのを避けるため `onPointerDownOutside` / `onFocusOutside` をツリー系セレクタ（`[data-panel="tree"]` / `[role="menu"]` / `[data-radix-*-content]` / `[data-radix-popper-content-wrapper]`）で preventDefault する。
- 送信成功時は `terminal:focus` イベントを発火させてターミナルにフォーカスを戻す。失敗時はパレットと textarea のフォーカスを維持。
- IME の発火順序差異に対応するため、state と `e.nativeEvent.isComposing` の二重ガードで判定。
- ターミナル本体の右クリックメニューは PTY 未生成時は disabled。

---

## 5. 制約

- `usePathInsertion` は primary ペインのアクティブタブのみを PTY 先として解決する（secondary ペイン未対応。既知制約）。
- 下書きは **メモリのみ** 保持し、アプリ再起動では消える（v1 スコープ）。
- textarea 内の挿入範囲単位のハイライト（文字単位）は未実装。挿入フラッシュは textarea 全体の枠フラッシュに留まる（v1.2 以降候補）。

---

## 6. スコープ外

- プロンプト履歴、テンプレート、下書き永続化
- Markdown プレビュー、シンタックスハイライト
- 複数パレットの同時表示（タブ別の別パレット）
- 送信前の変数展開（`{{file}}` 等の独自マクロ）
- Claude Code 以外の CLI 専用プロトコル（スラッシュコマンド補完など）

---

## 変更履歴

| 日付 | バージョン | 変更内容 | 作成者 |
|------|----------|---------|--------|
| 2026-04-18 | 1.0 | 初版作成（F1 MVP + F2 パス挿入ディスパッチ + F3 体験仕上げ + F4 UX 向上を一括反映） | - |
