import { create } from 'zustand'
import { usePromptPaletteStore } from './promptPaletteStore'

export interface TerminalTab {
  id: string
  ptyId: string | null
  /** タブ作成時に固定される名前（"Terminal 1" など） */
  fallbackTitle: string
  /** OSC 0/1/2 で受信した最新タイトル。null = 未受信 or リセット */
  oscTitle: string | null
  /** ユーザーが明示的にリネームした名前。null = 未設定 */
  manualTitle: string | null
  /** true のとき manualTitle を表示タイトルとして優先し OSC 更新を表示上無視する */
  pinned: boolean
  /** 非フォーカス時に OS 通知が発火し、ユーザーがまだ見ていない状態 */
  hasUnreadNotification: boolean
}

export interface TerminalGroup {
  tabs: TerminalTab[]
  activeTabId: string
}

interface TerminalState {
  primary: TerminalGroup
  secondary: TerminalGroup
  splitEnabled: boolean
  focusedPane: 'primary' | 'secondary'

  addTab: (pane: 'primary' | 'secondary') => void
  closeTab: (id: string, pane: 'primary' | 'secondary') => void
  closeAllTabs: (pane: 'primary' | 'secondary') => void
  closeOtherTabs: (id: string, pane: 'primary' | 'secondary') => void
  closeTabsToRight: (id: string, pane: 'primary' | 'secondary') => void
  /** PTY プロセス終了（exit など）時にタブを自動で閉じる／最後の 1 枚なら作り直す */
  handlePtyExited: (ptyId: string) => void
  setActiveTab: (id: string, pane: 'primary' | 'secondary') => void
  setPtyId: (tabId: string, ptyId: string) => void
  setOscTitle: (ptyId: string, rawTitle: string | null) => void
  renameTab: (tabId: string, title: string) => void
  unpinTab: (tabId: string) => void
  markUnread: (ptyId: string) => void
  clearUnread: (tabId: string) => void
  moveTab: (tabId: string, fromPane: 'primary' | 'secondary', toPane: 'primary' | 'secondary') => void
  toggleSplit: () => void
  setFocusedPane: (pane: 'primary' | 'secondary') => void
  // ショートカット用アクション
  closeActiveTab: (pane: 'primary' | 'secondary') => void
  activateTabByIndex: (index: number, pane: 'primary' | 'secondary') => void
  activatePrevTab: (pane: 'primary' | 'secondary') => void
}

const makeTab = (index: number): TerminalTab => ({
  id: crypto.randomUUID(),
  ptyId: null,
  fallbackTitle: `Terminal ${index}`,
  oscTitle: null,
  manualTitle: null,
  pinned: false,
  hasUnreadNotification: false,
})

const makeGroup = (index = 1): TerminalGroup => {
  const tab = makeTab(index)
  return { tabs: [tab], activeTabId: tab.id }
}

/**
 * OSC タイトル文字列の制御文字（C0 + DEL）を除去し、trim する。
 * 空文字や null に解決される場合は null を返し、フロント側でフォールバック名を使う。
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_RE = /[\x00-\x1F\x7F]/g
export function sanitizeTitle(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const cleaned = raw.replace(CONTROL_CHAR_RE, '').trim()
  return cleaned.length === 0 ? null : cleaned
}

/**
 * タブの表示タイトルを算出する。
 * 優先順位: (pinned かつ manualTitle あり) > oscTitle > fallbackTitle
 */
export function computeDisplayTitle(tab: TerminalTab): string {
  if (tab.pinned && tab.manualTitle) return tab.manualTitle
  return tab.oscTitle ?? tab.fallbackTitle
}

/**
 * タブが閉じられた／PTY が終了したタイミングで、プロンプト編集パレットの
 * 下書きを破棄し、当該タブが送信先だった場合はパレットを閉じる。
 * 依存方向は terminalStore → promptPaletteStore の一方向参照。
 */
function notifyPromptPaletteOfPtyClosed(ptyId: string | null | undefined) {
  if (!ptyId) return
  const palette = usePromptPaletteStore.getState()
  palette.clearDraft(ptyId)
  if (palette.targetPtyId === ptyId) {
    palette.close()
  }
}

export const useTerminalStore = create<TerminalState>((set) => ({
  primary: makeGroup(1),
  secondary: makeGroup(1),
  splitEnabled: false,
  focusedPane: 'primary',

  addTab: (pane) =>
    set((state) => {
      const group = state[pane]
      const newTab = makeTab(group.tabs.length + 1)
      return {
        [pane]: { tabs: [...group.tabs, newTab], activeTabId: newTab.id },
      }
    }),

  closeTab: (id, pane) =>
    set((state) => {
      const group = state[pane]
      if (group.tabs.length <= 1) return state
      const closing = group.tabs.find((t) => t.id === id)
      const newTabs = group.tabs.filter((t) => t.id !== id)
      const fallback = newTabs[newTabs.length - 1].id
      notifyPromptPaletteOfPtyClosed(closing?.ptyId)
      return {
        [pane]: {
          tabs: newTabs,
          activeTabId: group.activeTabId === id ? fallback : group.activeTabId,
        },
      }
    }),

  closeAllTabs: (pane) =>
    set((state) => {
      const group = state[pane]
      group.tabs.forEach((t) => notifyPromptPaletteOfPtyClosed(t.ptyId))
      const fresh = makeTab(1)
      return { [pane]: { tabs: [fresh], activeTabId: fresh.id } }
    }),

  closeOtherTabs: (id, pane) =>
    set((state) => {
      const group = state[pane]
      const target = group.tabs.find((t) => t.id === id)
      if (!target || group.tabs.length <= 1) return state
      group.tabs.forEach((t) => {
        if (t.id !== id) notifyPromptPaletteOfPtyClosed(t.ptyId)
      })
      return { [pane]: { tabs: [target], activeTabId: target.id } }
    }),

  closeTabsToRight: (id, pane) =>
    set((state) => {
      const group = state[pane]
      const idx = group.tabs.findIndex((t) => t.id === id)
      if (idx < 0 || idx === group.tabs.length - 1) return state
      const closing = group.tabs.slice(idx + 1)
      closing.forEach((t) => notifyPromptPaletteOfPtyClosed(t.ptyId))
      const newTabs = group.tabs.slice(0, idx + 1)
      const stillActive = newTabs.some((t) => t.id === group.activeTabId)
      return {
        [pane]: {
          tabs: newTabs,
          activeTabId: stillActive ? group.activeTabId : id,
        },
      }
    }),

  handlePtyExited: (ptyId) =>
    set((state) => {
      const updatePane = (pane: 'primary' | 'secondary') => {
        const group = state[pane]
        const idx = group.tabs.findIndex((t) => t.ptyId === ptyId)
        if (idx < 0) return null
        // タブ削除 or シェル再起動のいずれでも、当該 ptyId は今後使われない
        notifyPromptPaletteOfPtyClosed(ptyId)
        if (group.tabs.length <= 1) {
          // 最後の 1 枚は削除せず、新しい空タブに差し替えてシェルを再起動させる
          const fresh = makeTab(1)
          return {
            [pane]: { tabs: [fresh], activeTabId: fresh.id },
          }
        }
        const newTabs = group.tabs.filter((_, i) => i !== idx)
        const closedId = group.tabs[idx].id
        const fallback = newTabs[Math.max(0, idx - 1)].id
        return {
          [pane]: {
            tabs: newTabs,
            activeTabId: group.activeTabId === closedId ? fallback : group.activeTabId,
          },
        }
      }
      return updatePane('primary') ?? updatePane('secondary') ?? state
    }),

  setActiveTab: (id, pane) =>
    set((state) => ({ [pane]: { ...state[pane], activeTabId: id } })),

  setPtyId: (tabId, ptyId) =>
    set((state) => {
      const updateGroup = (g: TerminalGroup): TerminalGroup => ({
        ...g,
        tabs: g.tabs.map((t) => (t.id === tabId ? { ...t, ptyId } : t)),
      })
      return { primary: updateGroup(state.primary), secondary: updateGroup(state.secondary) }
    }),

  setOscTitle: (ptyId, rawTitle) =>
    set((state) => {
      const sanitized = sanitizeTitle(rawTitle)
      let changed = false
      const updateGroup = (g: TerminalGroup): TerminalGroup => {
        const tabs = g.tabs.map((t) => {
          if (t.ptyId !== ptyId) return t
          if (t.oscTitle === sanitized) return t
          changed = true
          return { ...t, oscTitle: sanitized }
        })
        return changed ? { ...g, tabs } : g
      }
      const primary = updateGroup(state.primary)
      const secondary = updateGroup(state.secondary)
      if (!changed) return state
      return { primary, secondary }
    }),

  renameTab: (tabId, title) =>
    set((state) => {
      const trimmed = title.trim()
      if (!trimmed) return state
      let changed = false
      const updateGroup = (g: TerminalGroup): TerminalGroup => {
        const tabs = g.tabs.map((t) => {
          if (t.id !== tabId) return t
          if (t.pinned && t.manualTitle === trimmed) return t
          changed = true
          return { ...t, pinned: true, manualTitle: trimmed }
        })
        return changed ? { ...g, tabs } : g
      }
      const primary = updateGroup(state.primary)
      const secondary = updateGroup(state.secondary)
      if (!changed) return state
      return { primary, secondary }
    }),

  unpinTab: (tabId) =>
    set((state) => {
      let changed = false
      const updateGroup = (g: TerminalGroup): TerminalGroup => {
        const tabs = g.tabs.map((t) => {
          if (t.id !== tabId) return t
          if (!t.pinned && t.manualTitle === null) return t
          changed = true
          return { ...t, pinned: false, manualTitle: null }
        })
        return changed ? { ...g, tabs } : g
      }
      const primary = updateGroup(state.primary)
      const secondary = updateGroup(state.secondary)
      if (!changed) return state
      return { primary, secondary }
    }),

  markUnread: (ptyId) =>
    set((state) => {
      const docFocused = typeof document !== 'undefined' && document.hasFocus()
      let changed = false
      const updateGroup = (g: TerminalGroup): TerminalGroup => {
        const tabs = g.tabs.map((t) => {
          if (t.ptyId !== ptyId) return t
          // アクティブ + ドキュメントフォーカス中ならユーザーがすでに見ているので no-op
          const isActive = g.activeTabId === t.id
          if (isActive && docFocused) return t
          if (t.hasUnreadNotification) return t
          changed = true
          return { ...t, hasUnreadNotification: true }
        })
        return changed ? { ...g, tabs } : g
      }
      const primary = updateGroup(state.primary)
      const secondary = updateGroup(state.secondary)
      if (!changed) return state
      return { primary, secondary }
    }),

  clearUnread: (tabId) =>
    set((state) => {
      let changed = false
      const updateGroup = (g: TerminalGroup): TerminalGroup => {
        const tabs = g.tabs.map((t) => {
          if (t.id !== tabId) return t
          if (!t.hasUnreadNotification) return t
          changed = true
          return { ...t, hasUnreadNotification: false }
        })
        return changed ? { ...g, tabs } : g
      }
      const primary = updateGroup(state.primary)
      const secondary = updateGroup(state.secondary)
      if (!changed) return state
      return { primary, secondary }
    }),

  moveTab: (tabId, fromPane, toPane) =>
    set((state) => {
      if (fromPane === toPane) return state
      const fromGroup = state[fromPane]
      const toGroup = state[toPane]
      const tab = fromGroup.tabs.find((t) => t.id === tabId)
      if (!tab) return state

      const newFromTabs = fromGroup.tabs.filter((t) => t.id !== tabId)
      const fromFallback = fromGroup.activeTabId === tabId
        ? newFromTabs[newFromTabs.length - 1]?.id
        : fromGroup.activeTabId
      const newFromGroup: TerminalGroup = newFromTabs.length === 0
        ? (() => { const t = makeTab(1); return { tabs: [t], activeTabId: t.id } })()
        : { tabs: newFromTabs, activeTabId: fromFallback! }

      const newToGroup: TerminalGroup = {
        tabs: [...toGroup.tabs, tab],
        activeTabId: tab.id,
      }

      return { [fromPane]: newFromGroup, [toPane]: newToGroup }
    }),

  toggleSplit: () => set((state) => ({ splitEnabled: !state.splitEnabled })),

  setFocusedPane: (pane) => set({ focusedPane: pane }),

  closeActiveTab: (pane) =>
    set((state) => {
      const group = state[pane]
      if (group.tabs.length <= 1) return state
      const activeId = group.activeTabId
      const idx = group.tabs.findIndex((t) => t.id === activeId)
      const closing = group.tabs[idx]
      const newTabs = group.tabs.filter((t) => t.id !== activeId)
      const fallback = newTabs[Math.max(0, idx - 1)].id
      notifyPromptPaletteOfPtyClosed(closing?.ptyId)
      return { [pane]: { tabs: newTabs, activeTabId: fallback } }
    }),

  activateTabByIndex: (index, pane) =>
    set((state) => {
      const group = state[pane]
      const tab = group.tabs[Math.min(index, group.tabs.length - 1)]
      if (!tab) return state
      return { [pane]: { ...group, activeTabId: tab.id } }
    }),

  activatePrevTab: (pane) =>
    set((state) => {
      const group = state[pane]
      const idx = group.tabs.findIndex((t) => t.id === group.activeTabId)
      const prevIdx = (idx - 1 + group.tabs.length) % group.tabs.length
      return { [pane]: { ...group, activeTabId: group.tabs[prevIdx].id } }
    }),
}))
