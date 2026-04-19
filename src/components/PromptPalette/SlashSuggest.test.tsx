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
    usePromptPaletteStore.getState().upsertTemplate({ name: 'review', body: '1' })
    usePromptPaletteStore.getState().upsertTemplate({ name: 'refactor', body: '2' })
    usePromptPaletteStore.getState().upsertTemplate({ name: 'summarize', body: '3' })
  })

  it('draft が / で始まらない場合は何も描画しない', () => {
    const { container } = render(<SlashSuggest draft="hello" onSelect={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('draft が / のとき全テンプレが表示される', () => {
    render(<SlashSuggest draft="/" onSelect={() => {}} />)
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(3)
  })

  it('draft が /rev のとき fuzzy 絞り込み', () => {
    render(<SlashSuggest draft="/rev" onSelect={() => {}} />)
    const options = screen.getAllByRole('option')
    const names = options.map((o) => o.textContent)
    // `rev` の r, e, v を順番に含むのは `review` のみ（refactor は v がない、summarize は v がない）
    expect(names).toHaveLength(1)
    expect(names[0]).toContain('review')
  })

  it('draft が /re のとき r,e を順番に含むテンプレが候補に並ぶ', () => {
    render(<SlashSuggest draft="/re" onSelect={() => {}} />)
    const options = screen.getAllByRole('option')
    const names = options.map((o) => o.textContent)
    // `re` を r, e 順で含む: review, refactor（summarize は s→u→m→m→a→r→i→z→e で r の後の e がある）
    // 実際: summarize は r(pos 5) の後 e(pos 8) があるので fuzzy マッチする
    expect(names.some((n) => n?.includes('review'))).toBe(true)
    expect(names.some((n) => n?.includes('refactor'))).toBe(true)
  })

  it('候補 0 件なら非表示', () => {
    const { container } = render(
      <SlashSuggest draft="/zzzzzzz" onSelect={() => {}} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('↓ で activeIndex が進み、Enter で onSelect が呼ばれる', () => {
    const onSelect = vi.fn()
    render(<SlashSuggest draft="/" onSelect={onSelect} />)
    const root = document.querySelector('[data-palette-dropdown="slash"]') as HTMLElement
    fireEvent.keyDown(root, { key: 'ArrowDown' })
    fireEvent.keyDown(root, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledTimes(1)
    // name 昇順 sorted: refactor, review, summarize。ArrowDown 1 回で index=1 = review
    expect(onSelect.mock.calls[0][0].name).toBe('review')
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
})
