import { useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useTranslation } from 'react-i18next'
import { useContentStore } from '../../stores/contentStore'
import { getViewMode } from '../../lib/viewMode'
import { MarkdownPreview } from './MarkdownPreview'
import { CodeViewer } from './CodeViewer'
import { ImageViewer } from './ImageViewer'
import { PlainTextViewer } from './PlainTextViewer'

interface ContentViewProps {
  tabId: string
}

export function ContentView({ tabId }: ContentViewProps) {
  const { t } = useTranslation()
  const tab = useContentStore(
    (s) =>
      s.primary.tabs.find((t) => t.id === tabId) ??
      s.secondary.tabs.find((t) => t.id === tabId)
  )
  const setTabContent = useContentStore((s) => s.setTabContent)
  const setTabLoading = useContentStore((s) => s.setTabLoading)

  // ファイル読み込み（content が null のときだけ実行）
  // 画像は asset プロトコル経由で <img> が直接読むため、テキスト読み込みはスキップする。
  useEffect(() => {
    if (!tab?.filePath || tab.content !== null) return
    const mode = getViewMode(tab.filePath)
    if (mode === 'image') {
      setTabContent(tabId, tab.filePath, '', mode)
      return
    }
    invoke<string>('read_file', { path: tab.filePath })
      .then((text) => setTabContent(tabId, tab.filePath!, text, mode))
      .catch((err) => {
        console.error('read_file failed:', err)
        setTabLoading(tabId, false)
      })
  }, [tab?.filePath, tab?.content, tabId, setTabContent, setTabLoading])

  if (!tab?.filePath || tab.content === null) {
    return (
      <div
        className="flex items-center justify-center h-full text-sm"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {tab?.isLoading ? t('content.loading') : t('content.empty')}
      </div>
    )
  }

  if (tab.viewMode === 'markdown') return <MarkdownPreview tabId={tabId} content={tab.content} filePath={tab.filePath ?? undefined} />
  if (tab.viewMode === 'code') return <CodeViewer tabId={tabId} content={tab.content} filePath={tab.filePath} />
  if (tab.viewMode === 'image') return <ImageViewer filePath={tab.filePath} />
  return <PlainTextViewer tabId={tabId} content={tab.content} />
}
