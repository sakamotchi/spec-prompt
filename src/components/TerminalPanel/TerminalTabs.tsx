import { Plus, X } from 'lucide-react'
import { useTerminalStore } from '../../stores/terminalStore'
import { TerminalPanel } from './TerminalPanel'

export function TerminalTabs() {
  const tabs = useTerminalStore((s) => s.tabs)
  const activeTabId = useTerminalStore((s) => s.activeTabId)
  const addTab = useTerminalStore((s) => s.addTab)
  const closeTab = useTerminalStore((s) => s.closeTab)
  const setActiveTab = useTerminalStore((s) => s.setActiveTab)

  return (
    <div className="flex flex-col h-full">
      {/* タブバー */}
      <div
        className="flex items-center h-8 flex-shrink-0 border-b"
        style={{
          background: 'var(--color-bg-elevated)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="flex items-center flex-1 overflow-x-auto min-w-0">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-1.5 h-full px-3 text-xs flex-shrink-0 transition-colors outline-none group"
                style={{
                  color: isActive
                    ? 'var(--color-text-primary)'
                    : 'var(--color-text-muted)',
                  borderBottom: isActive
                    ? '2px solid var(--color-accent)'
                    : '2px solid transparent',
                }}
              >
                <span>{tab.title}</span>
                {tabs.length > 1 && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation()
                      closeTab(tab.id)
                    }}
                    className="flex items-center justify-center w-4 h-4 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
                  >
                    <X size={10} />
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* タブ追加ボタン */}
        <button
          onClick={addTab}
          className="flex items-center justify-center w-8 h-full flex-shrink-0 transition-colors outline-none"
          style={{ color: 'var(--color-text-muted)' }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = 'var(--color-text-primary)')
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = 'var(--color-text-muted)')
          }
          title="新しいターミナルを開く"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* ターミナルコンテンツ（全タブをレンダリング、非アクティブは非表示） */}
      <div className="flex-1 min-h-0 relative">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId
          return (
            <div
              key={tab.id}
              className="absolute inset-0 p-1"
              style={{ display: isActive ? 'flex' : 'none' }}
            >
              <TerminalPanel cwd="~" isActive={isActive} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
