import type { ColorData } from '../../lib/tauriApi'

// ANSI 16色パレット（ダークテーマ）
const ANSI_DARK: string[] = [
  '#0d0d0d', // 0: Black
  '#cc3333', // 1: Red
  '#33cc33', // 2: Green
  '#cccc33', // 3: Yellow
  '#3366cc', // 4: Blue
  '#cc33cc', // 5: Magenta
  '#33cccc', // 6: Cyan
  '#cccccc', // 7: White
  '#555555', // 8: BrightBlack
  '#ff5555', // 9: BrightRed
  '#55ff55', // 10: BrightGreen
  '#ffff55', // 11: BrightYellow
  '#5555ff', // 12: BrightBlue
  '#ff55ff', // 13: BrightMagenta
  '#55ffff', // 14: BrightCyan
  '#ffffff', // 15: BrightWhite
]

// ANSI 16色パレット（ライトテーマ）
const ANSI_LIGHT: string[] = [
  '#ffffff', // 0: Black → 白背景
  '#cc0000', // 1: Red
  '#006600', // 2: Green
  '#999900', // 3: Yellow
  '#0000cc', // 4: Blue
  '#990099', // 5: Magenta
  '#009999', // 6: Cyan
  '#333333', // 7: White → 濃い前景色
  '#666666', // 8: BrightBlack
  '#ff3333', // 9: BrightRed
  '#00aa00', // 10: BrightGreen
  '#aaaa00', // 11: BrightYellow
  '#0000ff', // 12: BrightBlue
  '#aa00aa', // 13: BrightMagenta
  '#00aaaa', // 14: BrightCyan
  '#000000', // 15: BrightWhite → 黒
]

const DEFAULT_FG_DARK = '#e8e8e8'
const DEFAULT_BG_DARK = '#0d0d0d'
const DEFAULT_FG_LIGHT = '#1a1a1a'
const DEFAULT_BG_LIGHT = '#ffffff'

export const DEFAULT_FG = { dark: DEFAULT_FG_DARK, light: DEFAULT_FG_LIGHT }
export const DEFAULT_BG = { dark: DEFAULT_BG_DARK, light: DEFAULT_BG_LIGHT }

// xterm-256 色テーブル（インデックス 16-255 の部分を事前計算）
function buildXterm256Table(): string[] {
  const table: string[] = new Array(256).fill('')
  // 16-231: 6×6×6 RGB cube
  const levels = [0, 95, 135, 175, 215, 255]
  for (let i = 16; i <= 231; i++) {
    const n = i - 16
    const r = levels[Math.floor(n / 36)]
    const g = levels[Math.floor(n / 6) % 6]
    const b = levels[n % 6]
    table[i] = `rgb(${r},${g},${b})`
  }
  // 232-255: grayscale (8, 18, 28, ..., 238)
  for (let i = 232; i <= 255; i++) {
    const v = 8 + (i - 232) * 10
    table[i] = `rgb(${v},${v},${v})`
  }
  return table
}

const XTERM_256 = buildXterm256Table()

/**
 * ColorData を CSS 色文字列に変換する。
 * @param role - 'fg'（前景）または 'bg'（背景）。Default バリアントの解決に使用。
 */
export function resolveColor(color: ColorData, theme: 'dark' | 'light', role: 'fg' | 'bg' = 'fg'): string {
  const isDark = theme === 'dark'
  const palette = isDark ? ANSI_DARK : ANSI_LIGHT

  if (color.type === 'Named') {
    const v = color.value
    if (v < 16) return palette[v]
    // Named(256)=Foreground, Named(257)=Background は Rust 側で Default に変換済み
    // ここに到達するのはパレット範囲外の想定外値のみ → デフォルト前景色で代替
    return isDark ? DEFAULT_FG_DARK : DEFAULT_FG_LIGHT
  }

  if (color.type === 'Indexed') {
    const v = color.value
    if (v < 16) return palette[v]
    return XTERM_256[v] || (isDark ? DEFAULT_FG_DARK : DEFAULT_FG_LIGHT)
  }

  if (color.type === 'Rgb') {
    return `rgb(${color.value.r},${color.value.g},${color.value.b})`
  }

  // Default: テーマの fg/bg デフォルト色を role に応じて返す
  if (role === 'bg') return isDark ? DEFAULT_BG_DARK : DEFAULT_BG_LIGHT
  return isDark ? DEFAULT_FG_DARK : DEFAULT_FG_LIGHT
}
