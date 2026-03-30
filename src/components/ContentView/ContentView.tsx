import { useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useAppStore } from '../../stores/appStore'
import { useContentStore } from '../../stores/contentStore'
import { getViewMode } from '../../lib/viewMode'
import { MarkdownPreview } from './MarkdownPreview'
import { CodeViewer } from './CodeViewer'
import { PlainTextViewer } from './PlainTextViewer'

export function ContentView() {
  const selectedFile = useAppStore((s) => s.selectedFile)
  const { filePath, content, viewMode, setFile, setLoading } = useContentStore()

  useEffect(() => {
    if (!selectedFile) return
    if (selectedFile === filePath) return

    setLoading(true)
    invoke<string>('read_file', { path: selectedFile })
      .then((text) => {
        setFile(selectedFile, text, getViewMode(selectedFile))
      })
      .catch((err) => {
        console.error('read_file failed:', err)
        setLoading(false)
      })
  }, [selectedFile, filePath, setFile, setLoading])

  if (!selectedFile || content === null) {
    return (
      <div
        className="flex items-center justify-center h-full text-sm"
        style={{ color: 'var(--color-text-muted)' }}
      >
        ファイルを選択してください
      </div>
    )
  }

  if (viewMode === 'markdown') return <MarkdownPreview content={content} />
  if (viewMode === 'code') return <CodeViewer content={content} filePath={filePath!} />
  return <PlainTextViewer content={content} />
}
