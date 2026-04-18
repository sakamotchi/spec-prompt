import { useEffect, useState } from 'react'
import { SplitPane } from '../SplitPane'
import { MainArea } from '../MainArea'
import { TreePanel } from '../TreePanel'
import { PathPalette } from '../PathPalette'
import { PromptPalette } from '../PromptPalette/PromptPalette'
import { ShortcutsModal } from '../KeyboardShortcuts/ShortcutsModal'
import { ToastHost } from '../Toast'
import { useAppStore } from '../../stores/appStore'
import { useContentStore } from '../../stores/contentStore'
import { usePromptPaletteStore } from '../../stores/promptPaletteStore'
import {
  useTerminalStore,
  computeDisplayTitle,
  type TerminalGroup,
} from '../../stores/terminalStore'
import { tauriApi } from '../../lib/tauriApi'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { listen } from '@tauri-apps/api/event'

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

      // プロンプト編集パレット表示中は、allow list のキー以外を握り潰す。
      // allow list: Ctrl+P（パス検索）/ Cmd+Shift+P / Ctrl+Shift+P（プロンプトパレット）
      if (usePromptPaletteStore.getState().isOpen) {
        const isCtrlP = ctrl && !meta && !shift && key === 'p'
        const isPromptPaletteKey =
          (meta || ctrl) && shift && (key === 'p' || key === 'P')
        if (!isCtrlP && !isPromptPaletteKey) return
      }

      // ? → ショートカット一覧を開く/閉じる
      if (key === '?' && !meta && !ctrl) {
        setShortcutsOpen((v) => !v)
        return
      }

      // Ctrl+P → パス検索パレット（既存）
      if (ctrl && !meta && !shift && key === 'p') {
        e.preventDefault()
        setPaletteOpen((prev) => !prev)
        return
      }

      // Cmd+Shift+P (mac) / Ctrl+Shift+P (win/linux) → プロンプト編集パレット
      if ((meta || ctrl) && shift && (key === 'p' || key === 'P')) {
        e.preventDefault()
        const paletteState = usePromptPaletteStore.getState()
        if (paletteState.isOpen) return
        const termState = useTerminalStore.getState()
        const { focusedPane } = termState
        const primaryActive = termState.primary.tabs.find(
          (t) => t.id === termState.primary.activeTabId,
        )
        const secondaryActive = termState.secondary.tabs.find(
          (t) => t.id === termState.secondary.activeTabId,
        )
        const preferred = focusedPane === 'secondary' ? secondaryActive : primaryActive
        const fallback = preferred ?? primaryActive ?? secondaryActive
        if (!fallback?.ptyId) return
        paletteState.open(fallback.ptyId, computeDisplayTitle(fallback))
        return
      }

      // ⌘N / Ctrl+N はアプリメニュー (File > New Window) の accelerator で捕捉されるため
      // ここでは処理しない。JS 側で処理すると menu_event とあわせて二重発火する。

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

  // File > New Window メニューから発火される menu-new-window イベントを購読。
  // app.emit は全ウィンドウにブロードキャストされるため、複数ウィンドウが開いているときは
  // 各ウィンドウのリスナが一斉に発火してウィンドウが多重生成される。
  // フォーカスされているウィンドウのみが実際に新規ウィンドウを生成するようにガードする。
  useEffect(() => {
    let unlisten: (() => void) | null = null
    let disposed = false
    listen('menu-new-window', async () => {
      try {
        const focused = await getCurrentWindow().isFocused()
        if (!focused) return
      } catch {
        return
      }
      tauriApi.openNewWindow()
    })
      .then((fn) => {
        if (disposed) fn()
        else unlisten = fn
      })
      .catch(console.error)
    return () => {
      disposed = true
      if (unlisten) unlisten()
    }
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

  // 通知発火時の未読マーク付与と、アプリフォーカス復帰時のアクティブタブのマーク解除
  useEffect(() => {
    let disposed = false
    let unlistenNotif: (() => void) | null = null
    let unlistenFocus: (() => void) | null = null

    tauriApi
      .onClaudeNotificationFired(({ pty_id }) => {
        useTerminalStore.getState().markUnread(pty_id)
      })
      .then((fn) => {
        if (disposed) fn()
        else unlistenNotif = fn
      })
      .catch(console.error)

    getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (!focused) return
        const state = useTerminalStore.getState()
        for (const pane of ['primary', 'secondary'] as const) {
          const group = state[pane]
          const active = group.tabs.find((t) => t.id === group.activeTabId)
          if (active?.hasUnreadNotification) {
            state.clearUnread(active.id)
          }
        }
      })
      .then((fn) => {
        if (disposed) fn()
        else unlistenFocus = fn
      })
      .catch(console.error)

    return () => {
      disposed = true
      if (unlistenNotif) unlistenNotif()
      if (unlistenFocus) unlistenFocus()
    }
  }, [])

  // PTY 終了イベントを購読し、該当タブを自動で閉じる（最後の 1 枚はシェルを再起動）
  useEffect(() => {
    let disposed = false
    let unlisten: (() => void) | null = null

    tauriApi
      .onPtyExited(({ id }) => {
        useTerminalStore.getState().handlePtyExited(id)
      })
      .then((fn) => {
        if (disposed) fn()
        else unlisten = fn
      })
      .catch(console.error)

    return () => {
      disposed = true
      if (unlisten) unlisten()
    }
  }, [])

  return (
    <div className="flex h-full w-full bg-[var(--color-bg-base)]">
      <SplitPane direction="horizontal" defaultSize={240} minSize={160} maxSize={480}>
        <TreePanel />
        <MainArea />
      </SplitPane>

      <PathPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <PromptPalette />
      <ShortcutsModal open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <ToastHost />
    </div>
  )
}
