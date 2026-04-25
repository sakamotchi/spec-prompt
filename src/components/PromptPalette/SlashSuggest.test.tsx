import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { SlashSuggest } from './SlashSuggest'
import { parseSlashQuery } from '../../lib/slashQuery'
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
    dropdown: 'none',
    editorState: null,
  })
}

describe('parseSlashQuery', () => {
  it('先頭 / で空クエリを返す', () => {
    expect(parseSlashQuery('/')).toBe('')
  })

  it('先頭 / 以降のトークンを返す', () => {
    expect(parseSlashQuery('/rev')).toBe('rev')
  })

  it('先頭 / でない場合は null', () => {
    expect(parseSlashQuery('hello')).toBeNull()
    expect(parseSlashQuery(' /rev')).toBeNull()
  })

  it('空白を含む場合は null', () => {
    expect(parseSlashQuery('/rev pr')).toBeNull()
  })

  it('改行を含む場合は null', () => {
    expect(parseSlashQuery('/rev\nmore')).toBeNull()
  })

  it('空文字は null', () => {
    expect(parseSlashQuery('')).toBeNull()
  })
})

describe('SlashSuggest', () => {
  beforeEach(() => {
    cleanup()
    resetStore()
  })

  it('draft が / で始まらない場合は何も描画しない', () => {
    const { container } = render(<SlashSuggest draft="hello" onSelect={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('draft が / のとき組み込みコマンドと（あれば）テンプレがセクション分けで表示される', () => {
    usePromptPaletteStore.getState().upsertTemplate({ name: 'review-pr', body: 'b' })
    render(<SlashSuggest draft="/" onSelect={() => {}} />)
    // コマンドセクションの見出し
    expect(
      screen.getByLabelText('promptPalette.slashSuggest.section.commands'),
    ).toBeTruthy()
    // テンプレセクションの見出し
    expect(
      screen.getByLabelText('promptPalette.slashSuggest.section.templates'),
    ).toBeTruthy()
    // バッジ CMD / TPL
    expect(screen.getAllByText('promptPalette.slashSuggest.badge.command').length).toBeGreaterThan(0)
    expect(screen.getAllByText('promptPalette.slashSuggest.badge.template').length).toBe(1)
  })

  it('テンプレが 0 件ならテンプレセクションは描画されない', () => {
    render(<SlashSuggest draft="/" onSelect={() => {}} />)
    expect(
      screen.queryByLabelText('promptPalette.slashSuggest.section.templates'),
    ).toBeNull()
  })

  it('候補 0 件なら非表示', () => {
    const { container } = render(
      <SlashSuggest draft="/zzzzzzzzzzzzzzz" onSelect={() => {}} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('fuzzy クエリで組み込みコマンドが絞り込まれる（/res → resume）', () => {
    render(<SlashSuggest draft="/res" onSelect={() => {}} />)
    const options = screen.getAllByRole('option')
    const names = options.map((o) => o.textContent ?? '')
    expect(names.some((n) => n.includes('resume'))).toBe(true)
  })

  it('↓ キーで activeIndex が進み、Enter で onSelect がグローバル index の候補で呼ばれる', () => {
    // builtin: maxPerSection=10 件で先頭は "batch" (name 昇順)
    // ↓ 1 回 → index=1 = "branch"
    const onSelect = vi.fn()
    render(<SlashSuggest draft="/" onSelect={onSelect} />)
    const root = document.querySelector('[data-palette-dropdown="slash"]') as HTMLElement
    fireEvent.keyDown(root, { key: 'ArrowDown' })
    fireEvent.keyDown(root, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledTimes(1)
    const selected = onSelect.mock.calls[0][0]
    expect(selected.kind).toBe('builtin')
  })

  it('↓ キーがセクション境界を越えて template セクションへ進む', () => {
    // builtin は 10 件（maxPerSection）、template 1 件
    usePromptPaletteStore.getState().upsertTemplate({ name: 'review-pr', body: 'b' })
    const onSelect = vi.fn()
    render(<SlashSuggest draft="/" onSelect={onSelect} />)
    const root = document.querySelector('[data-palette-dropdown="slash"]') as HTMLElement
    // ↓ を 10 回押す（index 0→10）で template セクション先頭 = review-pr
    for (let i = 0; i < 10; i++) {
      fireEvent.keyDown(root, { key: 'ArrowDown' })
    }
    fireEvent.keyDown(root, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledTimes(1)
    const selected = onSelect.mock.calls[0][0]
    expect(selected.kind).toBe('template')
    expect(selected.name).toBe('review-pr')
  })

  it('draft に空白が入ると非表示（条件喪失）', () => {
    const { container } = render(
      <SlashSuggest draft="/rev pr" onSelect={() => {}} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('draft に改行が入ると非表示', () => {
    const { container } = render(
      <SlashSuggest draft="/rev\npr" onSelect={() => {}} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('クリックで onSelect が呼ばれる', () => {
    const onSelect = vi.fn()
    render(<SlashSuggest draft="/" onSelect={onSelect} />)
    const firstOption = screen.getAllByRole('option')[0]
    fireEvent.click(firstOption)
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('Tab キーで activeIndex の候補が確定される', () => {
    const onSelect = vi.fn()
    render(<SlashSuggest draft="/" onSelect={onSelect} />)
    const root = document.querySelector('[data-palette-dropdown="slash"]') as HTMLElement
    fireEvent.keyDown(root, { key: 'Tab' })
    expect(onSelect).toHaveBeenCalledTimes(1)
    // 先頭 activeIndex=0 は builtin 昇順先頭 = "batch"
    expect(onSelect.mock.calls[0][0].kind).toBe('builtin')
    expect(onSelect.mock.calls[0][0].name).toBe('batch')
  })

  it('↓ で途中まで移動してから Tab でその候補を確定できる', () => {
    const onSelect = vi.fn()
    render(<SlashSuggest draft="/" onSelect={onSelect} />)
    const root = document.querySelector('[data-palette-dropdown="slash"]') as HTMLElement
    fireEvent.keyDown(root, { key: 'ArrowDown' })
    fireEvent.keyDown(root, { key: 'ArrowDown' })
    fireEvent.keyDown(root, { key: 'Tab' })
    expect(onSelect).toHaveBeenCalledTimes(1)
    // 2 回 ↓ → activeIndex=2 = "branch" (batch, branch, claude-api, clear, ...)
    expect(onSelect.mock.calls[0][0].name).toBe('claude-api')
  })

  it('Shift+Tab でも activeIndex の候補が確定される', () => {
    const onSelect = vi.fn()
    render(<SlashSuggest draft="/" onSelect={onSelect} />)
    const root = document.querySelector('[data-palette-dropdown="slash"]') as HTMLElement
    fireEvent.keyDown(root, { key: 'Tab', shiftKey: true })
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('Cmd+Enter は SlashSuggest で消費されない（親の送信ハンドラへ委譲）', () => {
    const onSelect = vi.fn()
    render(<SlashSuggest draft="/" onSelect={onSelect} />)
    const root = document.querySelector('[data-palette-dropdown="slash"]') as HTMLElement
    fireEvent.keyDown(root, { key: 'Enter', metaKey: true })
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('store の skills に user-skill があると User Skills セクションが表示される', () => {
    usePromptPaletteStore.setState({
      skills: [
        {
          kind: 'user',
          name: 'zzmy-user-skill',
          description: 'U',
          path: '/u/zzmy-user-skill/SKILL.md',
        },
      ],
    })
    render(<SlashSuggest draft="/zzmy" onSelect={() => {}} />)
    expect(
      screen.getByLabelText('promptPalette.slashSuggest.section.userSkills'),
    ).toBeTruthy()
    expect(screen.getAllByText('promptPalette.slashSuggest.badge.userSkill')).toHaveLength(1)
  })

  it('store の skills に project-skill があると Project Skills セクションが表示される', () => {
    usePromptPaletteStore.setState({
      skills: [
        {
          kind: 'project',
          name: 'zzmy-project-skill',
          description: 'P',
          path: '/p/zzmy-project-skill/SKILL.md',
        },
      ],
    })
    render(<SlashSuggest draft="/zzmy" onSelect={() => {}} />)
    expect(
      screen.getByLabelText('promptPalette.slashSuggest.section.projectSkills'),
    ).toBeTruthy()
    expect(screen.getAllByText('promptPalette.slashSuggest.badge.projectSkill')).toHaveLength(1)
  })

  it('Skill 選択時は onSelect の kind が user-skill / project-skill になる', () => {
    usePromptPaletteStore.setState({
      skills: [
        {
          kind: 'user',
          name: 'zzpicked',
          path: '/u/zzpicked/SKILL.md',
        },
      ],
    })
    const onSelect = vi.fn()
    render(<SlashSuggest draft="/zzpicked" onSelect={onSelect} />)
    const root = document.querySelector('[data-palette-dropdown="slash"]') as HTMLElement
    fireEvent.keyDown(root, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0][0].kind).toBe('user-skill')
    expect(onSelect.mock.calls[0][0].name).toBe('zzpicked')
  })
})
