import { useEffect, useRef, useCallback } from 'react'
import type { TerminalCellsPayload, CellData } from '../../lib/tauriApi'
import { tauriApi } from '../../lib/tauriApi'
import { resolveColor, DEFAULT_BG } from './colors'
import { useTerminalInput } from './useTerminalInput'
import { useAppStore } from '../../stores/appStore'

/**
 * 選択位置のアンカー。
 * `line` は alacritty のグリッド絶対行（0=現在アクティブ画面の先頭、負値=スクロールバック履歴）。
 * ビューポート行 = `line + scroll_offset` で変換する。
 * スクロール追随と、スクロールバックに流れた内容のコピー（Cmd+C）に使う。
 */
interface SelAnchor { line: number; col: number }
interface SelectionRange { start: SelAnchor; end: SelAnchor }
interface CellPos { row: number; col: number }

interface TerminalRendererProps {
  ptyId: string | null
  fontFamily: string
  fontSize: number
  theme: 'dark' | 'light'
}

function pixelToCell(cssX: number, cssY: number, cw: number, ch: number, dpr: number): CellPos {
  return {
    col: Math.floor(cssX * dpr / cw),
    row: Math.floor(cssY * dpr / ch),
  }
}

function normalizeSelection(sel: SelectionRange): [SelAnchor, SelAnchor] {
  const { start, end } = sel
  const startBefore = start.line < end.line || (start.line === end.line && start.col <= end.col)
  return startBefore ? [start, end] : [end, start]
}

export function TerminalRenderer({ ptyId, fontFamily, fontSize, theme }: TerminalRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cursorCanvasRef = useRef<HTMLCanvasElement>(null)
  const scrollbarRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ミュータブルな状態は ref で管理（再レンダリング不要）
  const cellWidthRef = useRef(0)
  const cellHeightRef = useRef(0)
  const colsRef = useRef(0)
  const rowsRef = useRef(0)
  const cursorRef = useRef({ row: 0, col: 0 })
  const cursorVisibleRef = useRef(true)
  const lastPayloadRef = useRef<TerminalCellsPayload | null>(null)

  // スクロールバック
  const scrollOffsetRef = useRef(0)
  const scrollbackLenRef = useRef(0)

  // テキスト選択
  const selectionRef = useRef<SelectionRange | null>(null)
  const isDraggingRef = useRef(false)

  // スクロールバードラッグ
  const isScrollbarDraggingRef = useRef(false)
  const scrollbarDragStartYRef = useRef(0)
  const scrollbarDragStartOffsetRef = useRef(0)

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

  // スクロールバー DOM を直接更新（React 再レンダリング不要）
  const updateScrollbar = useCallback(() => {
    const el = scrollbarRef.current
    const container = containerRef.current
    if (!el || !container) return
    const offset = scrollOffsetRef.current
    const len = scrollbackLenRef.current
    if (len === 0) {
      el.style.opacity = '0'
      return
    }
    el.style.opacity = '1'
    el.style.background = themeRef.current === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'
    const containerHeight = container.offsetHeight
    const rows = rowsRef.current
    const ratio = rows / (rows + len)
    const barH = Math.max(20, containerHeight * ratio)
    const barTop = (containerHeight - barH) * (1 - offset / len)
    el.style.height = `${barH}px`
    el.style.top = `${barTop}px`
  }, [])

  // ---- カーソル Canvas への描画（変換中テキスト・選択ハイライトも描画） ----
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

    // 選択ハイライト
    // selection は alacritty グリッド絶対行で保持しているため、
    // 現在の scroll_offset を足して viewport row に変換してから描画する。
    // viewport 範囲外（スクロールアウト）の行はクリップ。
    const sel = selectionRef.current
    if (sel) {
      const [from, to] = normalizeSelection(sel)
      const scrollOff = scrollOffsetRef.current
      const rows = rowsRef.current
      ctx.fillStyle = 'rgba(124, 106, 247, 0.35)'
      for (let line = from.line; line <= to.line; line++) {
        const vRow = line + scrollOff
        if (vRow < 0 || vRow >= rows) continue
        const startCol = line === from.line ? from.col : 0
        const endCol   = line === to.line   ? to.col   : colsRef.current
        if (endCol > startCol) {
          ctx.fillRect(startCol * cw, vRow * ch, (endCol - startCol) * cw, ch)
        }
      }
    }

    // カーソルブロック（スクロール中は非表示）
    if (visible && scrollOffsetRef.current === 0) {
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
      const currentTheme = themeRef.current
      const x = col * cw
      const y = row * ch
      const fg = currentTheme === 'dark' ? '#e8e8e8' : '#1a1a1a'
      const composeBg = currentTheme === 'dark' ? '#333366' : '#ccccff'

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

    const currentTheme = themeRef.current
    const ff = fontFamilyRef.current
    const fs = fontSizeRef.current
    const dpr = window.devicePixelRatio || 1

    // デフォルト背景でキャンバス全体をクリア
    ctx.fillStyle = DEFAULT_BG[currentTheme]
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.textBaseline = 'middle'

    for (const cell of cells) {
      let fg = resolveColor(cell.fg, currentTheme, 'fg')
      let bg = resolveColor(cell.bg, currentTheme, 'bg')

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
        // maxWidth にセル幅を渡すことで、ambiguous-width 文字（丸数字など）が
        // フォント本来の全角字形幅で隣セルへはみ出すのを防ぐ
        ctx.fillText(cell.ch, x, y + ch / 2, w)
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
      updateScrollbar()
    })
  }

  // terminal-cells イベントのハンドラ
  const handlePayloadRef = useRef<(payload: TerminalCellsPayload) => void>(() => {})
  handlePayloadRef.current = (payload: TerminalCellsPayload) => {
    lastPayloadRef.current = payload
    cursorRef.current = payload.cursor
    scrollOffsetRef.current = payload.scroll_offset
    scrollbackLenRef.current = payload.scrollback_len
    scheduleRedrawRef.current()
  }

  // ---- Canvas サイズ設定と cellSize 計算 ----
  // resizeTerminal IPC のデバウンスタイマー
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

    // キャッシュしたペイロードで即座に再描画（Canvas サイズだけ合わせる）
    const last = lastPayloadRef.current
    if (last) {
      drawCells(canvas, last.cells)
      drawCursor(cursorVisibleRef.current)
      updateScrollbar()
    }

    // resizeTerminal IPC はデバウンス（150ms）で遅延実行する。
    // ウィンドウリサイズ中は ResizeObserver が高頻度で発火するため、
    // 毎回 Rust 側で全セル再計算 → IPC 送信するとフレーム落ちの原因になる。
    if (sizeChanged) {
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current)
      resizeTimerRef.current = setTimeout(() => {
        resizeTimerRef.current = null
        const id = ptyIdRef.current
        if (id) tauriApi.resizeTerminal(id, cols, rows).catch(console.error)
      }, 150)
    }
  }, [drawCells, drawCursor, updateScrollbar])

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

  // ---- Cmd+C ハンドラ ----
  // 選択がスクロールバックに流れていても正しくコピーできるよう、
  // Rust 側グリッドから抽出する（ビューポートの lastPayload に閉じない）。
  useEffect(() => {
    const el = inputRef.current
    if (!el) return

    const onKeydown = (e: KeyboardEvent) => {
      if (!e.metaKey || e.key !== 'c') return
      const sel = selectionRef.current
      const id = ptyIdRef.current
      if (sel && id) {
        const [from, to] = normalizeSelection(sel)
        tauriApi
          .extractTerminalText(id, from.line, to.line, from.col, to.col)
          .then(text => {
            if (text) navigator.clipboard.writeText(text).catch(console.error)
          })
          .catch(console.error)
      }
      // 選択を解除
      selectionRef.current = null
      drawCursor(cursorVisibleRef.current)
      e.preventDefault()
    }

    el.addEventListener('keydown', onKeydown)
    return () => el.removeEventListener('keydown', onKeydown)
  }, [drawCursor])

  // ---- ペーストハンドラ（paste イベント経由で ClipboardEvent を使う）----
  // navigator.clipboard.readText() は他アプリのクリップボードで WKWebView のポップアップが出るため、
  // textarea の paste イベントの clipboardData から直接取得することで回避する。
  useEffect(() => {
    const el = inputRef.current
    if (!el) return

    const onPaste = (e: ClipboardEvent) => {
      e.preventDefault()
      const text = e.clipboardData?.getData('text/plain')
      const id = ptyIdRef.current
      if (text && id) {
        tauriApi.writePty(id, text).catch(console.error)
      }
    }

    el.addEventListener('paste', onPaste)
    return () => el.removeEventListener('paste', onPaste)
  }, [])

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

  // ---- マウスホイール → スクロール ----
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const onWheel = (e: WheelEvent) => {
      const id = ptyIdRef.current
      if (!id) return
      e.preventDefault()
      // deltaY 正=下スクロール → ターミナルでは過去へ（正の delta）
      const delta = e.deltaY > 0 ? -3 : 3
      tauriApi.scrollTerminal(id, delta).catch(console.error)
    }

    container.addEventListener('wheel', onWheel, { passive: false })
    return () => container.removeEventListener('wheel', onWheel)
  }, [])

  // ---- スクロールバードラッグ ----
  useEffect(() => {
    const bar = scrollbarRef.current
    if (!bar) return

    const onBarMouseDown = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      isScrollbarDraggingRef.current = true
      scrollbarDragStartYRef.current = e.clientY
      scrollbarDragStartOffsetRef.current = scrollOffsetRef.current
      bar.style.cursor = 'grabbing'
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isScrollbarDraggingRef.current) return
      const container = containerRef.current
      const id = ptyIdRef.current
      if (!container || !id) return

      const containerHeight = container.offsetHeight
      const rows = rowsRef.current
      const len = scrollbackLenRef.current
      if (len === 0) return

      const ratio = rows / (rows + len)
      const barH = Math.max(20, containerHeight * ratio)
      const trackHeight = containerHeight - barH
      if (trackHeight <= 0) return

      const deltaY = e.clientY - scrollbarDragStartYRef.current
      // ドラッグ下方向 = barTop 増加 = offset 減少（末尾へ）
      const deltaOffset = -Math.round(deltaY * len / trackHeight)
      const targetOffset = Math.max(0, Math.min(len, scrollbarDragStartOffsetRef.current + deltaOffset))
      const scrollDelta = targetOffset - scrollOffsetRef.current

      if (scrollDelta !== 0) {
        tauriApi.scrollTerminal(id, scrollDelta).catch(console.error)
      }
    }

    const onMouseUp = () => {
      if (!isScrollbarDraggingRef.current) return
      isScrollbarDraggingRef.current = false
      bar.style.cursor = 'grab'
    }

    bar.addEventListener('mousedown', onBarMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      bar.removeEventListener('mousedown', onBarMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  // ビューポート座標 → selection アンカー（グリッド絶対行）
  // line = viewport_row - scroll_offset、つまり画面下部＝末尾時に 0..screen_lines-1、
  // スクロールバック行は負の値になる。
  const toAnchor = useCallback((cell: CellPos): SelAnchor => {
    const col = Math.max(0, Math.min(colsRef.current - 1, cell.col))
    const vRow = Math.max(0, Math.min(rowsRef.current - 1, cell.row))
    return { line: vRow - scrollOffsetRef.current, col }
  }, [])

  // ---- マウス選択ハンドラ ----
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // スクロールバードラッグ中はテキスト選択を開始しない
    if (isScrollbarDraggingRef.current) return
    const cw = cellWidthRef.current
    const ch = cellHeightRef.current
    const dpr = window.devicePixelRatio || 1
    const cell = pixelToCell(e.nativeEvent.offsetX, e.nativeEvent.offsetY, cw, ch, dpr)
    const anchor = toAnchor(cell)
    selectionRef.current = { start: anchor, end: anchor }
    isDraggingRef.current = true
    drawCursor(cursorVisibleRef.current)
    inputRef.current?.focus()
  }, [drawCursor, toAnchor])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return
    const cw = cellWidthRef.current
    const ch = cellHeightRef.current
    const dpr = window.devicePixelRatio || 1
    const cell = pixelToCell(e.nativeEvent.offsetX, e.nativeEvent.offsetY, cw, ch, dpr)
    selectionRef.current = { ...selectionRef.current!, end: toAnchor(cell) }
    drawCursor(cursorVisibleRef.current)
  }, [drawCursor, toAnchor])

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false
  }, [])

  // コンテナクリック時に hidden textarea をフォーカスして IME を有効にする
  const focusInput = useCallback(() => { inputRef.current?.focus() }, [])

  // 初回マウント時もフォーカス
  useEffect(() => {
    inputRef.current?.focus()
    updateInputPosition()
  }, [updateInputPosition])

  // パス挿入など外部操作でフォーカスが外れたとき textarea を再フォーカスする
  useEffect(() => {
    const handler = () => { inputRef.current?.focus() }
    window.addEventListener('terminal:focus', handler)
    return () => window.removeEventListener('terminal:focus', handler)
  }, [])

  // キー入力時に選択解除・スクロール末尾へ戻す処理は useTerminalInput を通じて行うため、
  // PTY への書き込みが発生したタイミングにフックする
  // Enter 押下時は git status を更新（git commit, git add 等のコマンド実行検知）
  const refreshGitStatus = useAppStore((s) => s.refreshGitStatus)
  useEffect(() => {
    const el = inputRef.current
    if (!el) return

    const onKeydown = (e: KeyboardEvent) => {
      if (e.metaKey || e.isComposing) return
      // 何らかのキーが PTY に送られるとき（encodeKey が null 以外になるとき）に選択解除
      if (e.key.length === 1 || ['Enter','Backspace','Tab','Escape','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Delete'].includes(e.key)) {
        selectionRef.current = null
        // スクロール末尾へ戻す
        const id = ptyIdRef.current
        if (id && scrollOffsetRef.current > 0) {
          tauriApi.scrollTerminal(id, -scrollOffsetRef.current).catch(console.error)
        }
        // Enter 押下時に git status を更新（デバウンス済み）
        if (e.key === 'Enter') {
          refreshGitStatus()
        }
      }
    }

    el.addEventListener('keydown', onKeydown, { capture: false })
    return () => el.removeEventListener('keydown', onKeydown, { capture: false })
  }, [refreshGitStatus])

  const bgColor = theme === 'dark' ? DEFAULT_BG.dark : DEFAULT_BG.light

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ position: 'relative', overflow: 'hidden', backgroundColor: bgColor }}
      onClick={focusInput}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
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
      {/* スクロールバー（ドラッグ対応） */}
      <div
        ref={scrollbarRef}
        style={{
          position: 'absolute',
          right: 2,
          top: 0,
          width: 6,
          height: 40,
          background: theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)',
          borderRadius: 3,
          opacity: 0,
          cursor: 'grab',
          transition: 'opacity 0.2s',
        }}
      />
    </div>
  )
}
