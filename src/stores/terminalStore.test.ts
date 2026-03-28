import { describe, it, expect, beforeEach } from 'vitest'
import { useTerminalStore } from './terminalStore'

describe('terminalStore', () => {
  beforeEach(() => {
    const firstTab = { id: crypto.randomUUID(), title: 'Terminal 1', ptyId: null }
    useTerminalStore.setState({ tabs: [firstTab], activeTabId: firstTab.id })
  })

  it('初期状態でタブが1つある', () => {
    expect(useTerminalStore.getState().tabs).toHaveLength(1)
  })

  it('addTab でタブが増える', () => {
    useTerminalStore.getState().addTab()
    expect(useTerminalStore.getState().tabs).toHaveLength(2)
  })

  it('addTab で追加したタブがアクティブになる', () => {
    useTerminalStore.getState().addTab()
    const { tabs, activeTabId } = useTerminalStore.getState()
    expect(activeTabId).toBe(tabs[1].id)
  })

  it('タブが1つの時 closeTab は何もしない', () => {
    const { tabs } = useTerminalStore.getState()
    useTerminalStore.getState().closeTab(tabs[0].id)
    expect(useTerminalStore.getState().tabs).toHaveLength(1)
  })

  it('closeTab でアクティブタブを閉じると残ったタブがアクティブになる', () => {
    useTerminalStore.getState().addTab()
    const { tabs } = useTerminalStore.getState()
    useTerminalStore.getState().setActiveTab(tabs[0].id)
    useTerminalStore.getState().closeTab(tabs[0].id)
    expect(useTerminalStore.getState().activeTabId).toBe(tabs[1].id)
  })

  it('setPtyId でタブに ptyId が設定される', () => {
    const { tabs } = useTerminalStore.getState()
    useTerminalStore.getState().setPtyId(tabs[0].id, 'pty-123')
    expect(useTerminalStore.getState().tabs[0].ptyId).toBe('pty-123')
  })
})
