import { describe, it, expect, beforeEach } from 'vitest'
import { useContentStore } from './contentStore'

function resetStore() {
  const makeTab = () => ({ id: crypto.randomUUID(), filePath: null, content: null, viewMode: 'plain' as const, isLoading: false, scrollTop: 0 })
  const p = makeTab()
  const s = makeTab()
  useContentStore.setState({
    primary: { tabs: [p], activeTabId: p.id },
    secondary: { tabs: [s], activeTabId: s.id },
    splitEnabled: false,
    focusedPane: 'primary',
  })
}

describe('contentStore — openFile', () => {
  beforeEach(resetStore)

  it('空タブがある場合はそのタブを再利用して新規タブを作らない（VS Code スタイル）', () => {
    useContentStore.getState().openFile('/path/to/file.md')
    expect(useContentStore.getState().primary.tabs).toHaveLength(1)
    expect(useContentStore.getState().primary.tabs[0].filePath).toBe('/path/to/file.md')
  })

  it('空タブ再利用後、同じタブがアクティブのまま', () => {
    const { primary } = useContentStore.getState()
    const originalId = primary.activeTabId
    useContentStore.getState().openFile('/path/to/file.md')
    expect(useContentStore.getState().primary.activeTabId).toBe(originalId)
  })

  it('タブがすでに埋まっている場合は新規タブを追加する', () => {
    useContentStore.getState().openFile('/file-a.md')
    useContentStore.getState().openFile('/file-b.md')
    expect(useContentStore.getState().primary.tabs).toHaveLength(2)
  })

  it('同じファイルを再度 openFile するとタブが重複せずアクティブになる', () => {
    useContentStore.getState().openFile('/file-a.md')
    useContentStore.getState().openFile('/file-b.md')
    useContentStore.getState().openFile('/file-a.md')
    const { primary } = useContentStore.getState()
    expect(primary.tabs).toHaveLength(2)
    const activeTab = primary.tabs.find((t) => t.id === primary.activeTabId)
    expect(activeTab?.filePath).toBe('/file-a.md')
  })

  it('pane 未指定の場合は focusedPane（primary）に開く', () => {
    useContentStore.getState().openFile('/focused.md')
    expect(useContentStore.getState().primary.tabs.some((t) => t.filePath === '/focused.md')).toBe(true)
  })

  it('pane="secondary" を指定するとセカンダリに開く', () => {
    useContentStore.getState().openFile('/secondary.md', 'secondary')
    expect(useContentStore.getState().secondary.tabs.some((t) => t.filePath === '/secondary.md')).toBe(true)
    expect(useContentStore.getState().primary.tabs.every((t) => t.filePath !== '/secondary.md')).toBe(true)
  })

  it('focusedPane が secondary の時、pane 未指定だとセカンダリに開く', () => {
    useContentStore.getState().setFocusedPane('secondary')
    useContentStore.getState().openFile('/in-secondary.md')
    expect(useContentStore.getState().secondary.tabs.some((t) => t.filePath === '/in-secondary.md')).toBe(true)
  })

  it('openFile すると focusedPane がターゲットペインに更新される', () => {
    useContentStore.getState().openFile('/file.md', 'secondary')
    expect(useContentStore.getState().focusedPane).toBe('secondary')
  })
})

describe('contentStore — closeTab', () => {
  beforeEach(resetStore)

  it('タブが1枚の時 closeTab すると空タブに置き換わる（タブが消えない）', () => {
    useContentStore.getState().openFile('/only.md')
    const { primary } = useContentStore.getState()
    useContentStore.getState().closeTab(primary.tabs[0].id, 'primary')
    const after = useContentStore.getState().primary
    expect(after.tabs).toHaveLength(1)
    expect(after.tabs[0].filePath).toBeNull()
  })

  it('複数タブがある時 closeTab でタブが減る', () => {
    useContentStore.getState().openFile('/file-a.md')
    useContentStore.getState().openFile('/file-b.md')
    const { primary } = useContentStore.getState()
    useContentStore.getState().closeTab(primary.tabs[0].id, 'primary')
    expect(useContentStore.getState().primary.tabs).toHaveLength(1)
  })

  it('アクティブタブを閉じると残ったタブがアクティブになる', () => {
    useContentStore.getState().openFile('/file-a.md')
    useContentStore.getState().openFile('/file-b.md')
    const { primary } = useContentStore.getState()
    const lastTab = primary.tabs[primary.tabs.length - 1]
    useContentStore.getState().closeTab(lastTab.id, 'primary')
    const after = useContentStore.getState().primary
    expect(after.activeTabId).not.toBe(lastTab.id)
  })
})

describe('contentStore — bulk close', () => {
  beforeEach(resetStore)

  it('closeAllTabs: ペイン内タブを空タブ1枚にリセットする', () => {
    useContentStore.getState().openFile('/a.md')
    useContentStore.getState().openFile('/b.md')
    useContentStore.getState().openFile('/c.md')
    useContentStore.getState().closeAllTabs('primary')
    const { tabs } = useContentStore.getState().primary
    expect(tabs).toHaveLength(1)
    expect(tabs[0].filePath).toBeNull()
  })

  it('closeAllTabs: もう片方のペインのタブには影響しない', () => {
    useContentStore.getState().openFile('/a.md', 'primary')
    useContentStore.getState().openFile('/x.md', 'secondary')
    useContentStore.getState().openFile('/y.md', 'secondary')
    useContentStore.getState().closeAllTabs('primary')
    expect(useContentStore.getState().secondary.tabs).toHaveLength(2)
  })

  it('closeOtherTabs: 基準タブのみを残しアクティブにする', () => {
    useContentStore.getState().openFile('/a.md')
    useContentStore.getState().openFile('/b.md')
    useContentStore.getState().openFile('/c.md')
    const target = useContentStore.getState().primary.tabs[1] // /b.md
    useContentStore.getState().closeOtherTabs(target.id, 'primary')
    const { tabs, activeTabId } = useContentStore.getState().primary
    expect(tabs).toHaveLength(1)
    expect(tabs[0].filePath).toBe('/b.md')
    expect(activeTabId).toBe(target.id)
  })

  it('closeOtherTabs: タブが1枚のときは no-op', () => {
    useContentStore.getState().openFile('/a.md')
    const target = useContentStore.getState().primary.tabs[0]
    const before = useContentStore.getState().primary
    useContentStore.getState().closeOtherTabs(target.id, 'primary')
    expect(useContentStore.getState().primary).toBe(before)
  })

  it('closeTabsToRight: 基準より右のタブを削除する', () => {
    useContentStore.getState().openFile('/a.md')
    useContentStore.getState().openFile('/b.md')
    useContentStore.getState().openFile('/c.md')
    useContentStore.getState().openFile('/d.md')
    const target = useContentStore.getState().primary.tabs[1] // /b.md
    useContentStore.getState().closeTabsToRight(target.id, 'primary')
    const { tabs, activeTabId } = useContentStore.getState().primary
    expect(tabs.map((t) => t.filePath)).toEqual(['/a.md', '/b.md'])
    // /d.md がアクティブだったため、基準タブ /b.md にフォールバック
    expect(activeTabId).toBe(target.id)
  })

  it('closeTabsToRight: 基準タブ左側のアクティブはそのまま維持', () => {
    useContentStore.getState().openFile('/a.md')
    useContentStore.getState().openFile('/b.md')
    useContentStore.getState().openFile('/c.md')
    const tabs = useContentStore.getState().primary.tabs
    const leftTab = tabs[0] // /a.md
    useContentStore.getState().setActiveTab(leftTab.id, 'primary')
    const baseTab = tabs[1] // /b.md
    useContentStore.getState().closeTabsToRight(baseTab.id, 'primary')
    expect(useContentStore.getState().primary.activeTabId).toBe(leftTab.id)
  })

  it('closeTabsToRight: 基準が最右端なら no-op', () => {
    useContentStore.getState().openFile('/a.md')
    useContentStore.getState().openFile('/b.md')
    const tabs = useContentStore.getState().primary.tabs
    const target = tabs[tabs.length - 1]
    const before = useContentStore.getState().primary
    useContentStore.getState().closeTabsToRight(target.id, 'primary')
    expect(useContentStore.getState().primary).toBe(before)
  })
})

describe('contentStore — 分割', () => {
  beforeEach(resetStore)

  it('初期状態は splitEnabled=false', () => {
    expect(useContentStore.getState().splitEnabled).toBe(false)
  })

  it('toggleSplit で splitEnabled が true になる', () => {
    useContentStore.getState().toggleSplit()
    expect(useContentStore.getState().splitEnabled).toBe(true)
  })

  it('toggleSplit を2回呼ぶと false に戻る', () => {
    useContentStore.getState().toggleSplit()
    useContentStore.getState().toggleSplit()
    expect(useContentStore.getState().splitEnabled).toBe(false)
  })

  it('toggleSplit 時に focusedPane が primary にリセットされる', () => {
    useContentStore.getState().setFocusedPane('secondary')
    useContentStore.getState().toggleSplit()
    expect(useContentStore.getState().focusedPane).toBe('primary')
  })
})

describe('contentStore — setTabContent / setTabLoading', () => {
  beforeEach(resetStore)

  it('setTabContent でプライマリのタブが更新される', () => {
    useContentStore.getState().openFile('/file.md')
    const { primary } = useContentStore.getState()
    const tabId = primary.activeTabId
    useContentStore.getState().setTabContent(tabId, '/file.md', '# Hello', 'markdown')
    const tab = useContentStore.getState().primary.tabs.find((t) => t.id === tabId)
    expect(tab?.content).toBe('# Hello')
    expect(tab?.viewMode).toBe('markdown')
    expect(tab?.isLoading).toBe(false)
  })

  it('setTabContent はセカンダリのタブにも適用できる', () => {
    useContentStore.getState().openFile('/secondary.md', 'secondary')
    const { secondary } = useContentStore.getState()
    const tabId = secondary.activeTabId
    useContentStore.getState().setTabContent(tabId, '/secondary.md', '# World', 'markdown')
    const tab = useContentStore.getState().secondary.tabs.find((t) => t.id === tabId)
    expect(tab?.content).toBe('# World')
  })

  it('setTabLoading でローディング状態を切り替えられる', () => {
    useContentStore.getState().openFile('/file.md')
    const { primary } = useContentStore.getState()
    const tabId = primary.activeTabId
    useContentStore.getState().setTabLoading(tabId, true)
    expect(useContentStore.getState().primary.tabs.find((t) => t.id === tabId)?.isLoading).toBe(true)
    useContentStore.getState().setTabLoading(tabId, false)
    expect(useContentStore.getState().primary.tabs.find((t) => t.id === tabId)?.isLoading).toBe(false)
  })
})
