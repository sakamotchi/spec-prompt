import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { InlineInput } from './InlineInput'

describe('InlineInput', () => {
  it('テキスト入力が反映される', () => {
    const onCommit = vi.fn().mockResolvedValue(null)
    const onCancel = vi.fn()
    const { getByRole } = render(
      <InlineInput depth={0} onCommit={onCommit} onCancel={onCancel} />
    )
    const input = getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'new-file.md' } })
    expect(input.value).toBe('new-file.md')
  })

  it('Enter キーで onCommit が呼ばれる', async () => {
    const onCommit = vi.fn().mockResolvedValue(null)
    const onCancel = vi.fn()
    const { getByRole } = render(
      <InlineInput depth={0} onCommit={onCommit} onCancel={onCancel} />
    )
    const input = getByRole('textbox')
    fireEvent.change(input, { target: { value: 'new-file.md' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    // onCommit は async なので次のマイクロタスクまで待つ
    await vi.waitFor(() => {
      expect(onCommit).toHaveBeenCalledWith('new-file.md')
    })
  })

  it('Escape キーで onCancel が呼ばれる', () => {
    const onCommit = vi.fn().mockResolvedValue(null)
    const onCancel = vi.fn()
    const { getByRole } = render(
      <InlineInput depth={0} onCommit={onCommit} onCancel={onCancel} />
    )
    const input = getByRole('textbox')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
  })

  it('defaultValue が初期値として表示される', () => {
    const onCommit = vi.fn().mockResolvedValue(null)
    const onCancel = vi.fn()
    const { getByRole } = render(
      <InlineInput defaultValue="existing.md" depth={0} onCommit={onCommit} onCancel={onCancel} />
    )
    const input = getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('existing.md')
  })
})
