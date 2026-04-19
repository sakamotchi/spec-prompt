import { useRef } from 'react'
import { useSettingsStore } from '../../stores/settingsStore'
import { toFontFamilyCSS } from '../../lib/fontFamily'
import { useTabScroll } from './useTabScroll'

export function PlainTextViewer({ tabId, content }: { tabId: string; content: string }) {
  const contentFontFamily = useSettingsStore((s) => s.contentFontFamily)
  const contentFontSize = useSettingsStore((s) => s.contentFontSize)
  const scrollRef = useRef<HTMLPreElement>(null)
  useTabScroll(tabId, scrollRef)

  return (
    <pre
      ref={scrollRef}
      className="h-full overflow-auto p-6 whitespace-pre-wrap break-words"
      style={{
        fontFamily: toFontFamilyCSS(contentFontFamily, 'sans-serif'),
        fontSize: `${contentFontSize}px`,
        color: 'var(--color-text-primary)',
        background: 'var(--color-bg-base)',
      }}
    >
      {content}
    </pre>
  )
}
