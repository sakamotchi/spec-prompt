import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PromptPalette } from './PromptPalette'
import { usePromptPaletteStore } from '../../stores/promptPaletteStore'

const writePtyMock = vi.fn<(id: string, data: string) => Promise<void>>()
const toastErrorMock = vi.fn<(message: string) => void>()

vi.mock('../../lib/tauriApi', () => ({
  tauriApi: {
    writePty: (id: string, data: string) => writePtyMock(id, data),
  },
}))

vi.mock('../Toast', () => ({
  toast: {
    error: (message: string) => toastErrorMock(message),
    success: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

function resetStore() {
  usePromptPaletteStore.setState({
    isOpen: false,
    targetPtyId: null,
    targetTabName: null,
    drafts: {},
  })
}

describe('PromptPalette', () => {
  beforeEach(() => {
    cleanup()
    resetStore()
    writePtyMock.mockReset()
    writePtyMock.mockResolvedValue(undefined)
    toastErrorMock.mockReset()
  })

  it('閉じているときは textarea を描画しない', () => {
    render(<PromptPalette />)
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('open() 後に drafts[ptyId] が初期値として textarea に入る', async () => {
    act(() => {
      usePromptPaletteStore.setState({
        isOpen: true,
        targetPtyId: 'pty-1',
        targetTabName: 'zsh',
        drafts: { 'pty-1': 'hello' },
      })
    })
    render(<PromptPalette />)
    const ta = (await screen.findByRole('textbox')) as HTMLTextAreaElement
    expect(ta.value).toBe('hello')
  })

  it('通常の Enter では writePty を呼ばない', async () => {
    act(() => {
      usePromptPaletteStore.setState({
        isOpen: true,
        targetPtyId: 'pty-1',
        targetTabName: 'zsh',
        drafts: { 'pty-1': 'line1' },
      })
    })
    render(<PromptPalette />)
    const ta = (await screen.findByRole('textbox')) as HTMLTextAreaElement
    fireEvent.keyDown(ta, { key: 'Enter', metaKey: false, ctrlKey: false })
    expect(writePtyMock).not.toHaveBeenCalled()
    expect(usePromptPaletteStore.getState().isOpen).toBe(true)
  })

  it('Cmd+Enter で writePty(ptyId, body + "\\n") が呼ばれクローズされる', async () => {
    act(() => {
      usePromptPaletteStore.setState({
        isOpen: true,
        targetPtyId: 'pty-1',
        targetTabName: 'zsh',
        drafts: { 'pty-1': 'echo hi' },
      })
    })
    render(<PromptPalette />)
    const ta = (await screen.findByRole('textbox')) as HTMLTextAreaElement
    await act(async () => {
      fireEvent.keyDown(ta, { key: 'Enter', metaKey: true })
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(writePtyMock).toHaveBeenCalledWith('pty-1', 'echo hi\n')
    expect(usePromptPaletteStore.getState().isOpen).toBe(false)
    expect(usePromptPaletteStore.getState().drafts['pty-1']).toBeUndefined()
  })

  it('Ctrl+Enter でも送信される', async () => {
    act(() => {
      usePromptPaletteStore.setState({
        isOpen: true,
        targetPtyId: 'pty-1',
        targetTabName: 'zsh',
        drafts: { 'pty-1': 'ls' },
      })
    })
    render(<PromptPalette />)
    const ta = (await screen.findByRole('textbox')) as HTMLTextAreaElement
    await act(async () => {
      fireEvent.keyDown(ta, { key: 'Enter', ctrlKey: true })
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(writePtyMock).toHaveBeenCalledWith('pty-1', 'ls\n')
  })

  it('IME 変換中（isComposing=true）の Cmd+Enter は送信しない', async () => {
    act(() => {
      usePromptPaletteStore.setState({
        isOpen: true,
        targetPtyId: 'pty-1',
        targetTabName: 'zsh',
        drafts: { 'pty-1': 'こんにちは' },
      })
    })
    render(<PromptPalette />)
    const ta = (await screen.findByRole('textbox')) as HTMLTextAreaElement
    fireEvent.keyDown(ta, { key: 'Enter', metaKey: true, isComposing: true })
    expect(writePtyMock).not.toHaveBeenCalled()
  })

  it('空本文で送信ボタンが disable、Cmd+Enter も no-op', async () => {
    act(() => {
      usePromptPaletteStore.setState({
        isOpen: true,
        targetPtyId: 'pty-1',
        targetTabName: 'zsh',
        drafts: { 'pty-1': '   \n  ' },
      })
    })
    render(<PromptPalette />)
    const btn = screen.getByRole('button', { name: 'promptPalette.button.submit' })
    expect(btn).toBeDisabled()
    const ta = (await screen.findByRole('textbox')) as HTMLTextAreaElement
    await act(async () => {
      fireEvent.keyDown(ta, { key: 'Enter', metaKey: true })
      await Promise.resolve()
    })
    expect(writePtyMock).not.toHaveBeenCalled()
  })

  it('キャンセルボタンでパレットが閉じ、ドラフトは保持される', async () => {
    act(() => {
      usePromptPaletteStore.setState({
        isOpen: true,
        targetPtyId: 'pty-1',
        targetTabName: 'zsh',
        drafts: { 'pty-1': 'keep me' },
      })
    })
    render(<PromptPalette />)
    const btn = screen.getByRole('button', { name: 'promptPalette.button.cancel' })
    await userEvent.click(btn)
    expect(usePromptPaletteStore.getState().isOpen).toBe(false)
    expect(usePromptPaletteStore.getState().drafts['pty-1']).toBe('keep me')
  })

  it('textarea への入力で drafts が更新される', async () => {
    act(() => {
      usePromptPaletteStore.setState({
        isOpen: true,
        targetPtyId: 'pty-1',
        targetTabName: 'zsh',
        drafts: {},
      })
    })
    render(<PromptPalette />)
    const ta = (await screen.findByRole('textbox')) as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: 'draft text' } })
    expect(usePromptPaletteStore.getState().drafts['pty-1']).toBe('draft text')
  })

  it('compositionstart 中の Cmd+Enter は送信しない（IME state ガード）', async () => {
    act(() => {
      usePromptPaletteStore.setState({
        isOpen: true,
        targetPtyId: 'pty-1',
        targetTabName: 'zsh',
        drafts: { 'pty-1': 'hello' },
      })
    })
    render(<PromptPalette />)
    const ta = (await screen.findByRole('textbox')) as HTMLTextAreaElement
    fireEvent.compositionStart(ta)
    await act(async () => {
      fireEvent.keyDown(ta, { key: 'Enter', metaKey: true })
      await Promise.resolve()
    })
    expect(writePtyMock).not.toHaveBeenCalled()
  })

  it('compositionend 後の Cmd+Enter は通常送信される（IME state 解除確認）', async () => {
    act(() => {
      usePromptPaletteStore.setState({
        isOpen: true,
        targetPtyId: 'pty-1',
        targetTabName: 'zsh',
        drafts: { 'pty-1': 'hello' },
      })
    })
    render(<PromptPalette />)
    const ta = (await screen.findByRole('textbox')) as HTMLTextAreaElement
    fireEvent.compositionStart(ta)
    fireEvent.compositionEnd(ta)
    await act(async () => {
      fireEvent.keyDown(ta, { key: 'Enter', metaKey: true })
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(writePtyMock).toHaveBeenCalledWith('pty-1', 'hello\n')
  })

  it('writePty が reject した場合、toast.error が呼ばれパレットと本文を維持する', async () => {
    writePtyMock.mockRejectedValueOnce(new Error('PTY not found'))
    act(() => {
      usePromptPaletteStore.setState({
        isOpen: true,
        targetPtyId: 'pty-1',
        targetTabName: 'zsh',
        drafts: { 'pty-1': 'echo hi' },
      })
    })
    render(<PromptPalette />)
    const ta = (await screen.findByRole('textbox')) as HTMLTextAreaElement
    await act(async () => {
      fireEvent.keyDown(ta, { key: 'Enter', metaKey: true })
      // rejected Promise の microtask を 2 回消化
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(toastErrorMock).toHaveBeenCalledTimes(1)
    expect(toastErrorMock.mock.calls[0][0]).toContain('promptPalette.error.sendFailed')
    expect(toastErrorMock.mock.calls[0][0]).toContain('PTY not found')
    const state = usePromptPaletteStore.getState()
    expect(state.isOpen).toBe(true)
    expect(state.drafts['pty-1']).toBe('echo hi')
  })
})
