import { Code, File, FileText, Image } from 'lucide-react'
import type { ComponentType } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useContentStore } from '../../stores/contentStore'
import { getViewMode, type ViewMode } from '../../lib/viewMode'

const LABELS: Record<ViewMode, string> = {
  markdown: 'Markdown',
  code: 'Code',
  image: 'Image',
  plain: 'Plain',
}

const ICONS: Record<ViewMode, ComponentType<{ size?: number }>> = {
  markdown: FileText,
  code: Code,
  image: Image,
  plain: File,
}

export function FileTypeIndicator() {
  const activeMainTab = useAppStore((s) => s.activeMainTab)
  const focusedPane = useContentStore((s) => s.focusedPane)
  const filePath = useContentStore((s) => {
    const group = s[focusedPane]
    const tab = group.tabs.find((t) => t.id === group.activeTabId)
    return tab?.filePath ?? null
  })

  if (activeMainTab !== 'content') return null
  if (filePath === null) return null

  const mode = getViewMode(filePath)
  const Icon = ICONS[mode]

  return (
    <span className="flex items-center gap-1">
      <Icon size={14} />
      <span>{LABELS[mode]}</span>
    </span>
  )
}
