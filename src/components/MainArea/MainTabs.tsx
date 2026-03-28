import { useEffect } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { FileText, Terminal } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'

interface MainTabsProps {
  children: {
    content: React.ReactNode
    terminal: React.ReactNode
  }
}

export function MainTabs({ children }: MainTabsProps) {
  const activeMainTab = useAppStore((s) => s.activeMainTab)
  const setActiveMainTab = useAppStore((s) => s.setActiveMainTab)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault()
        setActiveMainTab(activeMainTab === 'content' ? 'terminal' : 'content')
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [activeMainTab, setActiveMainTab])

  return (
    <Tabs.Root
      value={activeMainTab}
      onValueChange={(v) => setActiveMainTab(v as 'content' | 'terminal')}
      className="flex flex-col h-full"
    >
      {/* タブバー */}
      <Tabs.List className="flex items-center h-9 flex-shrink-0 bg-[var(--color-bg-elevated)] border-b border-[var(--color-border)]">
        <Tabs.Trigger
          value="content"
          className={[
            'flex items-center gap-1.5 h-full px-4 text-sm transition-colors',
            'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
            'data-[state=active]:text-[var(--color-text-primary)]',
            'data-[state=active]:border-b-2 data-[state=active]:border-[var(--color-accent)]',
            'outline-none',
          ].join(' ')}
        >
          <FileText size={14} />
          コンテンツ
        </Tabs.Trigger>
        <Tabs.Trigger
          value="terminal"
          className={[
            'flex items-center gap-1.5 h-full px-4 text-sm transition-colors',
            'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
            'data-[state=active]:text-[var(--color-text-primary)]',
            'data-[state=active]:border-b-2 data-[state=active]:border-[var(--color-accent)]',
            'outline-none',
          ].join(' ')}
        >
          <Terminal size={14} />
          ターミナル
        </Tabs.Trigger>
      </Tabs.List>

      {/* コンテンツエリア */}
      <Tabs.Content value="content" className="flex-1 overflow-hidden min-h-0">
        {children.content}
      </Tabs.Content>
      <Tabs.Content value="terminal" className="flex-1 overflow-hidden min-h-0">
        {children.terminal}
      </Tabs.Content>
    </Tabs.Root>
  )
}
