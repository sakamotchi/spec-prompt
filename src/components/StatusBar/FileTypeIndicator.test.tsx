import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FileTypeIndicator } from './FileTypeIndicator'
import { useAppStore } from '../../stores/appStore'
import { useContentStore } from '../../stores/contentStore'

function makeTab(filePath: string | null = null) {
  return {
    id: crypto.randomUUID(),
    filePath,
    content: null,
    viewMode: 'plain' as const,
    isLoading: false,
    scrollTop: 0,
  }
}

function setContentState(
  primaryPath: string | null,
  secondaryPath: string | null = null,
  focusedPane: 'primary' | 'secondary' = 'primary',
) {
  const p = makeTab(primaryPath)
  const s = makeTab(secondaryPath)
  useContentStore.setState({
    primary: { tabs: [p], activeTabId: p.id },
    secondary: { tabs: [s], activeTabId: s.id },
    splitEnabled: false,
    focusedPane,
  })
}

describe('FileTypeIndicator', () => {
  beforeEach(() => {
    useAppStore.setState({ activeMainTab: 'content' })
    setContentState(null)
  })

  it('Markdown ファイルで Markdown ラベルを表示する', () => {
    setContentState('/tmp/doc.md')
    render(<FileTypeIndicator />)
    expect(screen.getByText('Markdown')).toBeInTheDocument()
  })

  it('コードファイル (.ts) で Code ラベルを表示する', () => {
    setContentState('/tmp/app.ts')
    render(<FileTypeIndicator />)
    expect(screen.getByText('Code')).toBeInTheDocument()
  })

  it('ターミナルモード時は何も描画しない', () => {
    setContentState('/tmp/doc.md')
    useAppStore.setState({ activeMainTab: 'terminal' })
    const { container } = render(<FileTypeIndicator />)
    expect(container.firstChild).toBeNull()
  })

  it('filePath が null のとき何も描画しない', () => {
    setContentState(null)
    const { container } = render(<FileTypeIndicator />)
    expect(container.firstChild).toBeNull()
  })

  it('focusedPane=secondary のとき secondary 側の filePath を使う', () => {
    setContentState('/tmp/a.md', '/tmp/b.ts', 'secondary')
    render(<FileTypeIndicator />)
    expect(screen.getByText('Code')).toBeInTheDocument()
  })
})
