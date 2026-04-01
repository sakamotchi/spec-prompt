import { useEffect, useState } from 'react'
import { SplitPane } from '../SplitPane'
import { MainArea } from '../MainArea'
import { TreePanel } from '../TreePanel'
import { PathPalette } from '../PathPalette'

export function AppLayout() {
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault()
        setPaletteOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex h-full w-full bg-[var(--color-bg-base)]">
      <SplitPane direction="horizontal" defaultSize={240} minSize={160} maxSize={480}>
        <TreePanel />
        <MainArea />
      </SplitPane>

      <PathPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
