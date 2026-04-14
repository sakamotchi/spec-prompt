import { describe, it, expect, beforeEach } from 'vitest'
import {
  useTerminalStore,
  sanitizeTitle,
  computeDisplayTitle,
  type TerminalTab,
} from './terminalStore'

function makeTab(fallbackTitle: string): TerminalTab {
  return {
    id: crypto.randomUUID(),
    ptyId: null,
    fallbackTitle,
    oscTitle: null,
    manualTitle: null,
    pinned: false,
    hasUnreadNotification: false,
  }
}

function resetStore() {
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

describe('sanitizeTitle', () => {
  it('前後の空白を除去する', () => {
    expect(sanitizeTitle('  hello  ')).toBe('hello')
  })

  it('C0 制御文字 (0x00-0x1F) を除去する', () => {
    expect(sanitizeTitle('a\x00b\x1Fc')).toBe('abc')
  })

  it('DEL (0x7F) を除去する', () => {
    expect(sanitizeTitle('ab\x7Fcd')).toBe('abcd')
  })

  it('空白のみの文字列は null を返す', () => {
    expect(sanitizeTitle('   \t')).toBeNull()
  })

  it('null / undefined を null として扱う', () => {
    expect(sanitizeTitle(null)).toBeNull()
    expect(sanitizeTitle(undefined)).toBeNull()
  })

  it('日本語を保持する', () => {
    expect(sanitizeTitle('作業中')).toBe('作業中')
  })
})

describe('computeDisplayTitle', () => {
  const baseTab = (overrides: Partial<TerminalTab> = {}): TerminalTab => ({
    id: '1',
    ptyId: null,
    fallbackTitle: 'Terminal 1',
    oscTitle: null,
    manualTitle: null,
    pinned: false,
    hasUnreadNotification: false,
    ...overrides,
  })

  it('oscTitle が null のときは fallbackTitle を返す', () => {
    expect(computeDisplayTitle(baseTab())).toBe('Terminal 1')
  })

  it('oscTitle を優先して返す', () => {
    expect(computeDisplayTitle(baseTab({ oscTitle: 'vim foo.ts' }))).toBe('vim foo.ts')
  })

  it('pinned + manualTitle が最優先される', () => {
    expect(
      computeDisplayTitle(
        baseTab({ oscTitle: 'vim', manualTitle: 'watcher', pinned: true }),
      ),
    ).toBe('watcher')
  })

  it('pinned=false のときは manualTitle が無視され oscTitle が使われる', () => {
    expect(
      computeDisplayTitle(
        baseTab({ oscTitle: 'vim', manualTitle: 'watcher', pinned: false }),
      ),
    ).toBe('vim')
  })

  it('pinned=true でも manualTitle が null なら oscTitle/fallbackTitle にフォールバック', () => {
    expect(
      computeDisplayTitle(
        baseTab({ oscTitle: 'vim', manualTitle: null, pinned: true }),
      ),
    ).toBe('vim')
    expect(
      computeDisplayTitle(baseTab({ oscTitle: null, manualTitle: null, pinned: true })),
    ).toBe('Terminal 1')
  })
})

describe('setOscTitle', () => {
  beforeEach(resetStore)

  it('該当 ptyId のタブに oscTitle が設定される', () => {
    const { primary } = useTerminalStore.getState()
    useTerminalStore.getState().setPtyId(primary.tabs[0].id, 'pty-0')
    useTerminalStore.getState().setOscTitle('pty-0', 'hello')
    expect(useTerminalStore.getState().primary.tabs[0].oscTitle).toBe('hello')
  })

  it('空文字を受けるとフォールバック（null）に戻る', () => {
    const { primary } = useTerminalStore.getState()
    useTerminalStore.getState().setPtyId(primary.tabs[0].id, 'pty-0')
    useTerminalStore.getState().setOscTitle('pty-0', 'hello')
    useTerminalStore.getState().setOscTitle('pty-0', '')
    expect(useTerminalStore.getState().primary.tabs[0].oscTitle).toBeNull()
  })

  it('制御文字を含む文字列はサニタイズされる', () => {
    const { primary } = useTerminalStore.getState()
    useTerminalStore.getState().setPtyId(primary.tabs[0].id, 'pty-0')
    useTerminalStore.getState().setOscTitle('pty-0', 'ab\x01cd')
    expect(useTerminalStore.getState().primary.tabs[0].oscTitle).toBe('abcd')
  })

  it('未知の ptyId では何も更新されない', () => {
    useTerminalStore.getState().setOscTitle('unknown-pty', 'x')
    const { primary, secondary } = useTerminalStore.getState()
    expect(primary.tabs.every((t) => t.oscTitle === null)).toBe(true)
    expect(secondary.tabs.every((t) => t.oscTitle === null)).toBe(true)
  })

  it('同一値の連続更新では state 参照が変化しない', () => {
    const { primary } = useTerminalStore.getState()
    useTerminalStore.getState().setPtyId(primary.tabs[0].id, 'pty-0')
    useTerminalStore.getState().setOscTitle('pty-0', 'same')
    const stateA = useTerminalStore.getState()
    useTerminalStore.getState().setOscTitle('pty-0', 'same')
    const stateB = useTerminalStore.getState()
    // 同一値なら参照同じ（setOscTitle 内で早期 return するため）
    expect(stateA.primary).toBe(stateB.primary)
    expect(stateA.secondary).toBe(stateB.secondary)
  })

  it('ペインをまたいで正しいタブを特定する', () => {
    const { primary, secondary } = useTerminalStore.getState()
    useTerminalStore.getState().setPtyId(primary.tabs[0].id, 'pty-p')
    useTerminalStore.getState().setPtyId(secondary.tabs[0].id, 'pty-s')
    useTerminalStore.getState().setOscTitle('pty-s', 'secondary-title')
    expect(useTerminalStore.getState().primary.tabs[0].oscTitle).toBeNull()
    expect(useTerminalStore.getState().secondary.tabs[0].oscTitle).toBe('secondary-title')
  })
})

describe('renameTab', () => {
  beforeEach(resetStore)

  it('pinned=true / manualTitle=<trimmed> が設定される', () => {
    const { primary } = useTerminalStore.getState()
    useTerminalStore.getState().renameTab(primary.tabs[0].id, '  watcher  ')
    const tab = useTerminalStore.getState().primary.tabs[0]
    expect(tab.pinned).toBe(true)
    expect(tab.manualTitle).toBe('watcher')
  })

  it('空文字では何も変更しない（呼び出し側で unpinTab に振り分ける想定）', () => {
    const { primary } = useTerminalStore.getState()
    useTerminalStore.getState().renameTab(primary.tabs[0].id, '   ')
    const tab = useTerminalStore.getState().primary.tabs[0]
    expect(tab.pinned).toBe(false)
    expect(tab.manualTitle).toBeNull()
  })

  it('同一値の連続リネームでは state 参照が変化しない', () => {
    const { primary } = useTerminalStore.getState()
    const tabId = primary.tabs[0].id
    useTerminalStore.getState().renameTab(tabId, 'watcher')
    const stateA = useTerminalStore.getState()
    useTerminalStore.getState().renameTab(tabId, 'watcher')
    const stateB = useTerminalStore.getState()
    expect(stateA.primary).toBe(stateB.primary)
    expect(stateA.secondary).toBe(stateB.secondary)
  })

  it('未知の tabId では何も更新されない', () => {
    useTerminalStore.getState().renameTab('unknown-id', 'x')
    const { primary, secondary } = useTerminalStore.getState()
    expect(primary.tabs.every((t) => !t.pinned && t.manualTitle === null)).toBe(true)
    expect(secondary.tabs.every((t) => !t.pinned && t.manualTitle === null)).toBe(true)
  })
})

describe('unpinTab', () => {
  beforeEach(resetStore)

  it('pinned=false / manualTitle=null に戻る', () => {
    const { primary } = useTerminalStore.getState()
    const tabId = primary.tabs[0].id
    useTerminalStore.getState().renameTab(tabId, 'watcher')
    useTerminalStore.getState().unpinTab(tabId)
    const tab = useTerminalStore.getState().primary.tabs[0]
    expect(tab.pinned).toBe(false)
    expect(tab.manualTitle).toBeNull()
  })

  it('もともと unpin のタブでは state 参照が変化しない', () => {
    const { primary } = useTerminalStore.getState()
    const tabId = primary.tabs[0].id
    const stateA = useTerminalStore.getState()
    useTerminalStore.getState().unpinTab(tabId)
    const stateB = useTerminalStore.getState()
    expect(stateA.primary).toBe(stateB.primary)
    expect(stateA.secondary).toBe(stateB.secondary)
  })
})

describe('markUnread / clearUnread', () => {
  beforeEach(resetStore)

  it('非アクティブタブに hasUnreadNotification=true がセットされる', () => {
    const { primary } = useTerminalStore.getState()
    const tabId = primary.tabs[0].id
    useTerminalStore.getState().setPtyId(tabId, 'pty-0')
    // 新規タブを追加してそちらをアクティブに → tab 1 は非アクティブ
    useTerminalStore.getState().addTab('primary')
    useTerminalStore.getState().markUnread('pty-0')
    expect(useTerminalStore.getState().primary.tabs[0].hasUnreadNotification).toBe(true)
  })

  it('アクティブ + document.hasFocus()=true のタブでは no-op', () => {
    const { primary } = useTerminalStore.getState()
    const tabId = primary.tabs[0].id
    useTerminalStore.getState().setPtyId(tabId, 'pty-0')
    // document.hasFocus を明示的に true にする
    const originalHasFocus = document.hasFocus
    document.hasFocus = () => true
    try {
      useTerminalStore.getState().markUnread('pty-0')
      expect(useTerminalStore.getState().primary.tabs[0].hasUnreadNotification).toBe(false)
    } finally {
      document.hasFocus = originalHasFocus
    }
  })

  it('アクティブ + document.hasFocus()=false のタブでは mark される', () => {
    const { primary } = useTerminalStore.getState()
    const tabId = primary.tabs[0].id
    useTerminalStore.getState().setPtyId(tabId, 'pty-0')
    const originalHasFocus = document.hasFocus
    document.hasFocus = () => false
    try {
      useTerminalStore.getState().markUnread('pty-0')
      expect(useTerminalStore.getState().primary.tabs[0].hasUnreadNotification).toBe(true)
    } finally {
      document.hasFocus = originalHasFocus
    }
  })

  it('未知の pty_id では何も更新されない', () => {
    useTerminalStore.getState().markUnread('unknown')
    const { primary, secondary } = useTerminalStore.getState()
    expect(primary.tabs.every((t) => !t.hasUnreadNotification)).toBe(true)
    expect(secondary.tabs.every((t) => !t.hasUnreadNotification)).toBe(true)
  })

  it('連続 markUnread で state 参照が変化しない', () => {
    const { primary } = useTerminalStore.getState()
    const tabId = primary.tabs[0].id
    useTerminalStore.getState().setPtyId(tabId, 'pty-0')
    useTerminalStore.getState().addTab('primary')
    useTerminalStore.getState().markUnread('pty-0')
    const stateA = useTerminalStore.getState()
    useTerminalStore.getState().markUnread('pty-0')
    const stateB = useTerminalStore.getState()
    expect(stateA.primary).toBe(stateB.primary)
  })

  it('clearUnread で hasUnreadNotification が false に戻る', () => {
    const { primary } = useTerminalStore.getState()
    const tabId = primary.tabs[0].id
    useTerminalStore.getState().setPtyId(tabId, 'pty-0')
    useTerminalStore.getState().addTab('primary')
    useTerminalStore.getState().markUnread('pty-0')
    useTerminalStore.getState().clearUnread(tabId)
    expect(useTerminalStore.getState().primary.tabs[0].hasUnreadNotification).toBe(false)
  })

  it('もともと unread=false のタブへの clearUnread では state 参照が変化しない', () => {
    const { primary } = useTerminalStore.getState()
    const tabId = primary.tabs[0].id
    const stateA = useTerminalStore.getState()
    useTerminalStore.getState().clearUnread(tabId)
    const stateB = useTerminalStore.getState()
    expect(stateA.primary).toBe(stateB.primary)
  })
})

describe('pinned と OSC 更新の共存', () => {
  beforeEach(resetStore)

  it('pinned タブへの OSC 更新は oscTitle に記録されるが表示は manualTitle が優先', () => {
    const { primary } = useTerminalStore.getState()
    const tabId = primary.tabs[0].id
    useTerminalStore.getState().setPtyId(tabId, 'pty-0')
    useTerminalStore.getState().renameTab(tabId, 'watcher')
    useTerminalStore.getState().setOscTitle('pty-0', 'vim foo.ts')
    const tab = useTerminalStore.getState().primary.tabs[0]
    expect(tab.oscTitle).toBe('vim foo.ts')
    expect(computeDisplayTitle(tab)).toBe('watcher')
  })

  it('unpin 後は最新の oscTitle が即時表示される', () => {
    const { primary } = useTerminalStore.getState()
    const tabId = primary.tabs[0].id
    useTerminalStore.getState().setPtyId(tabId, 'pty-0')
    useTerminalStore.getState().renameTab(tabId, 'watcher')
    useTerminalStore.getState().setOscTitle('pty-0', 'vim foo.ts')
    useTerminalStore.getState().unpinTab(tabId)
    const tab = useTerminalStore.getState().primary.tabs[0]
    expect(computeDisplayTitle(tab)).toBe('vim foo.ts')
  })
})
