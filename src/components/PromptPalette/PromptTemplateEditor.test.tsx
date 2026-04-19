import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PromptTemplateEditor } from './PromptTemplateEditor'
import { validateTemplate } from '../../lib/templateValidation'
import { usePromptPaletteStore } from '../../stores/promptPaletteStore'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
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
    dropdown: 'none',
    editorState: { mode: 'create' },
  })
}

describe('validateTemplate', () => {
  it('正常値は ok: true', () => {
    expect(validateTemplate('name', 'body', [], null)).toEqual({ ok: true })
  })

  it('name 空は nameEmpty エラー', () => {
    const r = validateTemplate('   ', 'body', [], null)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.nameError).toContain('nameEmpty')
  })

  it('body 空は bodyEmpty エラー', () => {
    const r = validateTemplate('n', '   ', [], null)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.bodyError).toContain('bodyEmpty')
  })

  it('name 重複は nameDuplicate エラー（self は除外）', () => {
    const existing = [
      { id: 'a', name: 'x', body: 'y', updatedAt: 1 },
      { id: 'b', name: 'z', body: 'y', updatedAt: 1 },
    ]
    const r = validateTemplate('x', 'body', existing, null)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.nameError).toContain('nameDuplicate')

    // self id を指定すれば重複扱いしない
    const r2 = validateTemplate('x', 'body', existing, 'a')
    expect(r2.ok).toBe(true)
  })

  it('body 10001 字で bodyTooLong', () => {
    const r = validateTemplate('n', 'a'.repeat(10001), [], null)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.bodyError).toContain('bodyTooLong')
  })
})

describe('PromptTemplateEditor', () => {
  beforeEach(() => {
    cleanup()
    resetStore()
  })

  it('create モードで保存するとテンプレが追加される', async () => {
    const user = userEvent.setup()
    render(<PromptTemplateEditor />)
    await user.type(
      screen.getByLabelText('promptPalette.template.editor.name'),
      'test',
    )
    // userEvent.type は `{` をキー命令として解釈するため、`{{` と書いて一個分。
    // `hello {{path}}` を入力するには `hello {{{{path}}` と記述する必要があるが、
    // 明瞭さのため change イベントで直接セットする。
    const bodyEl = screen.getByLabelText('promptPalette.template.editor.body')
    await user.clear(bodyEl)
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(bodyEl, { target: { value: 'hello {{path}}' } })
    await user.click(
      screen.getByRole('button', { name: 'promptPalette.template.editor.save' }),
    )
    const tpls = usePromptPaletteStore.getState().templates
    expect(tpls).toHaveLength(1)
    expect(tpls[0].name).toBe('test')
    expect(tpls[0].body).toBe('hello {{path}}')
    // 保存後はエディタが閉じている
    expect(usePromptPaletteStore.getState().editorState).toBeNull()
  })

  it('create モードで initialBody が本文初期値になる', () => {
    usePromptPaletteStore.setState({
      editorState: { mode: 'create', initialBody: 'from history' },
    })
    render(<PromptTemplateEditor />)
    expect(
      screen.getByLabelText('promptPalette.template.editor.body'),
    ).toHaveValue('from history')
  })

  it('edit モードで初期値が設定され、保存で既存レコードが更新される', async () => {
    const user = userEvent.setup()
    const tpl = usePromptPaletteStore
      .getState()
      .upsertTemplate({ name: 'orig', body: 'orig-body' })
    usePromptPaletteStore.setState({
      editorState: { mode: 'edit', templateId: tpl.id },
    })
    render(<PromptTemplateEditor />)
    const nameInput = screen.getByLabelText(
      'promptPalette.template.editor.name',
    ) as HTMLInputElement
    expect(nameInput.value).toBe('orig')
    await user.clear(nameInput)
    await user.type(nameInput, 'renamed')
    await user.click(
      screen.getByRole('button', { name: 'promptPalette.template.editor.save' }),
    )
    const tpls = usePromptPaletteStore.getState().templates
    expect(tpls).toHaveLength(1)
    expect(tpls[0].id).toBe(tpl.id)
    expect(tpls[0].name).toBe('renamed')
  })

  it('name 重複のとき保存ボタンが disable', async () => {
    const user = userEvent.setup()
    usePromptPaletteStore.getState().upsertTemplate({ name: 'dup', body: '1' })
    render(<PromptTemplateEditor />)
    await user.type(
      screen.getByLabelText('promptPalette.template.editor.name'),
      'dup',
    )
    await user.type(
      screen.getByLabelText('promptPalette.template.editor.body'),
      'body',
    )
    expect(
      screen.getByRole('button', { name: 'promptPalette.template.editor.save' }),
    ).toBeDisabled()
  })

  it('⌘Enter で保存される（バリデーション OK 時）', async () => {
    const user = userEvent.setup()
    render(<PromptTemplateEditor />)
    await user.type(
      screen.getByLabelText('promptPalette.template.editor.name'),
      'hotkey',
    )
    const bodyEl = screen.getByLabelText('promptPalette.template.editor.body')
    await user.type(bodyEl, 'x')
    await user.keyboard('{Meta>}{Enter}{/Meta}')
    expect(usePromptPaletteStore.getState().templates).toHaveLength(1)
  })

  it('edit モードで削除ボタン → 確認 → Action で removeTemplate される', async () => {
    const user = userEvent.setup()
    const tpl = usePromptPaletteStore
      .getState()
      .upsertTemplate({ name: 'del', body: 'body' })
    usePromptPaletteStore.setState({
      editorState: { mode: 'edit', templateId: tpl.id },
    })
    render(<PromptTemplateEditor />)
    await user.click(
      screen.getByRole('button', { name: 'promptPalette.template.delete' }),
    )
    // 確認ダイアログの Action
    const buttons = screen.getAllByRole('button', {
      name: 'promptPalette.template.delete',
    })
    await user.click(buttons[buttons.length - 1])
    expect(usePromptPaletteStore.getState().templates).toHaveLength(0)
  })

  it('キャンセルでエディタが閉じ、テンプレは追加されない', async () => {
    const user = userEvent.setup()
    render(<PromptTemplateEditor />)
    await user.click(
      screen.getByRole('button', { name: 'promptPalette.template.editor.cancel' }),
    )
    expect(usePromptPaletteStore.getState().editorState).toBeNull()
    expect(usePromptPaletteStore.getState().templates).toHaveLength(0)
  })
})
