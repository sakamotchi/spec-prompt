import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PromptHistoryDropdown } from './PromptHistoryDropdown'
import { usePromptPaletteStore } from '../../stores/promptPaletteStore'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

function resetStore() {
  localStorage.removeItem('spec-prompt:prompt-palette')
  usePromptPaletteStore.setState({
    isOpen: true,
    targetPtyId: 'pty-1',
    targetTabName: 'zsh',
    drafts: {},
    textareaRef: null,
    lastInsertAt: 0,
    history: [],
    templates: [],
    historyCursor: null,
    dropdown: 'history',
    editorState: null,
  })
}

describe('PromptHistoryDropdown', () => {
  beforeEach(() => {
    cleanup()
    resetStore()
  })

  it('履歴 0 件のとき empty メッセージを表示する', () => {
    render(<PromptHistoryDropdown />)
    expect(screen.getByText('promptPalette.history.empty')).toBeInTheDocument()
  })

  it('履歴を新しい順にリスト表示する', () => {
    usePromptPaletteStore.getState().pushHistory('oldest')
    usePromptPaletteStore.getState().pushHistory('latest')
    render(<PromptHistoryDropdown />)
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(2)
    expect(options[0]).toHaveTextContent('latest')
    expect(options[1]).toHaveTextContent('oldest')
  })

  it('検索で fuzzy 絞り込みができる', async () => {
    const user = userEvent.setup()
    usePromptPaletteStore.getState().pushHistory('echo hello')
    usePromptPaletteStore.getState().pushHistory('ls -la')
    usePromptPaletteStore.getState().pushHistory('git status')
    render(<PromptHistoryDropdown />)
    const input = screen.getByRole('textbox')
    await user.type(input, 'gst')
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent('git status')
  })

  it('Enter で選択した履歴が draft に流し込まれ、dropdown が閉じる', async () => {
    usePromptPaletteStore.getState().pushHistory('echo hello')
    usePromptPaletteStore.getState().pushHistory('ls -la')
    render(<PromptHistoryDropdown />)
    const container = screen.getAllByRole('option')[0].parentElement!.parentElement!
    fireEvent.keyDown(container, { key: 'Enter' })
    expect(usePromptPaletteStore.getState().drafts['pty-1']).toBe('ls -la')
    expect(usePromptPaletteStore.getState().dropdown).toBe('none')
  })

  it('↓ で activeIndex が進み、Enter で該当履歴が選択される', () => {
    usePromptPaletteStore.getState().pushHistory('a')
    usePromptPaletteStore.getState().pushHistory('b')
    usePromptPaletteStore.getState().pushHistory('c')
    render(<PromptHistoryDropdown />)
    const container = screen.getAllByRole('option')[0].parentElement!.parentElement!
    fireEvent.keyDown(container, { key: 'ArrowDown' })
    fireEvent.keyDown(container, { key: 'Enter' })
    // 0 番目は 'c'（最新）、↓ で 1 番目 = 'b'
    expect(usePromptPaletteStore.getState().drafts['pty-1']).toBe('b')
  })

  it('Esc でドロップダウンのみ閉じる（ストア isOpen は true のまま）', () => {
    usePromptPaletteStore.getState().pushHistory('a')
    render(<PromptHistoryDropdown />)
    const container = screen.getAllByRole('option')[0].parentElement!.parentElement!
    fireEvent.keyDown(container, { key: 'Escape' })
    expect(usePromptPaletteStore.getState().dropdown).toBe('none')
    expect(usePromptPaletteStore.getState().isOpen).toBe(true)
  })

  it('クリック選択で draft に流し込まれる', async () => {
    const user = userEvent.setup()
    usePromptPaletteStore.getState().pushHistory('click-me')
    render(<PromptHistoryDropdown />)
    await user.click(screen.getByRole('option'))
    expect(usePromptPaletteStore.getState().drafts['pty-1']).toBe('click-me')
    expect(usePromptPaletteStore.getState().dropdown).toBe('none')
  })

  it('複数行の body は ↵ を含む 1 行プレビューに変換される', () => {
    usePromptPaletteStore.setState({
      history: [
        { id: 'x', body: 'line1\nline2', createdAt: Date.now() },
      ],
    })
    render(<PromptHistoryDropdown />)
    const option = screen.getByRole('option')
    expect(option.textContent).toContain('↵')
  })

  it('ルート要素に data-palette-dropdown="history" 属性が付いている', () => {
    render(<PromptHistoryDropdown />)
    const root = document.querySelector('[data-palette-dropdown="history"]')
    expect(root).not.toBeNull()
  })

  it('onAfterSelect が選択時に呼ばれる', async () => {
    const spy = vi.fn()
    const user = userEvent.setup()
    usePromptPaletteStore.getState().pushHistory('hello')
    render(<PromptHistoryDropdown onAfterSelect={spy} />)
    await user.click(screen.getByRole('option'))
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0].body).toBe('hello')
  })

  it('流し込み後に textareaRef があれば focus を戻す', async () => {
    const ta = document.createElement('textarea')
    ta.value = ''
    document.body.appendChild(ta)
    usePromptPaletteStore.setState({ textareaRef: { current: ta } })
    usePromptPaletteStore.getState().pushHistory('focus-me')
    render(<PromptHistoryDropdown />)

    const option = screen.getByRole('option')
    await act(async () => {
      option.click()
      await new Promise<void>((r) =>
        typeof requestAnimationFrame === 'function'
          ? requestAnimationFrame(() => r())
          : r(),
      )
    })
    expect(document.activeElement).toBe(ta)
    document.body.removeChild(ta)
  })
})
