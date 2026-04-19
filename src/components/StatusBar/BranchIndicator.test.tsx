import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BranchIndicator } from './BranchIndicator'

describe('BranchIndicator', () => {
  it('ブランチ名を表示する', () => {
    render(<BranchIndicator branch="feature/xyz" />)
    expect(screen.getByText('feature/xyz')).toBeInTheDocument()
  })

  it('branch が null のとき何も描画しない', () => {
    const { container } = render(<BranchIndicator branch={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('title 属性にブランチ名を設定する', () => {
    render(<BranchIndicator branch="long/branch/name" />)
    expect(screen.getByTitle('long/branch/name')).toBeInTheDocument()
  })
})
