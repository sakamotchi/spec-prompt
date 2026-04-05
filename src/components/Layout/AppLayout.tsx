import { useEffect, useState } from 'react'
import { SplitPane } from '../SplitPane'
import { MainArea } from '../MainArea'
import { TreePanel } from '../TreePanel'
import { PathPalette } from '../PathPalette'
import { ShortcutsModal } from '../KeyboardShortcuts/ShortcutsModal'
import { useAppStore } from '../../stores/appStore'
import { useContentStore } from '../../stores/contentStore'
import { useTerminalStore } from '../../stores/terminalStore'

export function AppLayout() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const tag = target.tagName
      // テキスト入力系とターミナル入力欄はスキップ
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (target.classList.contains('xterm-helper-textarea')) return

      const meta = e.metaKey
      const ctrl = e.ctrlKey
      const shift = e.shiftKey
      const key = e.key

      // ? → ショートカット一覧を開く/閉じる
      if (key === '?' && !meta && !ctrl) {
        setShortcutsOpen((v) => !v)
        return
      }

      // Ctrl+P → パス検索パレット（既存）
      if (ctrl && !meta && key === 'p') {
        e.preventDefault()
        setPaletteOpen((prev) => !prev)
        return
      }

      // Cmd+T → コンテンツタブを新規作成
      if (meta && !shift && !ctrl && key === 't') {
        e.preventDefault()
        useContentStore.getState().addNewTab()
        useAppStore.getState().setActiveMainTab('content')
        return
      }

      // Cmd+Shift+T → ターミナルタブを新規作成
      if (meta && shift && !ctrl && key === 'T') {
        e.preventDefault()
        const { focusedPane } = useTerminalStore.getState()
        useTerminalStore.getState().addTab(focusedPane)
        useAppStore.getState().setActiveMainTab('terminal')
        return
      }

      // Cmd+W → アクティブタブを閉じる
      if (meta && !shift && !ctrl && key === 'w') {
        e.preventDefault()
        const { activeMainTab } = useAppStore.getState()
        if (activeMainTab === 'content') {
          useContentStore.getState().closeActiveTab()
        } else {
          const { focusedPane } = useTerminalStore.getState()
          useTerminalStore.getState().closeActiveTab(focusedPane)
        }
        return
      }

      // Cmd+0 → ツリーパネルへフォーカス
      if (meta && !shift && !ctrl && key === '0') {
        e.preventDefault()
        document.querySelector<HTMLElement>('[data-panel="tree"]')?.focus()
        return
      }

      // Cmd+1-9 → n番目のタブをアクティブ化
      if (meta && !shift && !ctrl && /^[1-9]$/.test(key)) {
        e.preventDefault()
        const idx = parseInt(key) - 1
        const { activeMainTab } = useAppStore.getState()
        if (activeMainTab === 'content') {
          useContentStore.getState().activateTabByIndex(idx)
        } else {
          const { focusedPane } = useTerminalStore.getState()
          useTerminalStore.getState().activateTabByIndex(idx, focusedPane)
        }
        return
      }

      // Ctrl+Shift+Tab → 前のタブへ
      if (ctrl && shift && !meta && key === 'Tab') {
        e.preventDefault()
        const { activeMainTab } = useAppStore.getState()
        if (activeMainTab === 'content') {
          useContentStore.getState().activatePrevTab()
        } else {
          const { focusedPane } = useTerminalStore.getState()
          useTerminalStore.getState().activatePrevTab(focusedPane)
        }
        return
      }

      // Cmd+\ → コンテンツ分割切り替え
      if (meta && !shift && !ctrl && key === '\\') {
        e.preventDefault()
        useContentStore.getState().toggleSplit()
        return
      }

      // Cmd+Shift+\ (= Cmd+|) → ターミナル分割切り替え
      if (meta && shift && !ctrl && key === '|') {
        e.preventDefault()
        useTerminalStore.getState().toggleSplit()
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="flex h-full w-full bg-[var(--color-bg-base)]">
      <SplitPane direction="horizontal" defaultSize={240} minSize={160} maxSize={480}>
        <TreePanel />
        <MainArea />
      </SplitPane>

      <PathPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ShortcutsModal open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  )
}
