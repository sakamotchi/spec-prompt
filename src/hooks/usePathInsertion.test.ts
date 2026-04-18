import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePathInsertion } from './usePathInsertion'
import { useAppStore } from '../stores/appStore'
import { useTerminalStore } from '../stores/terminalStore'
import { usePromptPaletteStore } from '../stores/promptPaletteStore'

const writePtyMock = vi.fn<(id: string, data: string) => Promise<void>>()

vi.mock('../lib/tauriApi', () => ({
  tauriApi: {
    writePty: (id: string, data: string) => writePtyMock(id, data),
  },
}))

function resetPromptPalette() {
  usePromptPaletteStore.setState({
    isOpen: false,
    targetPtyId: null,
    targetTabName: null,
    drafts: {},
    textareaRef: null,
  })
}

function seedTerminal(ptyId: string | null) {
  const state = useTerminalStore.getState()
  const nextPrimary = {
    ...state.primary,
    tabs: state.primary.tabs.map((t, i) =>
      i === 0 ? { ...t, ptyId } : t,
    ),
  }
  useTerminalStore.setState({
    primary: { ...nextPrimary, activeTabId: nextPrimary.tabs[0].id },
  })
}

describe('usePathInsertion ディスパッチ', () => {
  beforeEach(() => {
    writePtyMock.mockReset().mockResolvedValue(undefined)
    resetPromptPalette()
    useAppStore.setState({ projectRoot: '/proj', pathFormat: 'relative' })
    seedTerminal('pty-1')
  })

  it('パレット閉時は writePty が呼ばれ、insertAtCaret は呼ばれない', () => {
    const insertAtCaret = vi.fn()
    usePromptPaletteStore.setState({ insertAtCaret })

    const { result } = renderHook(() => usePathInsertion())
    act(() => result.current.insertPath('/proj/foo.md'))

    expect(writePtyMock).toHaveBeenCalledWith('pty-1', 'foo.md ')
    expect(insertAtCaret).not.toHaveBeenCalled()
  })

  it('パレット開かつ targetPtyId あり時は insertAtCaret が呼ばれ、writePty は呼ばれない', () => {
    const insertAtCaret = vi.fn()
    usePromptPaletteStore.setState({
      isOpen: true,
      targetPtyId: 'pty-1',
      targetTabName: 'zsh',
      insertAtCaret,
    })

    const { result } = renderHook(() => usePathInsertion())
    act(() => result.current.insertPath('/proj/foo.md'))

    expect(insertAtCaret).toHaveBeenCalledWith('foo.md ')
    expect(writePtyMock).not.toHaveBeenCalled()
  })

  it('複数パスはスペース区切り + 末尾スペースで挿入される', () => {
    const insertAtCaret = vi.fn()
    usePromptPaletteStore.setState({
      isOpen: true,
      targetPtyId: 'pty-1',
      targetTabName: 'zsh',
      insertAtCaret,
    })

    const { result } = renderHook(() => usePathInsertion())
    act(() => result.current.insertPath(['/proj/a.md', '/proj/b.md']))

    expect(insertAtCaret).toHaveBeenCalledWith('a.md b.md ')
  })

  it('パレット閉かつアクティブタブに ptyId が無ければ何もしない', () => {
    seedTerminal(null)
    const insertAtCaret = vi.fn()
    usePromptPaletteStore.setState({ insertAtCaret })

    const { result } = renderHook(() => usePathInsertion())
    act(() => result.current.insertPath('/proj/foo.md'))

    expect(writePtyMock).not.toHaveBeenCalled()
    expect(insertAtCaret).not.toHaveBeenCalled()
  })

  it('pathFormat=absolute のときは絶対パスがそのまま渡る', () => {
    useAppStore.setState({ projectRoot: '/proj', pathFormat: 'absolute' })
    const insertAtCaret = vi.fn()
    usePromptPaletteStore.setState({
      isOpen: true,
      targetPtyId: 'pty-1',
      targetTabName: 'zsh',
      insertAtCaret,
    })

    const { result } = renderHook(() => usePathInsertion())
    act(() => result.current.insertPath('/proj/foo.md'))

    expect(insertAtCaret).toHaveBeenCalledWith('/proj/foo.md ')
  })
})
