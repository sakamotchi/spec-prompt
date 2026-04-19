import { describe, it, expect, beforeEach, vi } from 'vitest'
import { usePromptPaletteStore, type PromptPaletteTextareaRef } from './promptPaletteStore'
import type { SkillMetadata } from '../lib/slashSuggestItem'

const listSkillsMock = vi.fn<(projectRoot?: string) => Promise<SkillMetadata[]>>()

vi.mock('../lib/tauriApi', () => ({
  tauriApi: {
    listSkills: (projectRoot?: string) => listSkillsMock(projectRoot),
  },
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
    skills: [],
    skillsLoadedAt: null,
  })
}

function makeTextareaRef(
  initialValue: string,
  selection: [number, number] = [initialValue.length, initialValue.length],
): { ref: PromptPaletteTextareaRef; ta: HTMLTextAreaElement } {
  const ta = document.createElement('textarea')
  ta.value = initialValue
  ta.setSelectionRange(selection[0], selection[1])
  return { ref: { current: ta }, ta }
}

async function flushFrame() {
  await new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve())
    } else {
      resolve()
    }
  })
}

describe('promptPaletteStore', () => {
  beforeEach(resetStore)

  it('初期状態は閉・送信先 null・drafts 空', () => {
    const s = usePromptPaletteStore.getState()
    expect(s.isOpen).toBe(false)
    expect(s.targetPtyId).toBeNull()
    expect(s.targetTabName).toBeNull()
    expect(s.drafts).toEqual({})
  })

  it('open() で isOpen/ptyId/tabName がセットされる', () => {
    usePromptPaletteStore.getState().open('pty-1', 'zsh')
    const s = usePromptPaletteStore.getState()
    expect(s.isOpen).toBe(true)
    expect(s.targetPtyId).toBe('pty-1')
    expect(s.targetTabName).toBe('zsh')
  })

  it('close() で送信先がリセットされる（drafts は保持）', () => {
    const s = usePromptPaletteStore.getState()
    s.setDraft('pty-1', 'keep me')
    s.open('pty-1', 'zsh')
    s.close()
    const r = usePromptPaletteStore.getState()
    expect(r.isOpen).toBe(false)
    expect(r.targetPtyId).toBeNull()
    expect(r.targetTabName).toBeNull()
    expect(r.drafts['pty-1']).toBe('keep me')
  })

  it('setDraft / getDraft はタブごとに独立', () => {
    const { setDraft, getDraft } = usePromptPaletteStore.getState()
    setDraft('pty-1', 'A')
    setDraft('pty-2', 'B')
    expect(getDraft('pty-1')).toBe('A')
    expect(getDraft('pty-2')).toBe('B')
    expect(getDraft('pty-3')).toBe('')
  })

  it('clearDraft() は該当 ptyId のみ削除し、他は残る', () => {
    const s = usePromptPaletteStore.getState()
    s.setDraft('pty-1', 'A')
    s.setDraft('pty-2', 'B')
    s.clearDraft('pty-1')
    const drafts = usePromptPaletteStore.getState().drafts
    expect(drafts['pty-1']).toBeUndefined()
    expect(drafts['pty-2']).toBe('B')
  })

  it('clearDraft() で未登録の ptyId を指定しても落ちない', () => {
    usePromptPaletteStore.getState().clearDraft('unknown')
    expect(usePromptPaletteStore.getState().drafts).toEqual({})
  })

  it('registerTextarea() で ref が保存され、null で解除できる', () => {
    const { ref } = makeTextareaRef('')
    usePromptPaletteStore.getState().registerTextarea(ref)
    expect(usePromptPaletteStore.getState().textareaRef).toBe(ref)
    usePromptPaletteStore.getState().registerTextarea(null)
    expect(usePromptPaletteStore.getState().textareaRef).toBeNull()
  })

  it('insertAtCaret() はキャレット位置に text を挿入し drafts を同期する', async () => {
    const { ref, ta } = makeTextareaRef('abcd', [2, 2])
    usePromptPaletteStore.setState({
      isOpen: true,
      targetPtyId: 'pty-1',
      targetTabName: 'zsh',
      drafts: { 'pty-1': 'abcd' },
    })
    usePromptPaletteStore.getState().registerTextarea(ref)
    usePromptPaletteStore.getState().insertAtCaret('XYZ')

    expect(usePromptPaletteStore.getState().drafts['pty-1']).toBe('abXYZcd')

    // 実環境では React の再レンダで textarea.value が drafts と同期される。
    // 単体テストでは PromptPalette を描画せずストアだけ検証するため、
    // ここで明示的に DOM を同期してから rAF の setSelectionRange を検証する。
    ta.value = usePromptPaletteStore.getState().drafts['pty-1']
    await flushFrame()
    expect(ta.selectionStart).toBe(5)
    expect(ta.selectionEnd).toBe(5)
  })

  it('insertAtCaret() は選択範囲を置換する', () => {
    const { ref } = makeTextareaRef('aaa bbb ccc', [4, 7])
    usePromptPaletteStore.setState({
      isOpen: true,
      targetPtyId: 'pty-1',
      targetTabName: 'zsh',
      drafts: { 'pty-1': 'aaa bbb ccc' },
    })
    usePromptPaletteStore.getState().registerTextarea(ref)
    usePromptPaletteStore.getState().insertAtCaret('foo.md')
    expect(usePromptPaletteStore.getState().drafts['pty-1']).toBe('aaa foo.md ccc')
  })

  it('insertAtCaret() は targetPtyId が null のとき no-op', () => {
    const { ref } = makeTextareaRef('hello')
    usePromptPaletteStore.setState({
      isOpen: false,
      targetPtyId: null,
      targetTabName: null,
      drafts: {},
    })
    usePromptPaletteStore.getState().registerTextarea(ref)
    usePromptPaletteStore.getState().insertAtCaret('X')
    expect(usePromptPaletteStore.getState().drafts).toEqual({})
  })

  it('insertAtCaret() は textareaRef が null のとき no-op', () => {
    usePromptPaletteStore.setState({
      isOpen: true,
      targetPtyId: 'pty-1',
      targetTabName: 'zsh',
      drafts: { 'pty-1': 'keep' },
    })
    usePromptPaletteStore.getState().registerTextarea(null)
    usePromptPaletteStore.getState().insertAtCaret('X')
    expect(usePromptPaletteStore.getState().drafts['pty-1']).toBe('keep')
  })

  it('insertAtCaret() 成功時に lastInsertAt がインクリメントされる（F4-2 挿入シグナル）', () => {
    const { ref } = makeTextareaRef('abcd', [2, 2])
    usePromptPaletteStore.setState({
      isOpen: true,
      targetPtyId: 'pty-1',
      targetTabName: 'zsh',
      drafts: { 'pty-1': 'abcd' },
      lastInsertAt: 0,
    })
    usePromptPaletteStore.getState().registerTextarea(ref)

    usePromptPaletteStore.getState().insertAtCaret('X')
    expect(usePromptPaletteStore.getState().lastInsertAt).toBe(1)

    usePromptPaletteStore.getState().insertAtCaret('Y')
    expect(usePromptPaletteStore.getState().lastInsertAt).toBe(2)
  })

  it('insertAtCaret() が no-op のとき lastInsertAt は変わらない', () => {
    usePromptPaletteStore.setState({
      isOpen: false,
      targetPtyId: null,
      lastInsertAt: 5,
    })
    usePromptPaletteStore.getState().registerTextarea(null)
    usePromptPaletteStore.getState().insertAtCaret('X')
    expect(usePromptPaletteStore.getState().lastInsertAt).toBe(5)
  })
})

describe('promptPaletteStore — Phase 1: 履歴・テンプレート基盤', () => {
  beforeEach(resetStore)

  describe('pushHistory', () => {
    it('空または空白のみは追加されない', () => {
      const { pushHistory } = usePromptPaletteStore.getState()
      pushHistory('')
      pushHistory('   \n  ')
      expect(usePromptPaletteStore.getState().history).toHaveLength(0)
    })

    it('末尾空白は trim されて格納される', () => {
      usePromptPaletteStore.getState().pushHistory('hi\n\n')
      expect(usePromptPaletteStore.getState().history[0].body).toBe('hi')
    })

    it('直前と同じ body は追加されない（連続重複排除）', () => {
      const { pushHistory } = usePromptPaletteStore.getState()
      pushHistory('hello')
      pushHistory('hello')
      expect(usePromptPaletteStore.getState().history).toHaveLength(1)
    })

    it('間に別の body が挟まった再登場は別エントリとして残る', () => {
      const { pushHistory } = usePromptPaletteStore.getState()
      pushHistory('a')
      pushHistory('b')
      pushHistory('a')
      const bodies = usePromptPaletteStore.getState().history.map((h) => h.body)
      expect(bodies).toEqual(['a', 'b', 'a'])
    })

    it('新しい順に先頭へ積まれる', () => {
      const { pushHistory } = usePromptPaletteStore.getState()
      pushHistory('old')
      pushHistory('new')
      const [first, second] = usePromptPaletteStore.getState().history
      expect(first.body).toBe('new')
      expect(second.body).toBe('old')
    })

    it('100 件上限を超えると末尾（最古）が破棄される', () => {
      const { pushHistory } = usePromptPaletteStore.getState()
      for (let i = 0; i < 101; i++) pushHistory(`p-${i}`)
      const { history } = usePromptPaletteStore.getState()
      expect(history).toHaveLength(100)
      expect(history[0].body).toBe('p-100')
      expect(history[99].body).toBe('p-1')
    })

    it('push 時に historyCursor が null にリセットされる', () => {
      const { pushHistory, setHistoryCursor } = usePromptPaletteStore.getState()
      pushHistory('a')
      pushHistory('b')
      setHistoryCursor(0)
      expect(usePromptPaletteStore.getState().historyCursor).toBe(0)
      pushHistory('c')
      expect(usePromptPaletteStore.getState().historyCursor).toBeNull()
    })
  })

  describe('setHistoryCursor', () => {
    it('null を指定すると解除される', () => {
      const { pushHistory, setHistoryCursor } = usePromptPaletteStore.getState()
      pushHistory('a')
      setHistoryCursor(0)
      setHistoryCursor(null)
      expect(usePromptPaletteStore.getState().historyCursor).toBeNull()
    })

    it('範囲内の index はそのままセットされる', () => {
      const { pushHistory, setHistoryCursor } = usePromptPaletteStore.getState()
      pushHistory('a')
      pushHistory('b')
      setHistoryCursor(1)
      expect(usePromptPaletteStore.getState().historyCursor).toBe(1)
    })

    it('負値は null にクランプ', () => {
      const { pushHistory, setHistoryCursor } = usePromptPaletteStore.getState()
      pushHistory('a')
      setHistoryCursor(-1)
      expect(usePromptPaletteStore.getState().historyCursor).toBeNull()
    })

    it('履歴数以上の index は null にクランプ', () => {
      const { pushHistory, setHistoryCursor } = usePromptPaletteStore.getState()
      pushHistory('a')
      setHistoryCursor(5)
      expect(usePromptPaletteStore.getState().historyCursor).toBeNull()
    })
  })

  describe('openDropdown / closeDropdown', () => {
    it('openDropdown で kind がセットされる', () => {
      usePromptPaletteStore.getState().openDropdown('history')
      expect(usePromptPaletteStore.getState().dropdown).toBe('history')
    })

    it('closeDropdown で none に戻る', () => {
      const s = usePromptPaletteStore.getState()
      s.openDropdown('template')
      s.closeDropdown()
      expect(usePromptPaletteStore.getState().dropdown).toBe('none')
    })
  })

  describe('upsertTemplate', () => {
    it('id 未指定は新規作成される', () => {
      const t = usePromptPaletteStore
        .getState()
        .upsertTemplate({ name: 'x', body: 'y' })
      expect(t.id).toBeTruthy()
      expect(t.updatedAt).toBeGreaterThan(0)
      expect(usePromptPaletteStore.getState().templates).toHaveLength(1)
    })

    it('同じ id は上書きされる（件数は増えない）', () => {
      const { upsertTemplate } = usePromptPaletteStore.getState()
      const t = upsertTemplate({ name: 'x', body: 'y' })
      upsertTemplate({ id: t.id, name: 'x2', body: 'y2' })
      const tpls = usePromptPaletteStore.getState().templates
      expect(tpls).toHaveLength(1)
      expect(tpls[0].name).toBe('x2')
      expect(tpls[0].body).toBe('y2')
    })

    it('異なる id は別エントリとして追加される', () => {
      const { upsertTemplate } = usePromptPaletteStore.getState()
      upsertTemplate({ name: 'a', body: '1' })
      upsertTemplate({ name: 'b', body: '2' })
      expect(usePromptPaletteStore.getState().templates).toHaveLength(2)
    })
  })

  describe('removeTemplate', () => {
    it('指定 id のみ削除される', () => {
      const { upsertTemplate, removeTemplate } = usePromptPaletteStore.getState()
      const a = upsertTemplate({ name: 'a', body: '1' })
      upsertTemplate({ name: 'b', body: '2' })
      removeTemplate(a.id)
      const tpls = usePromptPaletteStore.getState().templates
      expect(tpls).toHaveLength(1)
      expect(tpls[0].name).toBe('b')
    })

    it('存在しない id を指定しても落ちない', () => {
      const { upsertTemplate, removeTemplate } = usePromptPaletteStore.getState()
      upsertTemplate({ name: 'a', body: '1' })
      removeTemplate('nonexistent')
      expect(usePromptPaletteStore.getState().templates).toHaveLength(1)
    })
  })

  describe('openEditor / closeEditor', () => {
    it('openEditor で editorState がセットされる', () => {
      usePromptPaletteStore.getState().openEditor({ mode: 'create' })
      expect(usePromptPaletteStore.getState().editorState).toEqual({ mode: 'create' })
    })

    it('closeEditor で null に戻る', () => {
      const s = usePromptPaletteStore.getState()
      s.openEditor({ mode: 'edit', templateId: 'abc' })
      s.closeEditor()
      expect(usePromptPaletteStore.getState().editorState).toBeNull()
    })
  })

  describe('persist', () => {
    it('history と templates は localStorage に書き出される', () => {
      usePromptPaletteStore.getState().pushHistory('persisted')
      usePromptPaletteStore.getState().upsertTemplate({ name: 'keep', body: 'body' })
      const raw = localStorage.getItem('spec-prompt:prompt-palette')
      expect(raw).toBeTruthy()
      const parsed = JSON.parse(raw as string) as {
        state: { history: Array<{ body: string }>; templates: Array<{ name: string }> }
        version: number
      }
      expect(parsed.version).toBe(1)
      expect(parsed.state.history[0].body).toBe('persisted')
      expect(parsed.state.templates[0].name).toBe('keep')
    })

    it('drafts や isOpen などランタイム状態は永続化対象外', () => {
      const s = usePromptPaletteStore.getState()
      s.open('pty-1', 'zsh')
      s.setDraft('pty-1', 'runtime only')
      s.openDropdown('history')
      const raw = localStorage.getItem('spec-prompt:prompt-palette')
      expect(raw).toBeTruthy()
      const parsed = JSON.parse(raw as string) as { state: Record<string, unknown> }
      expect(parsed.state).not.toHaveProperty('drafts')
      expect(parsed.state).not.toHaveProperty('isOpen')
      expect(parsed.state).not.toHaveProperty('dropdown')
      expect(parsed.state).not.toHaveProperty('editorState')
    })

    it('skills / skillsLoadedAt は永続化対象外', () => {
      usePromptPaletteStore.setState({
        skills: [
          {
            kind: 'user',
            name: 'foo',
            path: '/home/u/.claude/skills/foo/SKILL.md',
          },
        ],
        skillsLoadedAt: Date.now(),
      })
      // persist middleware は setState を同期で localStorage に書き出す。
      usePromptPaletteStore.getState().upsertTemplate({ name: 'trigger', body: 'x' })
      const raw = localStorage.getItem('spec-prompt:prompt-palette')
      expect(raw).toBeTruthy()
      const parsed = JSON.parse(raw as string) as { state: Record<string, unknown> }
      expect(parsed.state).not.toHaveProperty('skills')
      expect(parsed.state).not.toHaveProperty('skillsLoadedAt')
    })
  })
})

describe('promptPaletteStore — Phase B: Skill ロード', () => {
  beforeEach(() => {
    resetStore()
    listSkillsMock.mockReset()
  })

  it('loadSkills 成功時に skills / skillsLoadedAt が更新される', async () => {
    listSkillsMock.mockResolvedValueOnce([
      { kind: 'user', name: 'alpha', path: '/u/alpha/SKILL.md' },
    ])
    await usePromptPaletteStore.getState().loadSkills('/my/project')
    expect(listSkillsMock).toHaveBeenCalledWith('/my/project')
    const state = usePromptPaletteStore.getState()
    expect(state.skills).toHaveLength(1)
    expect(state.skills[0].name).toBe('alpha')
    expect(state.skillsLoadedAt).not.toBeNull()
  })

  it('loadSkills 失敗時は skills=[], skillsLoadedAt=null のまま（再試行可能）', async () => {
    listSkillsMock.mockRejectedValueOnce(new Error('boom'))
    await usePromptPaletteStore.getState().loadSkills()
    const state = usePromptPaletteStore.getState()
    expect(state.skills).toHaveLength(0)
    expect(state.skillsLoadedAt).toBeNull()
  })

  it('loadSkills は projectRoot 未指定で undefined を渡す', async () => {
    listSkillsMock.mockResolvedValueOnce([])
    await usePromptPaletteStore.getState().loadSkills()
    expect(listSkillsMock).toHaveBeenCalledWith(undefined)
  })
})
