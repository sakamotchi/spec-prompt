import { TerminalTabs } from '../TerminalPanel'
import { MainTabs } from './MainTabs'

export function MainArea() {
  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-base)]">
      <MainTabs
        children={{
          content: (
            <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-sm">
              コンテンツビューア（Phase 2-A で実装）
            </div>
          ),
          terminal: <TerminalTabs />,
        }}
      />
    </div>
  )
}
