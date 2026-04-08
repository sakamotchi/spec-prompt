import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ContentView } from './ContentView'
import { useContentStore } from '../../stores/contentStore'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(''),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

function resetStore() {
  const makeTab = () => ({
    id: crypto.randomUUID(),
    filePath: null,
    content: null,
    viewMode: 'plain' as const,
    isLoading: false,
  })
  const p = makeTab()
  const s = makeTab()
  useContentStore.setState({
    primary: { tabs: [p], activeTabId: p.id },
    secondary: { tabs: [s], activeTabId: s.id },
    splitEnabled: false,
    focusedPane: 'primary',
  })
}

describe('ContentView', () => {
  beforeEach(resetStore)

  it('ファイル未選択時に content.empty キーの文字列を表示する', () => {
    const tabId = useContentStore.getState().primary.activeTabId
    const { getByText } = render(<ContentView tabId={tabId} />)
    expect(getByText('content.empty')).toBeTruthy()
  })

  it('isLoading=true のとき content.loading キーの文字列を表示する', () => {
    const tabId = useContentStore.getState().primary.activeTabId
    useContentStore.setState((s) => ({
      primary: {
        ...s.primary,
        tabs: s.primary.tabs.map((t) =>
          t.id === tabId ? { ...t, isLoading: true } : t
        ),
      },
    }))
    const { getByText } = render(<ContentView tabId={tabId} />)
    expect(getByText('content.loading')).toBeTruthy()
  })
})
