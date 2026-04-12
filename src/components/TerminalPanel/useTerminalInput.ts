import { useEffect } from 'react'
import type React from 'react'
import { tauriApi } from '../../lib/tauriApi'

// 特殊キー → エスケープシーケンス対応表
const KEY_MAP: Record<string, string> = {
  ArrowUp: '\x1b[A',
  ArrowDown: '\x1b[B',
  ArrowRight: '\x1b[C',
  ArrowLeft: '\x1b[D',
  Home: '\x1b[H',
  End: '\x1b[F',
  Insert: '\x1b[2~',
  Delete: '\x1b[3~',
  PageUp: '\x1b[5~',
  PageDown: '\x1b[6~',
  Enter: '\r',
  Backspace: '\x7f',
  Tab: '\t',
  Escape: '\x1b',
  F1: '\x1bOP',
  F2: '\x1bOQ',
  F3: '\x1bOR',
  F4: '\x1bOS',
  F5: '\x1b[15~',
  F6: '\x1b[17~',
  F7: '\x1b[18~',
  F8: '\x1b[19~',
  F9: '\x1b[20~',
  F10: '\x1b[21~',
  F11: '\x1b[23~',
  F12: '\x1b[24~',
}

// Ctrl+アルファベット → 制御文字コード
const CTRL_CHAR_BASE = 'a'.codePointAt(0)! - 1

type KeyEventLike = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'metaKey' | 'shiftKey'>

/**
 * KeyboardEvent をターミナル入力バイト列にエンコードする。
 * 送信対象外のキーには null を返す。
 */
export function encodeKey(e: KeyEventLike): string | null {
  const { key, ctrlKey, altKey, metaKey } = e

  // Cmd+キーはブラウザ/OS のショートカットに委ねる（ターミナルへは送らない）
  if (metaKey) return null

  // Ctrl+アルファベット → \x01〜\x1a
  if (ctrlKey && !altKey && key.length === 1) {
    const lower = key.toLowerCase()
    const code = lower.codePointAt(0)!
    if (code >= 'a'.codePointAt(0)! && code <= 'z'.codePointAt(0)!) {
      return String.fromCodePoint(code - CTRL_CHAR_BASE)
    }
    // Ctrl+[ → ESC, Ctrl+\ → FS, Ctrl+] → GS
    if (key === '[') return '\x1b'
    if (key === '\\') return '\x1c'
    if (key === ']') return '\x1d'
  }

  // 特殊キー
  if (KEY_MAP[key]) return KEY_MAP[key]

  // Alt+印字可能文字 → ESC prefix
  if (altKey && !ctrlKey && key.length === 1) return '\x1b' + key

  // 印字可能文字（Ctrl/Alt なし）
  if (!ctrlKey && !altKey && key.length === 1) return key

  return null
}

interface UseTerminalInputOptions {
  ptyId: string | null
  enabled: boolean
  /** IME 入力を受け取るための hidden textarea の ref */
  inputRef: React.RefObject<HTMLTextAreaElement | null>
}

/**
 * Canvas ターミナル用のキーボード入力ハンドラ。
 * - 通常キー: keydown イベントを PTY バイト列にエンコードして write_pty に送る
 * - IME 入力: compositionend で確定テキストを write_pty に送る
 */
export function useTerminalInput({ ptyId, enabled, inputRef }: UseTerminalInputOptions): void {
  useEffect(() => {
    if (!enabled || !ptyId) return
    const el = inputRef.current
    if (!el) return

    // compositionend の直後に Enter keydown が来ても PTY に送らないためのフラグ
    // （macOS IME では Enter 押下で compositionend → keydown の順に発火する）
    let justComposed = false

    const onKeydown = (e: KeyboardEvent) => {
      // IME 変換中は keydown を無視する（compositionend で送信）
      if (e.isComposing) return

      // Ctrl+P はアプリレベルショートカット（PathPalette）→ PTY に送らない
      if (e.ctrlKey && !e.altKey && !e.metaKey && e.key === 'p') return

      // IME 確定直後の Enter は確定キーなので PTY に送らない
      if (justComposed) {
        justComposed = false
        e.preventDefault()
        return
      }

      const seq = encodeKey(e)
      if (!seq) return
      e.preventDefault()
      tauriApi.writePty(ptyId, seq).catch(console.error)
    }

    const onCompositionEnd = (e: CompositionEvent) => {
      justComposed = true
      // IME 確定テキストを PTY に送る
      if (e.data) {
        tauriApi.writePty(ptyId, e.data).catch(console.error)
      }
      // textarea に残ったテキストをクリア
      el.value = ''
    }

    el.addEventListener('keydown', onKeydown)
    el.addEventListener('compositionend', onCompositionEnd)
    return () => {
      el.removeEventListener('keydown', onKeydown)
      el.removeEventListener('compositionend', onCompositionEnd)
    }
  }, [ptyId, enabled, inputRef])
}
