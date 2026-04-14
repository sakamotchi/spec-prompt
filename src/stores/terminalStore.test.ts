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
  it('oscTitle が null のときは fallbackTitle を返す', () => {
    const tab: TerminalTab = {
      id: '1',
      ptyId: null,
      fallbackTitle: 'Terminal 1',
      oscTitle: null,
    }
    expect(computeDisplayTitle(tab)).toBe('Terminal 1')
  })

  it('oscTitle を優先して返す', () => {
    const tab: TerminalTab = {
      id: '1',
      ptyId: 'p',
      fallbackTitle: 'Terminal 1',
      oscTitle: 'vim foo.ts',
    }
    expect(computeDisplayTitle(tab)).toBe('vim foo.ts')
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
