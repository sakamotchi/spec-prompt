import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { ContentView } from './ContentView'
import { useContentStore } from '../../stores/contentStore'

const invokeMock = vi.fn().mockResolvedValue('')
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
  convertFileSrc: (path: string) => `asset://localhost/${path}`,
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
    scrollTop: 0,
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
  beforeEach(() => {
    resetStore()
    invokeMock.mockClear()
  })

  it('ファイル未選択時に content.empty キーの文字列を表示する', () => {
    const tabId = useContentStore.getState().primary.activeTabId
    const { getByText } = render(<ContentView tabId={tabId} />)
    expect(getByText('content.empty')).toBeTruthy()
  })

  it('画像モードでは read_file を呼ばずに ImageViewer が <img> を描画する', async () => {
    const tabId = useContentStore.getState().primary.activeTabId!
    useContentStore.setState((s) => ({
      primary: {
        ...s.primary,
        tabs: s.primary.tabs.map((t) =>
          t.id === tabId ? { ...t, filePath: '/tmp/photo.png', content: null } : t
        ),
      },
    }))
    const { container } = render(<ContentView tabId={tabId} />)
    const img = await waitFor(() => {
      const el = container.querySelector('img')
      if (!el) throw new Error('img not yet rendered')
      return el
    })
    expect(img.getAttribute('src')).toBe('asset://localhost//tmp/photo.png')
    expect(invokeMock).not.toHaveBeenCalled()
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
