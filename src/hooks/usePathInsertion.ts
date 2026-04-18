import { useCallback } from 'react'
import { useAppStore } from '../stores/appStore'
import { useTerminalStore } from '../stores/terminalStore'
import { usePromptPaletteStore } from '../stores/promptPaletteStore'
import { tauriApi } from '../lib/tauriApi'

export function usePathInsertion() {
  const projectRoot = useAppStore((s) => s.projectRoot)
  const pathFormat = useAppStore((s) => s.pathFormat)

  const insertPath = useCallback(
    (filePath: string | string[]) => {
      const paths = Array.isArray(filePath) ? filePath : [filePath]

      const formatted = paths.map((p) => {
        if (pathFormat === 'relative' && projectRoot) {
          const prefix = projectRoot.endsWith('/') ? projectRoot : projectRoot + '/'
          return p.startsWith(prefix) ? p.slice(prefix.length) : p
        }
        return p
      })

      const text = formatted.join(' ') + ' '

      // プロンプト編集パレット表示中は PTY ではなくパレットの textarea に挿入する
      const palette = usePromptPaletteStore.getState()
      if (palette.isOpen && palette.targetPtyId) {
        palette.insertAtCaret(text)
        return
      }

      // アクティブターミナルの ptyId を取得（primary 優先）
      const { primary } = useTerminalStore.getState()
      const activeGroup = primary
      const activeTab = activeGroup.tabs.find((t) => t.id === activeGroup.activeTabId)
      const ptyId = activeTab?.ptyId

      if (ptyId) {
        tauriApi.writePty(ptyId, text).catch(console.error)
        // パス挿入後にターミナルの入力フォーカスを復元する
        window.dispatchEvent(new CustomEvent('terminal:focus'))
      }
    },
    [projectRoot, pathFormat],
  )

  return { insertPath }
}
