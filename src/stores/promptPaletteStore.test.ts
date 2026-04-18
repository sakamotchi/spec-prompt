import { describe, it, expect, beforeEach } from 'vitest'
import { usePromptPaletteStore } from './promptPaletteStore'

function resetStore() {
  usePromptPaletteStore.setState({
    isOpen: false,
    targetPtyId: null,
    targetTabName: null,
    drafts: {},
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
})
