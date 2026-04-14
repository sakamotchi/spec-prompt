import { useEffect, useState } from 'react'
import { SplitPane } from '../SplitPane'
import { MainArea } from '../MainArea'
import { TreePanel } from '../TreePanel'
import { PathPalette } from '../PathPalette'
import { ShortcutsModal } from '../KeyboardShortcuts/ShortcutsModal'
import { useAppStore } from '../../stores/appStore'
import { useContentStore } from '../../stores/contentStore'
import {
  useTerminalStore,
  computeDisplayTitle,
  type TerminalGroup,
} from '../../stores/terminalStore'
import { tauriApi } from '../../lib/tauriApi'

export function AppLayout() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const tag = target.tagName
      const meta = e.metaKey
      const ctrl = e.ctrlKey
      const shift = e.shiftKey
      const key = e.key

      // 修飾キーなしの通常入力はテキスト入力欄・ターミナルに任せる
      // 修飾キー付きショートカット（Cmd/Ctrl）はターミナルフォーカス中も処理する
      if (!meta && !ctrl) {
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        if (target.classList.contains('xterm-helper-textarea')) return
      }

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

      // Cmd+T → ターミナルタブを新規作成
      if (meta && !shift && !ctrl && key === 't') {
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

    // キャプチャフェーズで登録することで xterm.js の keydown ハンドラより先に実行する
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [])

  // OSC 0/1/2 由来のタイトル変化を購読し、表示タイトルの変化を Rust 側キャッシュへ同期する
  useEffect(() => {
    let disposed = false
    let unlisten: (() => void) | null = null

    tauriApi
      .onTerminalTitleChanged(({ pty_id, title }) => {
        useTerminalStore.getState().setOscTitle(pty_id, title)
      })
      .then((fn) => {
        if (disposed) {
          fn()
        } else {
          unlisten = fn
        }
      })
      .catch(console.error)

    // 表示タイトル（computeDisplayTitle）が変化した ptyId をまとめて Rust に同期する
    const unsubscribe = useTerminalStore.subscribe((state, prev) => {
      const syncPane = (cur: TerminalGroup, old: TerminalGroup) => {
        for (const tab of cur.tabs) {
          if (!tab.ptyId) continue
          const oldTab = old.tabs.find((t) => t.id === tab.id)
          const newDisp = computeDisplayTitle(tab)
          const oldDisp = oldTab ? computeDisplayTitle(oldTab) : null
          if (newDisp !== oldDisp) {
            tauriApi.setPtyDisplayTitle(tab.ptyId, newDisp).catch(console.error)
          }
        }
      }
      syncPane(state.primary, prev.primary)
      syncPane(state.secondary, prev.secondary)
    })

    return () => {
      disposed = true
      if (unlisten) unlisten()
      unsubscribe()
    }
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
