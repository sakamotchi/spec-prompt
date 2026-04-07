import { useEffect, useRef, useState, useCallback } from 'react'
import { FileText, Terminal, Columns2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../stores/appStore'
import { TerminalTabs } from '../TerminalPanel'
import { ContentArea } from '../ContentView'

function SplitPaneHeader({
  label,
  icon,
  onClose,
}: {
  label: string
  icon: React.ReactNode
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <div
      className="flex items-center justify-between h-9 px-3 flex-shrink-0"
      style={{
        background: 'var(--color-bg-elevated)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <span
        className="flex items-center gap-1.5 text-sm"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {icon}
        {label}
      </span>
      <button
        onClick={onClose}
        className="flex items-center justify-center w-6 h-6 rounded transition-colors hover:bg-white/10 outline-none"
        style={{ color: 'var(--color-text-muted)' }}
        title={t('mainArea.tooltip.disableSplit')}
      >
        <X size={13} />
      </button>
    </div>
  )
}

export function MainArea() {
  const { t } = useTranslation()
  const mainLayout = useAppStore((s) => s.mainLayout)
  const activeMainTab = useAppStore((s) => s.activeMainTab)
  const setActiveMainTab = useAppStore((s) => s.setActiveMainTab)
  const toggleMainLayout = useAppStore((s) => s.toggleMainLayout)

  const isSplit = mainLayout === 'split'

  const [splitSize, setSplitSize] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  // Ctrl+Tab / Ctrl+\ ショートカット
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Tab' && !isSplit) {
        e.preventDefault()
        setActiveMainTab(activeMainTab === 'content' ? 'terminal' : 'content')
      }
      if (e.ctrlKey && e.key === '\\') {
        e.preventDefault()
        toggleMainLayout()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [activeMainTab, isSplit, setActiveMainTab, toggleMainLayout])

  // タブモードに戻ったらリサイズ値をリセット
  useEffect(() => {
    if (!isSplit) setSplitSize(null)
  }, [isSplit])

  const onSeparatorMouseDown = useCallback(() => {
    isDragging.current = true
    document.body.style.userSelect = 'none'

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const newSize = e.clientX - rect.left
      setSplitSize(Math.min(rect.width - 200, Math.max(200, newSize)))
    }

    const onMouseUp = () => {
      isDragging.current = false
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [])

  const contentNode = <ContentArea />

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-base)]">
      {/* タブバー */}
      <div
        className="flex items-center h-9 flex-shrink-0"
        style={{
          background: 'var(--color-bg-elevated)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        {!isSplit && (
          <>
            {(['content', 'terminal'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveMainTab(tab)}
                className="flex items-center gap-1.5 h-full px-4 text-sm transition-colors outline-none"
                style={{
                  color:
                    activeMainTab === tab
                      ? 'var(--color-text-primary)'
                      : 'var(--color-text-muted)',
                  borderBottom:
                    activeMainTab === tab
                      ? '2px solid var(--color-accent)'
                      : '2px solid transparent',
                }}
              >
                {tab === 'content' ? <FileText size={14} /> : <Terminal size={14} />}
                {tab === 'content' ? t('mainArea.tab.content') : t('mainArea.tab.terminal')}
              </button>
            ))}
          </>
        )}
        <div className="ml-auto flex items-center pr-2">
          <button
            onClick={toggleMainLayout}
            title={t('mainArea.tooltip.splitView')}
            className="flex items-center justify-center w-7 h-7 rounded transition-colors outline-none hover:bg-white/10"
            style={{ color: isSplit ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
          >
            <Columns2 size={14} />
          </button>
        </div>
      </div>

      {/* コンテンツエリア — TerminalTabs は常にここに固定マウント */}
      <div ref={containerRef} className="flex flex-1 min-h-0">
        {/* コンテンツペイン */}
        <div
          className="flex flex-col min-w-0 overflow-hidden"
          style={{
            display: isSplit || activeMainTab === 'content' ? 'flex' : 'none',
            flex: isSplit && splitSize != null ? '0 0 auto' : 1,
            width: isSplit && splitSize != null ? `${splitSize}px` : undefined,
          }}
        >
          {isSplit && (
            <SplitPaneHeader
              label={t('mainArea.header.content')}
              icon={<FileText size={14} />}
              onClose={toggleMainLayout}
            />
          )}
          <div className="flex-1 min-h-0 overflow-hidden">{contentNode}</div>
        </div>

        {/* セパレーター (Split時のみ) */}
        {isSplit && (
          <div
            className="w-1 flex-shrink-0 cursor-col-resize transition-colors"
            style={{ background: 'var(--color-border)' }}
            onMouseDown={onSeparatorMouseDown}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = 'var(--color-accent)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = 'var(--color-border)')
            }
          />
        )}

        {/* ターミナルペイン — 常に同じツリー位置でマウント */}
        <div
          className="flex flex-col flex-1 min-w-0 overflow-hidden"
          style={{
            display: isSplit || activeMainTab === 'terminal' ? 'flex' : 'none',
          }}
        >
          {isSplit && (
            <SplitPaneHeader
              label={t('mainArea.header.terminal')}
              icon={<Terminal size={14} />}
              onClose={toggleMainLayout}
            />
          )}
          <div className="flex-1 min-h-0 overflow-hidden">
            <TerminalTabs />
          </div>
        </div>
      </div>
    </div>
  )
}
