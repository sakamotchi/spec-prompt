import { describe, it, expect, beforeEach } from 'vitest'
import { usePromptPaletteStore, type PromptPaletteTextareaRef } from './promptPaletteStore'

function resetStore() {
  usePromptPaletteStore.setState({
    isOpen: false,
    targetPtyId: null,
    targetTabName: null,
    drafts: {},
    textareaRef: null,
    lastInsertAt: 0,
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
