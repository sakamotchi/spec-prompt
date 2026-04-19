import type { RefObject } from 'react'
import { useCallback } from 'react'
import { usePromptPaletteStore } from '../stores/promptPaletteStore'

export type UsePromptHistoryCursorArgs = {
  textareaRef: RefObject<HTMLTextAreaElement | null>
  isComposing: boolean
}

export type HistoryArrowHandler = (
  event: React.KeyboardEvent<HTMLTextAreaElement>,
) => boolean

/**
 * プロンプトパレットの textarea 上で `↑` / `↓` による履歴巡回を担うフック。
 *
 * 発動条件:
 *   - IME 変換中ではない
 *   - 修飾キー（Shift / Alt / Meta / Ctrl）が押されていない
 *   - 送信先 PTY が存在し、履歴が 1 件以上
 *   - `↑` で巡回開始するには textarea が空であること。巡回中（`historyCursor !== null`）は
 *     textarea の内容に関わらず巡回継続
 *
 * 戻り値:
 *   - `handleArrowKey(event)`: 処理した場合 true。呼び出し側で preventDefault は内部で実行済み
 *   - `resetCursor()`: ユーザーの textarea 編集時に呼び出し、巡回状態を解除
 */
export function usePromptHistoryCursor(args: UsePromptHistoryCursorArgs): {
  handleArrowKey: HistoryArrowHandler
  resetCursor: () => void
} {
  const { textareaRef, isComposing } = args

  const handleArrowKey = useCallback<HistoryArrowHandler>(
    (event) => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return false
      if (isComposing || event.nativeEvent?.isComposing) return false
      if (event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) return false

      const state = usePromptPaletteStore.getState()
      const ptyId = state.targetPtyId
      if (!ptyId) return false
      if (state.history.length === 0) return false

      const ta = textareaRef.current
      const value = ta?.value ?? ''
      const cursor = state.historyCursor

      if (event.key === 'ArrowUp') {
        if (cursor === null) {
          if (value.length > 0) return false
          const nextIndex = 0
          state.setDraft(ptyId, state.history[nextIndex].body)
          state.setHistoryCursor(nextIndex)
        } else {
          const nextIndex = Math.min(cursor + 1, state.history.length - 1)
          state.setDraft(ptyId, state.history[nextIndex].body)
          state.setHistoryCursor(nextIndex)
        }
        event.preventDefault()
        scheduleCaretToEnd(textareaRef)
        return true
      }

      // ArrowDown
      if (cursor === null) return false
      if (cursor === 0) {
        state.setDraft(ptyId, '')
        state.setHistoryCursor(null)
      } else {
        const nextIndex = cursor - 1
        state.setDraft(ptyId, state.history[nextIndex].body)
        state.setHistoryCursor(nextIndex)
      }
      event.preventDefault()
      scheduleCaretToEnd(textareaRef)
      return true
    },
    [textareaRef, isComposing],
  )

  const resetCursor = useCallback(() => {
    const state = usePromptPaletteStore.getState()
    if (state.historyCursor !== null) state.setHistoryCursor(null)
  }, [])

  return { handleArrowKey, resetCursor }
}

function scheduleCaretToEnd(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
): void {
  const apply = () => {
    const ta = textareaRef.current
    if (!ta) return
    const len = ta.value.length
    try {
      ta.setSelectionRange(len, len)
    } catch {
      // jsdom など setSelectionRange が実装不完全な環境では黙殺
    }
  }
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(apply)
  } else {
    apply()
  }
}
