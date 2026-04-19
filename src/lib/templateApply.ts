import { usePromptPaletteStore } from '../stores/promptPaletteStore'
import { parsePlaceholders } from './templatePlaceholders'

/**
 * テンプレート本文を textarea（draft）に流し込む共通関数。
 *
 * 1. `setDraft(ptyId, body)` で draft を更新
 * 2. `setHistoryCursor(null)` で履歴巡回状態をリセット
 * 3. `closeDropdown()` でドロップダウンを閉じる
 * 4. `requestAnimationFrame` で textarea の value 反映後、
 *    最初の `{{...}}` があれば選択状態にし、無ければ末尾にキャレットを置く
 * 5. textarea にフォーカスを戻す
 */
export function applyTemplateBodyToDraft(body: string): void {
  const state = usePromptPaletteStore.getState()
  const ptyId = state.targetPtyId
  if (!ptyId) return

  state.setDraft(ptyId, body)
  state.setHistoryCursor(null)
  state.closeDropdown()

  const apply = () => {
    const ta = usePromptPaletteStore.getState().textareaRef?.current
    if (!ta) return
    ta.focus()
    const placeholders = parsePlaceholders(body)
    try {
      if (placeholders.length > 0) {
        const first = placeholders[0]
        ta.setSelectionRange(first.start, first.end)
      } else {
        const len = ta.value.length
        ta.setSelectionRange(len, len)
      }
    } catch {
      // jsdom 等で setSelectionRange 未実装の環境は黙殺
    }
  }
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(apply)
  } else {
    apply()
  }
}
