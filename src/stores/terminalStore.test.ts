import { describe, it, expect, beforeEach } from 'vitest'
import {
  useTerminalStore,
  sanitizeTitle,
  computeDisplayTitle,
  type TerminalTab,
} from './terminalStore'
import { usePromptPaletteStore } from './promptPaletteStore'

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

describe('terminalStore — bulk close', () => {
  beforeEach(resetStore)

  it('closeAllTabs: ペイン内タブを空タブ1枚に置き換える', () => {
    useTerminalStore.getState().addTab('primary')
    useTerminalStore.getState().addTab('primary')
    useTerminalStore.getState().closeAllTabs('primary')
    const { tabs } = useTerminalStore.getState().primary
    expect(tabs).toHaveLength(1)
    expect(tabs[0].ptyId).toBeNull()
  })

  it('closeAllTabs: もう片方のペインのタブには影響しない', () => {
    useTerminalStore.getState().addTab('secondary')
    useTerminalStore.getState().addTab('secondary')
    useTerminalStore.getState().closeAllTabs('primary')
    expect(useTerminalStore.getState().secondary.tabs).toHaveLength(3)
  })

  it('closeOtherTabs: 基準タブのみを残しアクティブにする', () => {
    useTerminalStore.getState().addTab('primary')
    useTerminalStore.getState().addTab('primary')
    const target = useTerminalStore.getState().primary.tabs[1]
    useTerminalStore.getState().closeOtherTabs(target.id, 'primary')
    const { tabs, activeTabId } = useTerminalStore.getState().primary
    expect(tabs).toHaveLength(1)
    expect(tabs[0].id).toBe(target.id)
    expect(activeTabId).toBe(target.id)
  })

  it('closeOtherTabs: タブが1枚のときは no-op', () => {
    const target = useTerminalStore.getState().primary.tabs[0]
    const before = useTerminalStore.getState().primary
    useTerminalStore.getState().closeOtherTabs(target.id, 'primary')
    expect(useTerminalStore.getState().primary).toBe(before)
  })

  it('closeTabsToRight: 基準より右のタブを削除する', () => {
    useTerminalStore.getState().addTab('primary')
    useTerminalStore.getState().addTab('primary')
    useTerminalStore.getState().addTab('primary')
    const tabs0 = useTerminalStore.getState().primary.tabs
    const target = tabs0[1]
    useTerminalStore.getState().closeTabsToRight(target.id, 'primary')
    const { tabs, activeTabId } = useTerminalStore.getState().primary
    expect(tabs).toHaveLength(2)
    expect(tabs.map((t) => t.id)).toEqual([tabs0[0].id, target.id])
    // 追加直後はアクティブが末尾 tab3 → 基準 target にフォールバック
    expect(activeTabId).toBe(target.id)
  })

  it('closeTabsToRight: 基準が最右端なら no-op', () => {
    useTerminalStore.getState().addTab('primary')
    const tabs = useTerminalStore.getState().primary.tabs
    const target = tabs[tabs.length - 1]
    const before = useTerminalStore.getState().primary
    useTerminalStore.getState().closeTabsToRight(target.id, 'primary')
    expect(useTerminalStore.getState().primary).toBe(before)
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

describe('プロンプト編集パレットとの連携（F3-1）', () => {
  beforeEach(() => {
    resetStore()
    usePromptPaletteStore.setState({
      isOpen: false,
      targetPtyId: null,
      targetTabName: null,
      drafts: {},
      textareaRef: null,
    })
  })

  function seedTwoTabsWithPty(): { tabAId: string; tabBId: string } {
    const tabA: TerminalTab = {
      ...makeTab('Terminal 1'),
      ptyId: 'pty-a',
    }
    const tabB: TerminalTab = {
      ...makeTab('Terminal 2'),
      ptyId: 'pty-b',
    }
    useTerminalStore.setState((s) => ({
      primary: { tabs: [tabA, tabB], activeTabId: tabA.id },
      secondary: s.secondary,
    }))
    return { tabAId: tabA.id, tabBId: tabB.id }
  }

  it('closeTab() で閉じたタブの下書きが破棄される（他タブの下書きは残る）', () => {
    const { tabAId } = seedTwoTabsWithPty()
    const palette = usePromptPaletteStore.getState()
    palette.setDraft('pty-a', 'A draft')
    palette.setDraft('pty-b', 'B draft')

    useTerminalStore.getState().closeTab(tabAId, 'primary')

    const drafts = usePromptPaletteStore.getState().drafts
    expect(drafts['pty-a']).toBeUndefined()
    expect(drafts['pty-b']).toBe('B draft')
  })

  it('closeTab() が targetPtyId のタブを閉じたらパレットが自動クローズされる', () => {
    const { tabAId } = seedTwoTabsWithPty()
    usePromptPaletteStore.getState().open('pty-a', 'Terminal 1')

    useTerminalStore.getState().closeTab(tabAId, 'primary')

    const s = usePromptPaletteStore.getState()
    expect(s.isOpen).toBe(false)
    expect(s.targetPtyId).toBeNull()
  })

  it('closeTab() が targetPtyId 以外を閉じたらパレットは閉じない', () => {
    const { tabBId } = seedTwoTabsWithPty()
    usePromptPaletteStore.getState().open('pty-a', 'Terminal 1')

    useTerminalStore.getState().closeTab(tabBId, 'primary')

    expect(usePromptPaletteStore.getState().isOpen).toBe(true)
    expect(usePromptPaletteStore.getState().targetPtyId).toBe('pty-a')
  })

  it('handlePtyExited() で該当 ptyId の下書きが破棄される', () => {
    seedTwoTabsWithPty()
    const palette = usePromptPaletteStore.getState()
    palette.setDraft('pty-a', 'A draft')
    palette.setDraft('pty-b', 'B draft')

    useTerminalStore.getState().handlePtyExited('pty-a')

    const drafts = usePromptPaletteStore.getState().drafts
    expect(drafts['pty-a']).toBeUndefined()
    expect(drafts['pty-b']).toBe('B draft')
  })

  it('closeActiveTab() でアクティブタブの下書きが破棄される', () => {
    seedTwoTabsWithPty()
    const palette = usePromptPaletteStore.getState()
    palette.setDraft('pty-a', 'A draft')
    palette.setDraft('pty-b', 'B draft')

    useTerminalStore.getState().closeActiveTab('primary')

    const drafts = usePromptPaletteStore.getState().drafts
    expect(drafts['pty-a']).toBeUndefined()
    expect(drafts['pty-b']).toBe('B draft')
  })

  it('closeAllTabs() で閉じる各 ptyId の下書きがすべて破棄される', () => {
    seedTwoTabsWithPty()
    const palette = usePromptPaletteStore.getState()
    palette.setDraft('pty-a', 'A draft')
    palette.setDraft('pty-b', 'B draft')

    useTerminalStore.getState().closeAllTabs('primary')

    const drafts = usePromptPaletteStore.getState().drafts
    expect(drafts['pty-a']).toBeUndefined()
    expect(drafts['pty-b']).toBeUndefined()
  })

  it('closeAllTabs() が targetPtyId のタブを閉じたらパレットが自動クローズされる', () => {
    seedTwoTabsWithPty()
    usePromptPaletteStore.getState().open('pty-a', 'Terminal 1')

    useTerminalStore.getState().closeAllTabs('primary')

    expect(usePromptPaletteStore.getState().isOpen).toBe(false)
  })

  it('closeOtherTabs() で閉じる他タブの下書きのみ破棄される', () => {
    const { tabAId } = seedTwoTabsWithPty()
    const palette = usePromptPaletteStore.getState()
    palette.setDraft('pty-a', 'A draft')
    palette.setDraft('pty-b', 'B draft')

    useTerminalStore.getState().closeOtherTabs(tabAId, 'primary')

    const drafts = usePromptPaletteStore.getState().drafts
    expect(drafts['pty-a']).toBe('A draft')
    expect(drafts['pty-b']).toBeUndefined()
  })

  it('closeTabsToRight() で右側タブの下書きのみ破棄される', () => {
    const tabA: TerminalTab = { ...makeTab('Terminal 1'), ptyId: 'pty-a' }
    const tabB: TerminalTab = { ...makeTab('Terminal 2'), ptyId: 'pty-b' }
    const tabC: TerminalTab = { ...makeTab('Terminal 3'), ptyId: 'pty-c' }
    useTerminalStore.setState((s) => ({
      primary: { tabs: [tabA, tabB, tabC], activeTabId: tabA.id },
      secondary: s.secondary,
    }))
    const palette = usePromptPaletteStore.getState()
    palette.setDraft('pty-a', 'A')
    palette.setDraft('pty-b', 'B')
    palette.setDraft('pty-c', 'C')

    useTerminalStore.getState().closeTabsToRight(tabA.id, 'primary')

    const drafts = usePromptPaletteStore.getState().drafts
    expect(drafts['pty-a']).toBe('A')
    expect(drafts['pty-b']).toBeUndefined()
    expect(drafts['pty-c']).toBeUndefined()
  })

  it('closeTab() で最後の 1 枚は閉じないため、下書き破棄も発生しない', () => {
    const tabA: TerminalTab = { ...makeTab('Terminal 1'), ptyId: 'pty-a' }
    useTerminalStore.setState((s) => ({
      primary: { tabs: [tabA], activeTabId: tabA.id },
      secondary: s.secondary,
    }))
    usePromptPaletteStore.getState().setDraft('pty-a', 'keep')

    useTerminalStore.getState().closeTab(tabA.id, 'primary')

    expect(usePromptPaletteStore.getState().drafts['pty-a']).toBe('keep')
  })
})

describe('findLocationByPtyId', () => {
  beforeEach(resetStore)

  it('primary ペインのタブを正しく逆引きする', () => {
    const state = useTerminalStore.getState()
    const tabId = state.primary.tabs[0].id
    state.setPtyId(tabId, 'pty-100')

    const result = useTerminalStore.getState().findLocationByPtyId('pty-100')
    expect(result).toEqual({ pane: 'primary', tabId })
  })

  it('secondary ペインのタブを正しく逆引きする', () => {
    const state = useTerminalStore.getState()
    const tabId = state.secondary.tabs[0].id
    state.setPtyId(tabId, 'pty-200')

    const result = useTerminalStore.getState().findLocationByPtyId('pty-200')
    expect(result).toEqual({ pane: 'secondary', tabId })
  })

  it('該当する pty_id がなければ null を返す', () => {
    expect(
      useTerminalStore.getState().findLocationByPtyId('pty-unknown'),
    ).toBeNull()
  })
})
