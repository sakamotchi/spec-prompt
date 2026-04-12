import { useEffect, useRef, useCallback } from 'react'
import type { TerminalCellsPayload, CellData } from '../../lib/tauriApi'
import { tauriApi } from '../../lib/tauriApi'
import { resolveColor, DEFAULT_BG } from './colors'
import { useTerminalInput } from './useTerminalInput'

interface TerminalRendererProps {
  tabId: string
  ptyId: string | null
  fontFamily: string
  fontSize: number
  theme: 'dark' | 'light'
}

export function TerminalRenderer({ tabId: _tabId, ptyId, fontFamily, fontSize, theme }: TerminalRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cursorCanvasRef = useRef<HTMLCanvasElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ミュータブルな状態は ref で管理（再レンダリング不要）
  const cellWidthRef = useRef(0)
  const cellHeightRef = useRef(0)
  const colsRef = useRef(0)
  const rowsRef = useRef(0)
  const cursorRef = useRef({ row: 0, col: 0 })
  const cursorVisibleRef = useRef(true)
  const lastPayloadRef = useRef<TerminalCellsPayload | null>(null)

  // prop を ref に同期（コールバック内で最新値を参照するため）
  const ptyIdRef = useRef(ptyId)
  const themeRef = useRef(theme)
  const fontFamilyRef = useRef(fontFamily)
  const fontSizeRef = useRef(fontSize)
  useEffect(() => {
    ptyIdRef.current = ptyId
    // ptyId が確定したタイミングで resize を送る（setupCanvas 実行時はまだ null だった可能性）
    if (ptyId && colsRef.current > 0 && rowsRef.current > 0) {
      tauriApi.resizeTerminal(ptyId, colsRef.current, rowsRef.current).catch(console.error)
    }
  }, [ptyId])
  useEffect(() => { themeRef.current = theme }, [theme])
  useEffect(() => { fontFamilyRef.current = fontFamily }, [fontFamily])
  useEffect(() => { fontSizeRef.current = fontSize }, [fontSize])

  // IME 変換中テキストを保持する ref
  const compositionRef = useRef('')

  // requestAnimationFrame ID（リドロースロットリング用）
  const rafIdRef = useRef<number | null>(null)

  // textarea をカーソル位置に移動する（IME ウィンドウの表示位置を制御）
  const updateInputPosition = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    const cw = cellWidthRef.current
    const ch = cellHeightRef.current
    if (cw === 0 || ch === 0) return
    const dpr = window.devicePixelRatio || 1
    const { row, col } = cursorRef.current
    el.style.left = `${(col * cw) / dpr}px`
    el.style.top = `${(row * ch) / dpr}px`
    el.style.width = `${cw / dpr}px`
    el.style.height = `${ch / dpr}px`
  }, [])

  // ---- カーソル Canvas への描画（変換中テキストも描画） ----
  const drawCursor = useCallback((visible: boolean) => {
    const cursorCanvas = cursorCanvasRef.current
    if (!cursorCanvas) return
    const ctx = cursorCanvas.getContext('2d')
    if (!ctx) return
    const cw = cellWidthRef.current
    const ch = cellHeightRef.current
    ctx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height)
    if (cw === 0 || ch === 0) return

    const { row, col } = cursorRef.current

    // カーソルブロック
    if (visible) {
      ctx.fillStyle = '#7c6af7'
      ctx.globalAlpha = 0.8
      ctx.fillRect(col * cw, row * ch, cw, ch)
      ctx.globalAlpha = 1.0
    }

    // IME 変換中テキストをカーソル位置に描画
    const composition = compositionRef.current
    if (composition) {
      const dpr = window.devicePixelRatio || 1
      const ff = fontFamilyRef.current
      const fs = fontSizeRef.current
      const theme = themeRef.current
      const x = col * cw
      const y = row * ch
      const fg = theme === 'dark' ? '#e8e8e8' : '#1a1a1a'
      const composeBg = theme === 'dark' ? '#333366' : '#ccccff'

      ctx.font = `${fs * dpr}px "${ff}"`
      const textW = ctx.measureText(composition).width
      const bgW = Math.max(textW, cw)

      // 背景ハイライト
      ctx.fillStyle = composeBg
      ctx.fillRect(x, y, bgW, ch)

      // 変換中テキスト
      ctx.fillStyle = fg
      ctx.textBaseline = 'middle'
      ctx.fillText(composition, x, y + ch / 2)

      // アンダーライン（IME の標準的なビジュアル）
      ctx.fillStyle = fg
      ctx.fillRect(x, y + ch - 2, bgW, 1)
    }
  }, [])

  // ---- メイン Canvas へのセル描画 ----
  const drawCells = useCallback((canvas: HTMLCanvasElement, cells: CellData[]) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const cw = cellWidthRef.current
    const ch = cellHeightRef.current
    if (cw === 0 || ch === 0) return

    const theme = themeRef.current
    const ff = fontFamilyRef.current
    const fs = fontSizeRef.current
    const dpr = window.devicePixelRatio || 1

    // デフォルト背景でキャンバス全体をクリア
    ctx.fillStyle = DEFAULT_BG[theme]
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.textBaseline = 'middle'

    for (const cell of cells) {
      let fg = resolveColor(cell.fg, theme, 'fg')
      let bg = resolveColor(cell.bg, theme, 'bg')

      if (cell.flags.inverse) {
        const tmp = fg; fg = bg; bg = tmp
      }

      const x = cell.col * cw
      const y = cell.row * ch
      const w = cell.wide ? cw * 2 : cw

      // 背景
      ctx.fillStyle = bg
      ctx.fillRect(x, y, w, ch)

      // 文字（スペース・空文字はスキップ）
      if (cell.ch && cell.ch !== ' ') {
        let fontStr = `${fs * dpr}px "${ff}"`
        if (cell.flags.bold && cell.flags.italic) fontStr = `bold italic ${fontStr}`
        else if (cell.flags.bold) fontStr = `bold ${fontStr}`
        else if (cell.flags.italic) fontStr = `italic ${fontStr}`

        ctx.font = fontStr
        ctx.globalAlpha = cell.flags.dim ? 0.5 : 1.0
        ctx.fillStyle = fg
        ctx.fillText(cell.ch, x, y + ch / 2)
        ctx.globalAlpha = 1.0
      }

      // アンダーライン
      if (cell.flags.underline) {
        ctx.fillStyle = fg
        ctx.fillRect(x, y + ch - 2, w, 1)
      }

      // 打ち消し線
      if (cell.flags.strikeout) {
        ctx.fillStyle = fg
        ctx.fillRect(x, y + Math.floor(ch / 2), w, 1)
      }
    }
  }, [])

  // RAF スロットリング済みのリドロー関数（最新ペイロードのみ描画）
  // 複数イベントが1フレーム内に届いても描画は1回だけ実行する
  const scheduleRedrawRef = useRef<() => void>(() => {})
  scheduleRedrawRef.current = () => {
    if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null
      const canvas = canvasRef.current
      const last = lastPayloadRef.current
      if (!canvas || !last) return
      drawCells(canvas, last.cells)
      cursorVisibleRef.current = true
      drawCursor(true)
      updateInputPosition()
    })
  }

  // terminal-cells イベントのハンドラ（ペイロードだけ即時保存、描画は RAF に委ねる）
  const handlePayloadRef = useRef<(payload: TerminalCellsPayload) => void>(() => {})
  handlePayloadRef.current = (payload: TerminalCellsPayload) => {
    lastPayloadRef.current = payload
    cursorRef.current = payload.cursor
    scheduleRedrawRef.current()
  }

  // ---- Canvas サイズ設定と cellSize 計算 ----
  const setupCanvas = useCallback(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    const cursorCanvas = cursorCanvasRef.current
    if (!container || !canvas || !cursorCanvas) return

    const containerWidth = container.offsetWidth
    const containerHeight = container.offsetHeight
    if (containerWidth < 50 || containerHeight < 50) return

    const dpr = window.devicePixelRatio || 1
    const physW = Math.floor(containerWidth * dpr)
    const physH = Math.floor(containerHeight * dpr)

    canvas.width = physW
    canvas.height = physH
    canvas.style.width = `${containerWidth}px`
    canvas.style.height = `${containerHeight}px`
    cursorCanvas.width = physW
    cursorCanvas.height = physH
    cursorCanvas.style.width = `${containerWidth}px`
    cursorCanvas.style.height = `${containerHeight}px`

    // Canvas 2D API で cellSize を計測（WKWebView の CSS 計測に非依存）
    const ctx = canvas.getContext('2d')!
    ctx.font = `${fontSizeRef.current * dpr}px "${fontFamilyRef.current}"`
    const cw = Math.ceil(ctx.measureText('W').width)
    const ch = Math.ceil(fontSizeRef.current * dpr * 1.2)

    cellWidthRef.current = cw
    cellHeightRef.current = ch

    const cols = Math.max(1, Math.floor(physW / cw))
    const rows = Math.max(1, Math.floor(physH / ch))

    const sizeChanged = colsRef.current !== cols || rowsRef.current !== rows
    colsRef.current = cols
    rowsRef.current = rows

    if (sizeChanged) {
      const id = ptyIdRef.current
      if (id) tauriApi.resizeTerminal(id, cols, rows).catch(console.error)
    }

    // サイズ変更後、キャッシュしたペイロードで再描画
    const last = lastPayloadRef.current
    if (last) {
      drawCells(canvas, last.cells)
      drawCursor(cursorVisibleRef.current)
    }
  }, [drawCells, drawCursor])

  // 初回マウント・フォント変更時にセットアップ
  useEffect(() => {
    setupCanvas()
  }, [setupCanvas, fontFamily, fontSize])

  // コンテナリサイズを監視
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(() => { setupCanvas() })
    observer.observe(container)
    return () => observer.disconnect()
  }, [setupCanvas])

  // terminal-cells イベントを購読
  useEffect(() => {
    if (!ptyId) return
    let unlisten: (() => void) | null = null
    tauriApi.onTerminalCells((payload) => {
      if (payload.id !== ptyId) return
      handlePayloadRef.current(payload)
    }).then(fn => { unlisten = fn })
    return () => { unlisten?.() }
  }, [ptyId])

  // テーマ変更時に全再描画
  useEffect(() => {
    const canvas = canvasRef.current
    const last = lastPayloadRef.current
    if (!canvas || !last) return
    drawCells(canvas, last.cells)
    drawCursor(cursorVisibleRef.current)
  }, [theme, drawCells, drawCursor])

  // カーソル点滅（500ms ごと）
  useEffect(() => {
    const id = setInterval(() => {
      cursorVisibleRef.current = !cursorVisibleRef.current
      drawCursor(cursorVisibleRef.current)
    }, 500)
    return () => clearInterval(id)
  }, [drawCursor])

  // キーボード入力 → PTY（IME 対応 hidden textarea 経由）
  useTerminalInput({ ptyId, enabled: true, inputRef })

  // IME 変換中テキストの表示（compositionupdate / compositionend）
  useEffect(() => {
    const el = inputRef.current
    if (!el) return

    const onCompositionStart = () => {
      compositionRef.current = ''
    }
    const onCompositionUpdate = (e: CompositionEvent) => {
      compositionRef.current = e.data || ''
      drawCursor(cursorVisibleRef.current)
    }
    const onCompositionEnd = () => {
      compositionRef.current = ''
      el.value = ''
      drawCursor(cursorVisibleRef.current)
    }

    el.addEventListener('compositionstart', onCompositionStart)
    el.addEventListener('compositionupdate', onCompositionUpdate)
    el.addEventListener('compositionend', onCompositionEnd)
    return () => {
      el.removeEventListener('compositionstart', onCompositionStart)
      el.removeEventListener('compositionupdate', onCompositionUpdate)
      el.removeEventListener('compositionend', onCompositionEnd)
    }
  }, [drawCursor])

  // コンテナクリック時に hidden textarea をフォーカスして IME を有効にする
  const focusInput = () => { inputRef.current?.focus() }

  // 初回マウント時もフォーカス
  useEffect(() => {
    inputRef.current?.focus()
    updateInputPosition()
  }, [updateInputPosition])

  const bgColor = theme === 'dark' ? DEFAULT_BG.dark : DEFAULT_BG.light

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ position: 'relative', overflow: 'hidden', backgroundColor: bgColor }}
      onClick={focusInput}
    >
      {/* IME 入力を受け取るための hidden textarea */}
      <textarea
        ref={inputRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '1px',
          height: '1px',
          opacity: 0,
          padding: 0,
          border: 'none',
          outline: 'none',
          resize: 'none',
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0 }} />
      <canvas ref={cursorCanvasRef} style={{ position: 'absolute', top: 0, left: 0 }} />
    </div>
  )
}
