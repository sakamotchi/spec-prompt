import { describe, it, expect, beforeEach } from 'vitest'
import { useTerminalStore } from './terminalStore'

function resetStore() {
  const makeTab = (title: string) => ({ id: crypto.randomUUID(), title, ptyId: null })
  const tab1 = makeTab('Terminal 1')
  const tab2 = makeTab('Terminal 1')
  useTerminalStore.setState({
    primary: { tabs: [tab1], activeTabId: tab1.id },
    secondary: { tabs: [tab2], activeTabId: tab2.id },
    splitEnabled: false,
  })
}

describe('terminalStore — プライマリペイン', () => {
  beforeEach(resetStore)

  it('初期状態: primary に1タブ、secondary に1タブ', () => {
    const { primary, secondary } = useTerminalStore.getState()
    expect(primary.tabs).toHaveLength(1)
    expect(secondary.tabs).toHaveLength(1)
  })

  it('addTab("primary") でプライマリにタブが追加される', () => {
    useTerminalStore.getState().addTab('primary')
    expect(useTerminalStore.getState().primary.tabs).toHaveLength(2)
    expect(useTerminalStore.getState().secondary.tabs).toHaveLength(1)
  })

  it('addTab("primary") で追加したタブがプライマリのアクティブになる', () => {
    useTerminalStore.getState().addTab('primary')
    const { primary } = useTerminalStore.getState()
    expect(primary.activeTabId).toBe(primary.tabs[1].id)
  })

  it('プライマリのタブが1つの時 closeTab は何もしない', () => {
    const { primary } = useTerminalStore.getState()
    useTerminalStore.getState().closeTab(primary.tabs[0].id, 'primary')
    expect(useTerminalStore.getState().primary.tabs).toHaveLength(1)
  })

  it('closeTab でアクティブタブを閉じると残ったタブがアクティブになる', () => {
    useTerminalStore.getState().addTab('primary')
    const { primary } = useTerminalStore.getState()
    const [tab0, tab1] = primary.tabs
    useTerminalStore.getState().setActiveTab(tab0.id, 'primary')
    useTerminalStore.getState().closeTab(tab0.id, 'primary')
    expect(useTerminalStore.getState().primary.activeTabId).toBe(tab1.id)
  })
})

describe('terminalStore — セカンダリペイン', () => {
  beforeEach(resetStore)

  it('addTab("secondary") でセカンダリにタブが追加される', () => {
    useTerminalStore.getState().addTab('secondary')
    expect(useTerminalStore.getState().secondary.tabs).toHaveLength(2)
    expect(useTerminalStore.getState().primary.tabs).toHaveLength(1)
  })

  it('addTab("secondary") で追加したタブがセカンダリのアクティブになる', () => {
    useTerminalStore.getState().addTab('secondary')
    const { secondary } = useTerminalStore.getState()
    expect(secondary.activeTabId).toBe(secondary.tabs[1].id)
  })
})

describe('terminalStore — setPtyId', () => {
  beforeEach(resetStore)

  it('プライマリのタブに ptyId が設定される', () => {
    const { primary } = useTerminalStore.getState()
    useTerminalStore.getState().setPtyId(primary.tabs[0].id, 'pty-abc')
    expect(useTerminalStore.getState().primary.tabs[0].ptyId).toBe('pty-abc')
  })

  it('セカンダリのタブに ptyId が設定される', () => {
    const { secondary } = useTerminalStore.getState()
    useTerminalStore.getState().setPtyId(secondary.tabs[0].id, 'pty-xyz')
    expect(useTerminalStore.getState().secondary.tabs[0].ptyId).toBe('pty-xyz')
  })

  it('setPtyId はプライマリ・セカンダリをまたいで正しいタブを更新する', () => {
    const { primary, secondary } = useTerminalStore.getState()
    useTerminalStore.getState().setPtyId(primary.tabs[0].id, 'pty-primary')
    useTerminalStore.getState().setPtyId(secondary.tabs[0].id, 'pty-secondary')
    expect(useTerminalStore.getState().primary.tabs[0].ptyId).toBe('pty-primary')
    expect(useTerminalStore.getState().secondary.tabs[0].ptyId).toBe('pty-secondary')
  })
})

describe('terminalStore — 分割', () => {
  beforeEach(resetStore)

  it('初期状態は splitEnabled=false', () => {
    expect(useTerminalStore.getState().splitEnabled).toBe(false)
  })

  it('toggleSplit で splitEnabled が true になる', () => {
    useTerminalStore.getState().toggleSplit()
    expect(useTerminalStore.getState().splitEnabled).toBe(true)
  })

  it('toggleSplit を2回呼ぶと false に戻る', () => {
    useTerminalStore.getState().toggleSplit()
    useTerminalStore.getState().toggleSplit()
    expect(useTerminalStore.getState().splitEnabled).toBe(false)
  })
})
