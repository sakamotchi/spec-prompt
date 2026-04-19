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
  localStorage.removeItem('spec-prompt:prompt-palette')
  usePromptPaletteStore.setState({
    isOpen: false,
    targetPtyId: null,
    targetTabName: null,
    drafts: {},
    textareaRef: null,
    lastInsertAt: 0,
    history: [],
    templates: [],
    historyCursor: null,
    dropdown: 'none',
    editorState: null,
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

  // ---- Phase 2 追加 ----

  it('送信成功時に履歴へ追加される（末尾空白 trim 後の値）', async () => {
    act(() => {
      usePromptPaletteStore.setState({
        isOpen: true,
        targetPtyId: 'pty-1',
        targetTabName: 'zsh',
        drafts: { 'pty-1': 'echo persisted\n' },
      })
    })
    render(<PromptPalette />)
    const ta = (await screen.findByRole('textbox')) as HTMLTextAreaElement
    await act(async () => {
      fireEvent.keyDown(ta, { key: 'Enter', metaKey: true })
      await Promise.resolve()
      await Promise.resolve()
    })
    const history = usePromptPaletteStore.getState().history
    expect(history).toHaveLength(1)
    expect(history[0].body).toBe('echo persisted')
  })

  it('送信失敗時は履歴に追加されない', async () => {
    writePtyMock.mockRejectedValueOnce(new Error('boom'))
    act(() => {
      usePromptPaletteStore.setState({
        isOpen: true,
        targetPtyId: 'pty-1',
        targetTabName: 'zsh',
        drafts: { 'pty-1': 'should-not-record' },
      })
    })
    render(<PromptPalette />)
    const ta = (await screen.findByRole('textbox')) as HTMLTextAreaElement
    await act(async () => {
      fireEvent.keyDown(ta, { key: 'Enter', metaKey: true })
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(usePromptPaletteStore.getState().history).toHaveLength(0)
  })

  it('空 textarea での ↑ で直近履歴が流し込まれる', async () => {
    act(() => {
      usePromptPaletteStore.setState({
        isOpen: true,
        targetPtyId: 'pty-1',
        targetTabName: 'zsh',
        drafts: {},
      })
      usePromptPaletteStore.getState().pushHistory('last-prompt')
    })
    render(<PromptPalette />)
    const ta = (await screen.findByRole('textbox')) as HTMLTextAreaElement
    fireEvent.keyDown(ta, { key: 'ArrowUp' })
    expect(usePromptPaletteStore.getState().drafts['pty-1']).toBe('last-prompt')
  })

  it('Cmd+H で履歴ドロップダウンが開閉する', async () => {
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
    fireEvent.keyDown(ta, { key: 'h', metaKey: true })
    expect(usePromptPaletteStore.getState().dropdown).toBe('history')
    fireEvent.keyDown(ta, { key: 'h', metaKey: true })
    expect(usePromptPaletteStore.getState().dropdown).toBe('none')
  })

  it('Ctrl+H でも履歴ドロップダウンが開閉する', async () => {
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
    fireEvent.keyDown(ta, { key: 'h', ctrlKey: true })
    expect(usePromptPaletteStore.getState().dropdown).toBe('history')
  })

  it('ヘッダ履歴アイコンのクリックでドロップダウンが開く', async () => {
    act(() => {
      usePromptPaletteStore.setState({
        isOpen: true,
        targetPtyId: 'pty-1',
        targetTabName: 'zsh',
        drafts: {},
      })
    })
    render(<PromptPalette />)
    const btn = screen.getByLabelText('promptPalette.history.openHint')
    await userEvent.click(btn)
    expect(usePromptPaletteStore.getState().dropdown).toBe('history')
  })

  it('ドロップダウン表示中の Esc はパレット本体を閉じない（段階剥離）', async () => {
    act(() => {
      usePromptPaletteStore.setState({
        isOpen: true,
        targetPtyId: 'pty-1',
        targetTabName: 'zsh',
        drafts: {},
        dropdown: 'history',
      })
      usePromptPaletteStore.getState().pushHistory('a')
    })
    render(<PromptPalette />)
    // Radix Dialog.Content の onEscapeKeyDown は document の keydown を起点に発火する
    fireEvent.keyDown(document, { key: 'Escape' })
    const state = usePromptPaletteStore.getState()
    expect(state.isOpen).toBe(true)
  })

  it('ドロップダウンが閉じているときの Esc は従来どおりパレットを閉じる', async () => {
    act(() => {
      usePromptPaletteStore.setState({
        isOpen: true,
        targetPtyId: 'pty-1',
        targetTabName: 'zsh',
        drafts: {},
        dropdown: 'none',
      })
    })
    render(<PromptPalette />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(usePromptPaletteStore.getState().isOpen).toBe(false)
  })

  it('SlashSuggest で組み込みコマンドを選択すると draft が "/<name> " に置換される', async () => {
    act(() => {
      usePromptPaletteStore.setState({
        isOpen: true,
        targetPtyId: 'pty-1',
        targetTabName: 'zsh',
        drafts: { 'pty-1': '/res' },
      })
    })
    render(<PromptPalette />)
    const ta = (await screen.findByRole('textbox')) as HTMLTextAreaElement
    // /res のサジェストで resume が先頭（fuzzy + name 昇順で resume のみがマッチ）
    const root = document.querySelector('[data-palette-dropdown="slash"]') as HTMLElement
    fireEvent.keyDown(root, { key: 'Enter' })
    expect(usePromptPaletteStore.getState().drafts['pty-1']).toBe('/resume ')
    expect(writePtyMock).not.toHaveBeenCalled()
    // パレットが閉じていないこと
    expect(usePromptPaletteStore.getState().isOpen).toBe(true)
    // textarea にフォーカスが残っていること確認は jsdom で難しいため省略
    void ta
  })

  it('textarea にフォーカスがある状態で Tab を押すと SlashSuggest の候補が確定される', async () => {
    act(() => {
      usePromptPaletteStore.setState({
        isOpen: true,
        targetPtyId: 'pty-1',
        targetTabName: 'zsh',
        drafts: { 'pty-1': '/res' },
      })
    })
    render(<PromptPalette />)
    const ta = (await screen.findByRole('textbox')) as HTMLTextAreaElement
    fireEvent.keyDown(ta, { key: 'Tab' })
    expect(usePromptPaletteStore.getState().drafts['pty-1']).toBe('/resume ')
    expect(writePtyMock).not.toHaveBeenCalled()
  })

  it('textarea の Enter も SlashSuggest に委譲され候補が確定される', async () => {
    act(() => {
      usePromptPaletteStore.setState({
        isOpen: true,
        targetPtyId: 'pty-1',
        targetTabName: 'zsh',
        drafts: { 'pty-1': '/res' },
      })
    })
    render(<PromptPalette />)
    const ta = (await screen.findByRole('textbox')) as HTMLTextAreaElement
    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(usePromptPaletteStore.getState().drafts['pty-1']).toBe('/resume ')
  })

  it('textarea の ↓ は SlashSuggest の activeIndex を進める（履歴巡回には落ちない）', async () => {
    act(() => {
      usePromptPaletteStore.setState({
        isOpen: true,
        targetPtyId: 'pty-1',
        targetTabName: 'zsh',
        drafts: { 'pty-1': '/' },
      })
      usePromptPaletteStore.getState().pushHistory('old-history')
    })
    render(<PromptPalette />)
    const ta = (await screen.findByRole('textbox')) as HTMLTextAreaElement
    // 履歴から巡回されると draft が 'old-history' に変わってしまう。
    // SlashSuggest に委譲されれば draft は '/' のまま。
    fireEvent.keyDown(ta, { key: 'ArrowDown' })
    expect(usePromptPaletteStore.getState().drafts['pty-1']).toBe('/')
  })

  it('textarea の Cmd+Enter はスラッシュ表示中でも送信になる', async () => {
    act(() => {
      usePromptPaletteStore.setState({
        isOpen: true,
        targetPtyId: 'pty-1',
        targetTabName: 'zsh',
        drafts: { 'pty-1': '/resume arg' }, // 空白含むため slashActive は false 扱い。
      })
    })
    render(<PromptPalette />)
    const ta = (await screen.findByRole('textbox')) as HTMLTextAreaElement
    await act(async () => {
      fireEvent.keyDown(ta, { key: 'Enter', metaKey: true })
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(writePtyMock).toHaveBeenCalledWith('pty-1', '/resume arg\n')
  })

  it('SlashSuggest でテンプレを選択すると draft がテンプレ body に全置換される（既存挙動）', async () => {
    act(() => {
      usePromptPaletteStore.setState({
        isOpen: true,
        targetPtyId: 'pty-1',
        targetTabName: 'zsh',
        drafts: { 'pty-1': '/zzmy-tpl' },
      })
      usePromptPaletteStore
        .getState()
        .upsertTemplate({ name: 'zzmy-tpl', body: 'TEMPLATE BODY' })
    })
    render(<PromptPalette />)
    await screen.findByRole('textbox')
    const root = document.querySelector('[data-palette-dropdown="slash"]') as HTMLElement
    fireEvent.keyDown(root, { key: 'Enter' })
    expect(usePromptPaletteStore.getState().drafts['pty-1']).toBe('TEMPLATE BODY')
  })

  it('handleChange で historyCursor がリセットされる（ユーザー編集で巡回解除）', async () => {
    act(() => {
      usePromptPaletteStore.setState({
        isOpen: true,
        targetPtyId: 'pty-1',
        targetTabName: 'zsh',
        drafts: { 'pty-1': 'navigated' },
      })
      usePromptPaletteStore.getState().pushHistory('navigated')
      usePromptPaletteStore.getState().setHistoryCursor(0)
    })
    render(<PromptPalette />)
    const ta = (await screen.findByRole('textbox')) as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: 'navigated edited' } })
    expect(usePromptPaletteStore.getState().historyCursor).toBeNull()
  })
})
