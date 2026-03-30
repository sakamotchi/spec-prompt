import { useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { watch } from '@tauri-apps/plugin-fs'
import { useAppStore } from '../../stores/appStore'
import { useContentStore } from '../../stores/contentStore'
import { getViewMode } from '../../lib/viewMode'
import { MarkdownPreview } from './MarkdownPreview'
import { CodeViewer } from './CodeViewer'
import { PlainTextViewer } from './PlainTextViewer'

export function ContentView() {
  const selectedFile = useAppStore((s) => s.selectedFile)
  const projectRoot = useAppStore((s) => s.projectRoot)
  const { filePath, content, viewMode, setFile, setLoading } = useContentStore()
  const filePathRef = useRef(filePath)
  const setFileRef = useRef(setFile)

  // ref を常に最新に保つ
  useEffect(() => {
    filePathRef.current = filePath
    setFileRef.current = setFile
  })

  // ファイル選択時の読み込み
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

  // ファイル変更時の自動再読み込み
  // filePath を依存配列に含めないことで、ファイル切替のたびに watch を再登録しない
  useEffect(() => {
    if (!projectRoot) return

    let unlisten: (() => void) | null = null

    watch(
      projectRoot,
      (event) => {
        const fp = filePathRef.current
        if (!fp) return
        const matched = event.paths.some((p) => p === fp || p.endsWith(fp) || fp.endsWith(p))
        if (matched) {
          invoke<string>('read_file', { path: fp })
            .then((text) => setFileRef.current(fp, text, getViewMode(fp)))
            .catch(console.error)
        }
      },
      { recursive: true, delayMs: 300 },
    )
      .then((fn) => {
        unlisten = fn
      })
      .catch(console.error)

    return () => {
      unlisten?.()
    }
  }, [projectRoot])

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
