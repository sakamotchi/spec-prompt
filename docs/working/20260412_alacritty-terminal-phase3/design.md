# 設計書 - alacritty-terminal Phase 3（スクロールバック・選択コピー・パス挿入）

## アーキテクチャ

### 対象コンポーネント

```
Rust
  ├── TerminalInstance::new()  ← scrollback history 有効化（Config 変更）
  ├── scroll_terminal コマンド ← 新規（term.scroll_display）
  └── terminal-cells イベント ← scrollOffset / totalScrollback を payload に追加

TerminalRenderer.tsx（既存）
  ├── wheel イベント     → scroll_terminal 呼び出し
  ├── mousedown/move/up → 選択範囲トラッキング
  ├── Cmd+C             → clipboard.writeText
  ├── Cmd+V             → writePty
  └── スクロールバー UI  ← 新規 div オーバーレイ

useTerminalInput.ts（既存）
  └── Cmd+V / Cmd+C を encodeKey で null にしている → TerminalRenderer 側で直接処理

usePathInsertion.ts（既存）
  └── writePty(ptyId, text) → Canvas モードでも動作（変更なし、動作確認のみ）
```

### 影響範囲

- **Rust**: `terminal/instance.rs`（Config 変更）、`commands/pty.rs`（`scroll_terminal` 追加）
- **フロントエンド**: `TerminalRenderer.tsx`（wheel/mouse/keyboard 追加）、`tauriApi.ts`（`scrollTerminal` 追加）、`TerminalPanel.tsx`（Feature Flag 削除）、`terminalStore.ts`（`appendScrollback` 削除）
- **package.json**: `@xterm/xterm`・`@xterm/addon-fit` 削除

---

## 3-A: スクロールバック設計

### Rust 側

#### Config に history を設定

```rust
// terminal/instance.rs
use alacritty_terminal::config::{Config, Scrolling};

pub fn new(cols: u16, lines: u16) -> Self {
    let config = Config {
        scrolling: Scrolling {
            history: 10_000,
            ..Default::default()
        },
        ..Default::default()
    };
    // ...
}
```

#### TermSize::total_lines

```rust
impl Dimensions for TermSize {
    fn columns(&self) -> usize { self.cols }
    fn screen_lines(&self) -> usize { self.lines }
    fn total_lines(&self) -> usize { self.lines + 10_000 }
}
```

#### scroll_terminal コマンド

```rust
// commands/pty.rs
#[tauri::command]
pub async fn scroll_terminal(
    id: String,
    delta: i32,  // 正: 上スクロール, 負: 下スクロール
    state: tauri::State<'_, PtyManager>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    use alacritty_terminal::grid::Scroll;
    let manager = state.0.lock().unwrap();
    if let Some(entry) = manager.get(&id) {
        let mut ti = entry.terminal_instance.lock().unwrap();
        ti.term.scroll_display(Scroll::Delta(delta));
        // damage フラグを立てて即時 cells 送信
        emit_cells(&app, &id, &mut ti);
    }
    Ok(())
}
```

#### terminal-cells payload にスクロール情報を追加

```rust
// terminal/mod.rs の TerminalCellsPayload に追加
pub struct TerminalCellsPayload {
    pub id: String,
    pub cells: Vec<CellData>,
    pub cursor: CursorPos,
    pub scroll_offset: u32,   // 現在のスクロール行数（0=末尾）
    pub scrollback_len: u32,  // 履歴の総行数
}
```

`scroll_offset` と `scrollback_len` は `term.grid().history_size()` と `term.grid().display_offset()` から取得する。

### フロントエンド側

#### tauriApi.ts

```ts
scrollTerminal(id: string, delta: number): Promise<void>
```

#### TerminalRenderer.tsx の追加 ref

```ts
const scrollOffsetRef = useRef(0)
const scrollbackLenRef = useRef(0)
```

payload 受信時に更新し、スクロールバー描画に使う。

#### wheel イベント

```ts
const onWheel = (e: WheelEvent) => {
  e.preventDefault()
  const delta = e.deltaY > 0 ? -3 : 3  // 上スクロール = 正
  tauriApi.scrollTerminal(ptyIdRef.current!, delta).catch(console.error)
}
```

#### scroll-to-bottom on input

`useTerminalInput` の `onKeydown` で `encodeKey` が null 以外を返したとき：

```ts
if (scrollOffsetRef.current > 0) {
  tauriApi.scrollTerminal(ptyIdRef.current!, -scrollOffsetRef.current).catch(console.error)
}
```

#### スクロールバー UI

Canvas コンテナの右端に絶対配置の div:

```tsx
const scrollRatio = scrollbackLenRef.current > 0
  ? scrollOffsetRef.current / scrollbackLenRef.current
  : 1
const barHeight = Math.max(20, containerHeight * (rows / (rows + scrollbackLen)))
const barTop = (containerHeight - barHeight) * (1 - scrollRatio)

<div style={{
  position: 'absolute', right: 0, top: barTop,
  width: 6, height: barHeight,
  background: 'rgba(255,255,255,0.3)', borderRadius: 3,
  opacity: scrollbackLen > 0 ? 1 : 0,
}} />
```

---

## 3-B: テキスト選択・コピー・ペースト設計

### 選択範囲の型

```ts
interface SelectionRange {
  start: { row: number; col: number }
  end:   { row: number; col: number }
}
```

`selectionRef = useRef<SelectionRange | null>(null)` で管理。

### 座標変換

```ts
function pixelToCell(x: number, y: number, cw: number, ch: number, dpr: number) {
  return {
    col: Math.floor((x * dpr) / cw),
    row: Math.floor((y * dpr) / ch),
  }
}
```

クリック座標は `e.offsetX` / `e.offsetY`（コンテナ相対）を使う。

### mousedown / mousemove / mouseup

```ts
const onMouseDown = (e: MouseEvent) => {
  const cell = pixelToCell(e.offsetX, e.offsetY, cw, ch, dpr)
  selectionRef.current = { start: cell, end: cell }
  isDraggingRef.current = true
}

const onMouseMove = (e: MouseEvent) => {
  if (!isDraggingRef.current) return
  const cell = pixelToCell(e.offsetX, e.offsetY, cw, ch, dpr)
  selectionRef.current = { ...selectionRef.current!, end: cell }
  drawCursor(cursorVisibleRef.current)  // カーソル Canvas を再描画
}

const onMouseUp = () => {
  isDraggingRef.current = false
}
```

### 選択ハイライト描画（drawCursor に追加）

```ts
const sel = selectionRef.current
if (sel) {
  ctx.fillStyle = 'rgba(124, 106, 247, 0.35)'  // accent color
  // 選択範囲の各行をハイライト
  const [from, to] = normalizeSelection(sel)
  for (let r = from.row; r <= to.row; r++) {
    const startCol = r === from.row ? from.col : 0
    const endCol   = r === to.row   ? to.col   : colsRef.current
    ctx.fillRect(startCol * cw, r * ch, (endCol - startCol) * cw, ch)
  }
}
```

### Cmd+C: テキスト抽出

```ts
function extractSelectedText(cells: CellData[], sel: SelectionRange, cols: number): string {
  const [from, to] = normalizeSelection(sel)
  const lines: string[] = []
  for (let r = from.row; r <= to.row; r++) {
    const startCol = r === from.row ? from.col : 0
    const endCol   = r === to.row   ? to.col   : cols
    const row = cells.filter(c => c.row === r && c.col >= startCol && c.col < endCol)
    row.sort((a, b) => a.col - b.col)
    lines.push(row.map(c => c.ch).join('').trimEnd())
  }
  return lines.join('\n')
}
```

`keydown` で `metaKey && key === 'c'` のとき上記を実行して `navigator.clipboard.writeText()` へ渡す。

### Cmd+V: ペースト

```ts
// useTerminalInput.ts の onKeydown に追記 または TerminalRenderer の keydown で処理
if (metaKey && key === 'v') {
  navigator.clipboard.readText().then(text => {
    if (text && ptyId) tauriApi.writePty(ptyId, text).catch(console.error)
  })
  e.preventDefault()
  return
}
```

ペースト処理は `TerminalRenderer.tsx` 内の `keydown` ハンドラで直接実装する（`useTerminalInput` の `encodeKey` は metaKey=null を返すため、別途処理が必要）。

---

## 3-C: パス挿入互換確認設計

### 現状の `usePathInsertion` の動作

```ts
const { primary } = useTerminalStore.getState()
const activeTab = primary.tabs.find(t => t.id === primary.activeTabId)
const ptyId = activeTab?.ptyId
if (ptyId) tauriApi.writePty(ptyId, text).catch(console.error)
```

`writePty` は Canvas モードでも xterm.js モードでも PTY に書き込む共通 API なので変更不要。

### 確認事項

Canvas モードで PTY spawn 後に `terminalStore` タブの `ptyId` フィールドが更新されているか確認する。
`TerminalPanel.tsx` の PTY spawn 処理で `terminalStore` の `updateTab(id, { ptyId: spawnedId })` が呼ばれていること。
呼ばれていない場合は `TerminalPanel.tsx` に追記する。

---

## 3-D: xterm.js 削除・Feature Flag 廃止

### 削除対象

| ファイル | 削除内容 |
|---------|---------|
| `TerminalPanel.tsx` | `USE_CANVAS_RENDERER` 定数・分岐・xterm.js `useEffect` |
| `terminalStore.ts` | `appendScrollback`、`scrollback: string[]` フィールド |
| `package.json` | `@xterm/xterm`、`@xterm/addon-fit` |
| `vite-env.d.ts` | `VITE_USE_CANVAS_RENDERER` 型定義（あれば） |

### 削除後の `TerminalPanel.tsx`

`<TerminalRenderer>` を直接レンダリングし、Feature Flag 分岐を持たないシンプルな実装にする。
