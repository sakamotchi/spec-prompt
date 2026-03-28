import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SplitPane } from './SplitPane'

describe('SplitPane', () => {
  it('子要素が2つレンダリングされる', () => {
    const { getByText } = render(
      <SplitPane direction="horizontal">
        <div>left</div>
        <div>right</div>
      </SplitPane>
    )
    expect(getByText('left')).toBeTruthy()
    expect(getByText('right')).toBeTruthy()
  })

  it('direction=vertical でもレンダリングされる', () => {
    const { getByText } = render(
      <SplitPane direction="vertical">
        <div>top</div>
        <div>bottom</div>
      </SplitPane>
    )
    expect(getByText('top')).toBeTruthy()
    expect(getByText('bottom')).toBeTruthy()
  })
})
