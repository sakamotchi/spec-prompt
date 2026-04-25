import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PromptTemplateDropdown } from './PromptTemplateDropdown'
import { usePromptPaletteStore } from '../../stores/promptPaletteStore'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

function resetStore() {
  localStorage.removeItem('sddesk:prompt-palette')
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
    dropdown: 'template',
    editorState: null,
  })
}

describe('PromptTemplateDropdown', () => {
  beforeEach(() => {
    cleanup()
    resetStore()
  })

  it('テンプレ 0 件のとき empty メッセージを表示', () => {
    render(<PromptTemplateDropdown />)
    expect(screen.getByText('promptPalette.template.empty')).toBeInTheDocument()
  })

  it('一覧が name 昇順で並ぶ', () => {
    usePromptPaletteStore.getState().upsertTemplate({ name: 'b', body: '2' })
    usePromptPaletteStore.getState().upsertTemplate({ name: 'a', body: '1' })
    render(<PromptTemplateDropdown />)
    const options = screen.getAllByRole('option')
    expect(options[0]).toHaveTextContent('a')
    expect(options[1]).toHaveTextContent('b')
  })

  it('name で fuzzy 検索できる', async () => {
    const user = userEvent.setup()
    usePromptPaletteStore.getState().upsertTemplate({ name: 'review-pr', body: '1' })
    usePromptPaletteStore.getState().upsertTemplate({ name: 'summarize', body: '2' })
    render(<PromptTemplateDropdown />)
    await user.type(screen.getByRole('textbox'), 'rev')
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent('review-pr')
  })

  it('body で fuzzy 検索できる', async () => {
    const user = userEvent.setup()
    usePromptPaletteStore.getState().upsertTemplate({ name: 'a', body: 'build_and_run' })
    usePromptPaletteStore.getState().upsertTemplate({ name: 'b', body: 'ls -la' })
    render(<PromptTemplateDropdown />)
    await user.type(screen.getByRole('textbox'), 'run')
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent('a')
  })

  it('Enter で選択テンプレが draft に流し込まれ、dropdown が閉じる', () => {
    usePromptPaletteStore.getState().upsertTemplate({ name: 'x', body: 'hello body' })
    render(<PromptTemplateDropdown />)
    const root = document.querySelector('[data-palette-dropdown="template"]') as HTMLElement
    fireEvent.keyDown(root, { key: 'Enter' })
    expect(usePromptPaletteStore.getState().drafts['pty-1']).toBe('hello body')
    expect(usePromptPaletteStore.getState().dropdown).toBe('none')
  })

  it('新規作成ボタンでエディタを create モードで開く', async () => {
    const user = userEvent.setup()
    render(<PromptTemplateDropdown />)
    await user.click(screen.getByRole('button', { name: /promptPalette\.template\.new/ }))
    const state = usePromptPaletteStore.getState()
    expect(state.dropdown).toBe('none')
    expect(state.editorState).toEqual({ mode: 'create' })
  })

  it('編集アイコンでエディタを edit モードで開く', async () => {
    const user = userEvent.setup()
    const tpl = usePromptPaletteStore.getState().upsertTemplate({ name: 'x', body: 'y' })
    render(<PromptTemplateDropdown />)
    await user.click(screen.getByLabelText('promptPalette.template.edit'))
    const state = usePromptPaletteStore.getState()
    expect(state.editorState).toEqual({ mode: 'edit', templateId: tpl.id })
  })

  it('削除アイコンで確認ダイアログが開く', async () => {
    const user = userEvent.setup()
    usePromptPaletteStore.getState().upsertTemplate({ name: 'x', body: 'y' })
    render(<PromptTemplateDropdown />)
    await user.click(screen.getByLabelText('promptPalette.template.delete'))
    expect(
      screen.getByText('promptPalette.template.editor.deleteConfirm'),
    ).toBeInTheDocument()
  })

  it('削除確認で Action を押すと removeTemplate される', async () => {
    const user = userEvent.setup()
    const tpl = usePromptPaletteStore.getState().upsertTemplate({ name: 'x', body: 'y' })
    render(<PromptTemplateDropdown />)
    await user.click(screen.getByLabelText('promptPalette.template.delete'))
    // AlertDialog.Action: 赤い削除ボタン（text は promptPalette.template.delete）
    const buttons = screen.getAllByRole('button', {
      name: 'promptPalette.template.delete',
    })
    // 最後の「削除」ボタンが確認ダイアログ内の Action
    await user.click(buttons[buttons.length - 1])
    expect(usePromptPaletteStore.getState().templates).toHaveLength(0)
    expect(tpl.id).toBeTruthy()
  })

  it('Esc で dropdown のみ閉じる', () => {
    usePromptPaletteStore.getState().upsertTemplate({ name: 'x', body: 'y' })
    render(<PromptTemplateDropdown />)
    const root = document.querySelector('[data-palette-dropdown="template"]') as HTMLElement
    fireEvent.keyDown(root, { key: 'Escape' })
    expect(usePromptPaletteStore.getState().dropdown).toBe('none')
    expect(usePromptPaletteStore.getState().isOpen).toBe(true)
  })

  it('クリック選択で applyTemplateBodyToDraft が呼ばれ draft 流し込み', async () => {
    const user = userEvent.setup()
    usePromptPaletteStore.getState().upsertTemplate({ name: 'click', body: 'clicked-body' })
    render(<PromptTemplateDropdown />)
    await user.click(screen.getByRole('option'))
    expect(usePromptPaletteStore.getState().drafts['pty-1']).toBe('clicked-body')
  })
})
