# 設計書 - alacritty-terminal Phase 2（WebView セルレンダラー実装）

## アーキテクチャ

### 対象コンポーネント

```
Rust (Phase 1 完了)
  │ "terminal-cells" IPC イベント
  ▼
TerminalPanel.tsx
  ├── [Feature Flag OFF] xterm.js（既存）
  └── [Feature Flag ON]  TerminalRenderer.tsx  ← Phase 2 で実装
                              │ useTerminalInput.ts
                              ▼
                         Canvas 2D API（WKWebView）
```

### 影響範囲

- **フロントエンド**: `TerminalPanel`, `TerminalRenderer`（新規）, `useTerminalInput`（新規）, `tauriApi`
- **バックエンド（Rust）**: 変更なし（Phase 1 完了）

---

## 実装方針

### 概要

1. `TerminalRenderer.tsx` を新規作成し、`terminal-cells` イベントを受信して Canvas に描画する
2. `useTerminalInput.ts` を新規作成し、`keydown` → PTY バイト列のエンコードを実装する
3. `TerminalPanel.tsx` に Feature Flag を追加し、`VITE_USE_CANVAS_RENDERER` で切り替える
4. `tauriApi.ts` に `resizeTerminal` と `onTerminalCells` を追加する

### Feature Flag の方針

開発中は xterm.js を維持したまま TerminalRenderer を並行実装する。
`import.meta.env.VITE_USE_CANVAS_RENDERER === 'true'` で切り替える。
Phase 3 完了後に xterm.js を削除し、Flag を廃止する。

### cellSize 計算方針

```ts
// Canvas 2D API で計測する（WKWebView の CSS offsetWidth に依存しない）
ctx.font = `${fontSize}px "${fontFamily}"`
const cellWidth  = Math.ceil(ctx.measureText('W').width)
const cellHeight = Math.ceil(fontSize * 1.2)   // 行間 1.2 倍
```

フォント変更時は `TerminalRenderer` を再マウントして Canvas と cellSize をリセットする（`key` prop で制御）。

### 差分描画の方針

`terminal-cells` イベントが届いたら、受け取ったセル群を内部グリッドキャッシュに上書きし、
変更があったセルのみ再描画する。全画面再描画（TermDamage::Full 相当）は `cells` 配列全体が届いたときのみ行う。

---

## データ構造

### 型定義（TypeScript）

```typescript
// terminal-cells イベントのペイロード（Rust 側の TerminalCellsPayload と対応）
interface TerminalCellsPayload {
  id: string
  cells: CellData[]
  cursor: CursorPos
}

interface CellData {
  row: number
  col: number
  ch: string
  wide: boolean      // true = 全角（cellWidth × 2 で描画）
  fg: ColorData
  bg: ColorData
  flags: CellFlags
}

type ColorData =
  | { type: 'Named';   value: number }   // ANSI 16色 (0-15)
  | { type: 'Indexed'; value: number }   // xterm-256色 (0-255)
  | { type: 'Rgb';     value: { r: number; g: number; b: number } }

interface CellFlags {
  bold:      boolean
  italic:    boolean
  underline: boolean
  strikeout: boolean
  inverse:   boolean
  dim:       boolean
}

interface CursorPos {
  row: number
  col: number
}
```

### Props（TerminalRenderer）

```typescript
interface TerminalRendererProps {
  tabId: string
  ptyId: string | null
  fontFamily: string
  fontSize: number
  theme: 'dark' | 'light'
}
```

---

## API設計

### Tauriコマンド（追加）

| コマンド名 | 引数 | 戻り値 | 説明 |
|-----------|------|--------|------|
| `resize_terminal` | `id: String, cols: u16, rows: u16` | `Result<(), String>` | PTY と Term 両方をリサイズ（Phase 1 実装済み） |

### Tauriイベント（受信）

| イベント名 | ペイロード | 説明 |
|-----------|-----------|------|
| `terminal-cells` | `TerminalCellsPayload` | セルグリッド差分（Phase 1 実装済み） |

### tauriApi.ts 追加メソッド

```typescript
resizeTerminal: (id: string, cols: number, rows: number): Promise<void> =>
  invoke("resize_terminal", { id, cols, rows }),

onTerminalCells: (callback: (payload: TerminalCellsPayload) => void): Promise<UnlistenFn> =>
  listen<TerminalCellsPayload>("terminal-cells", (event) => callback(event.payload)),
```

---

## UI設計

### コンポーネント構成

```
TerminalPanel.tsx
  ├── (Feature Flag OFF) xterm.js の既存コード
  └── (Feature Flag ON)
        TerminalRenderer.tsx
          ├── <canvas ref={canvasRef} />          メイン描画レイヤー
          └── <canvas ref={cursorCanvasRef} />    カーソルオーバーレイ（点滅アニメーション用）
```

### TerminalRenderer の状態管理

```typescript
// コンポーネント内部の ref / state
const canvasRef = useRef<HTMLCanvasElement>(null)
const cursorCanvasRef = useRef<HTMLCanvasElement>(null)
const cellSizeRef = useRef({ width: 0, height: 0 })
const gridRef = useRef<CellData[][]>([])   // [row][col] のセルキャッシュ
const cursorRef = useRef<CursorPos>({ row: 0, col: 0 })
```

### カーソル描画

- メイン Canvas にカーソル位置のセルを通常描画
- カーソル Canvas を overlay で重ね、`requestAnimationFrame` で 500ms ごとに表示/非表示をトグル

### カラーパレット（ANSI 16色）

```typescript
// src/components/TerminalPanel/colors.ts に定義
export const ANSI_DARK: string[] = [
  '#0d0d0d', // 0: Black
  '#cc3333', // 1: Red
  '#33cc33', // 2: Green
  '#cccc33', // 3: Yellow
  '#3366cc', // 4: Blue
  '#cc33cc', // 5: Magenta
  '#33cccc', // 6: Cyan
  '#cccccc', // 7: White
  '#666666', // 8: BrightBlack
  '#ff5555', // 9: BrightRed
  // ...
]
```

---

## useTerminalInput 設計

```typescript
// src/components/TerminalPanel/useTerminalInput.ts

interface UseTerminalInputOptions {
  ptyId: string | null
  enabled: boolean
}

export function useTerminalInput({ ptyId, enabled }: UseTerminalInputOptions) {
  useEffect(() => {
    if (!enabled || !ptyId) return
    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      const seq = encodeKey(e)
      if (seq) tauriApi.writePty(ptyId, seq).catch(console.error)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [ptyId, enabled])
}
```

### キーエンコードテーブル（主要キー）

| キー | エスケープシーケンス |
|------|---------------------|
| Enter | `\r` |
| Backspace | `\x7f` |
| Tab | `\t` |
| Escape | `\x1b` |
| ArrowUp | `\x1b[A` |
| ArrowDown | `\x1b[B` |
| ArrowRight | `\x1b[C` |
| ArrowLeft | `\x1b[D` |
| F1 | `\x1bOP` |
| F2 | `\x1bOQ` |
| F3 | `\x1bOR` |
| F4 | `\x1bOS` |
| F5 | `\x1b[15~` |
| F6〜F12 | `\x1b[17~` 〜 `\x1b[24~` |
| Ctrl+A〜Z | `\x01` 〜 `\x1a` |
| Ctrl+[ | `\x1b` |
| Ctrl+\\ | `\x1c` |

---

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| Canvas 2 レイヤー（メイン + カーソル） | カーソル点滅でメイン Canvas 全体を再描画しない | 1 Canvas で都度描画（点滅コストが高い） |
| cellHeight = fontSize × 1.2 | `measureText` の ascent/descent 合計の近似値として安定 | fontBoundingBoxAscent + Descent（ブラウザ差異あり） |
| Feature Flag は環境変数（VITE_USE_CANVAS_RENDERER） | ビルド時に tree-shake される | 実行時フラグ（設定 UI が複雑になる） |
| キーエンコードは純粋関数 `encodeKey(e)` | テスタブル、ロジック分離 | インライン switch 文 |
| `resize_terminal` に切り替え（`resize_pty` から） | PTY と Term 両方を同期してリサイズ | resize_pty のみ（Term のサイズがズレる） |

## 未解決事項

- [ ] IME（日本語入力）の対応方法：`compositionstart/end` イベントを `keydown` と組み合わせる方式で実装予定。Phase 2 では英数字入力に絞り、Phase 3 で対応する
- [ ] 高 DPI（Retina）対応：`window.devicePixelRatio` で Canvas を拡大しCSSサイズをそのままにする。Phase 2 で対応する
