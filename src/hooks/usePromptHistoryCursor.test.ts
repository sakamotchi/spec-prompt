import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePromptHistoryCursor } from './usePromptHistoryCursor'
import { usePromptPaletteStore } from '../stores/promptPaletteStore'

function makeEvent(
  key: 'ArrowUp' | 'ArrowDown',
  overrides: Partial<{
    shiftKey: boolean
    altKey: boolean
    metaKey: boolean
    ctrlKey: boolean
    isComposing: boolean
  }> = {},
): React.KeyboardEvent<HTMLTextAreaElement> {
  let prevented = false
  return {
    key,
    shiftKey: overrides.shiftKey ?? false,
    altKey: overrides.altKey ?? false,
    metaKey: overrides.metaKey ?? false,
    ctrlKey: overrides.ctrlKey ?? false,
    preventDefault: () => {
      prevented = true
    },
    get defaultPrevented() {
      return prevented
    },
    nativeEvent: {
      isComposing: overrides.isComposing ?? false,
    } as unknown as KeyboardEvent,
  } as unknown as React.KeyboardEvent<HTMLTextAreaElement>
}

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

describe('usePromptHistoryCursor', () => {
  beforeEach(resetStore)

  it('textarea が空のとき ↑ で直近履歴が流し込まれる', () => {
    const ta = document.createElement('textarea')
    const textareaRef = { current: ta }
    usePromptPaletteStore.getState().pushHistory('old')
    usePromptPaletteStore.getState().pushHistory('latest')

    const { result } = renderHook(() =>
      usePromptHistoryCursor({ textareaRef, isComposing: false }),
    )

    let handled = false
    act(() => {
      handled = result.current.handleArrowKey(makeEvent('ArrowUp'))
    })
    expect(handled).toBe(true)
    expect(usePromptPaletteStore.getState().drafts['pty-1']).toBe('latest')
    expect(usePromptPaletteStore.getState().historyCursor).toBe(0)
  })

  it('連続 ↑ でより古い履歴へ進む', () => {
    const ta = document.createElement('textarea')
    const textareaRef = { current: ta }
    usePromptPaletteStore.getState().pushHistory('oldest')
    usePromptPaletteStore.getState().pushHistory('mid')
    usePromptPaletteStore.getState().pushHistory('latest')

    const { result } = renderHook(() =>
      usePromptHistoryCursor({ textareaRef, isComposing: false }),
    )

    act(() => result.current.handleArrowKey(makeEvent('ArrowUp')))
    ta.value = usePromptPaletteStore.getState().drafts['pty-1']
    act(() => result.current.handleArrowKey(makeEvent('ArrowUp')))
    expect(usePromptPaletteStore.getState().drafts['pty-1']).toBe('mid')
    act(() => result.current.handleArrowKey(makeEvent('ArrowUp')))
    expect(usePromptPaletteStore.getState().drafts['pty-1']).toBe('oldest')
    // 上限クランプ: さらに ↑ を押しても 'oldest' のまま
    act(() => result.current.handleArrowKey(makeEvent('ArrowUp')))
    expect(usePromptPaletteStore.getState().drafts['pty-1']).toBe('oldest')
    expect(usePromptPaletteStore.getState().historyCursor).toBe(2)
  })

  it('↓ で新しい側へ戻り、最新より新しい側で空に戻る', () => {
    const ta = document.createElement('textarea')
    const textareaRef = { current: ta }
    usePromptPaletteStore.getState().pushHistory('a')
    usePromptPaletteStore.getState().pushHistory('b')

    const { result } = renderHook(() =>
      usePromptHistoryCursor({ textareaRef, isComposing: false }),
    )

    act(() => result.current.handleArrowKey(makeEvent('ArrowUp'))) // b
    expect(usePromptPaletteStore.getState().drafts['pty-1']).toBe('b')

    act(() => result.current.handleArrowKey(makeEvent('ArrowDown')))
    expect(usePromptPaletteStore.getState().historyCursor).toBeNull()
    expect(usePromptPaletteStore.getState().drafts['pty-1']).toBe('')
  })

  it('IME 変換中（isComposing=true）は発動しない', () => {
    const ta = document.createElement('textarea')
    const textareaRef = { current: ta }
    usePromptPaletteStore.getState().pushHistory('hello')

    const { result } = renderHook(() =>
      usePromptHistoryCursor({ textareaRef, isComposing: true }),
    )

    let handled = true
    act(() => {
      handled = result.current.handleArrowKey(makeEvent('ArrowUp'))
    })
    expect(handled).toBe(false)
    expect(usePromptPaletteStore.getState().drafts['pty-1']).toBeUndefined()
  })

  it('nativeEvent.isComposing でも抑制される', () => {
    const ta = document.createElement('textarea')
    const textareaRef = { current: ta }
    usePromptPaletteStore.getState().pushHistory('hello')

    const { result } = renderHook(() =>
      usePromptHistoryCursor({ textareaRef, isComposing: false }),
    )
    let handled = true
    act(() => {
      handled = result.current.handleArrowKey(
        makeEvent('ArrowUp', { isComposing: true }),
      )
    })
    expect(handled).toBe(false)
  })

  it('修飾キー付きは発動しない（Shift / Alt / Meta / Ctrl）', () => {
    const ta = document.createElement('textarea')
    const textareaRef = { current: ta }
    usePromptPaletteStore.getState().pushHistory('hello')

    const { result } = renderHook(() =>
      usePromptHistoryCursor({ textareaRef, isComposing: false }),
    )

    for (const mod of ['shiftKey', 'altKey', 'metaKey', 'ctrlKey'] as const) {
      let handled = true
      act(() => {
        handled = result.current.handleArrowKey(makeEvent('ArrowUp', { [mod]: true }))
      })
      expect(handled).toBe(false)
    }
  })

  it('textarea が空でないときは開始しない（cursor===null のとき）', () => {
    const ta = document.createElement('textarea')
    ta.value = 'typing'
    const textareaRef = { current: ta }
    usePromptPaletteStore.getState().pushHistory('hello')
    usePromptPaletteStore.setState({ drafts: { 'pty-1': 'typing' } })

    const { result } = renderHook(() =>
      usePromptHistoryCursor({ textareaRef, isComposing: false }),
    )

    let handled = true
    act(() => {
      handled = result.current.handleArrowKey(makeEvent('ArrowUp'))
    })
    expect(handled).toBe(false)
    expect(usePromptPaletteStore.getState().drafts['pty-1']).toBe('typing')
  })

  it('履歴 0 件では発動しない', () => {
    const ta = document.createElement('textarea')
    const textareaRef = { current: ta }

    const { result } = renderHook(() =>
      usePromptHistoryCursor({ textareaRef, isComposing: false }),
    )

    let handled = true
    act(() => {
      handled = result.current.handleArrowKey(makeEvent('ArrowUp'))
    })
    expect(handled).toBe(false)
  })

  it('ArrowUp 以外の key は false を返す', () => {
    const ta = document.createElement('textarea')
    const textareaRef = { current: ta }
    usePromptPaletteStore.getState().pushHistory('hello')

    const { result } = renderHook(() =>
      usePromptHistoryCursor({ textareaRef, isComposing: false }),
    )

    const fakeEvent = {
      ...makeEvent('ArrowUp'),
      key: 'ArrowLeft',
    } as React.KeyboardEvent<HTMLTextAreaElement>

    let handled = true
    act(() => {
      handled = result.current.handleArrowKey(fakeEvent)
    })
    expect(handled).toBe(false)
  })

  it('cursor===null の状態で ↓ は no-op', () => {
    const ta = document.createElement('textarea')
    const textareaRef = { current: ta }
    usePromptPaletteStore.getState().pushHistory('hello')

    const { result } = renderHook(() =>
      usePromptHistoryCursor({ textareaRef, isComposing: false }),
    )

    let handled = true
    act(() => {
      handled = result.current.handleArrowKey(makeEvent('ArrowDown'))
    })
    expect(handled).toBe(false)
    expect(usePromptPaletteStore.getState().historyCursor).toBeNull()
  })

  it('resetCursor() は historyCursor を null にする', () => {
    const ta = document.createElement('textarea')
    const textareaRef = { current: ta }
    usePromptPaletteStore.getState().pushHistory('a')
    usePromptPaletteStore.getState().setHistoryCursor(0)

    const { result } = renderHook(() =>
      usePromptHistoryCursor({ textareaRef, isComposing: false }),
    )

    act(() => result.current.resetCursor())
    expect(usePromptPaletteStore.getState().historyCursor).toBeNull()
  })
})
