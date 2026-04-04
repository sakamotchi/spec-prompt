import { useSettingsStore } from '../../stores/settingsStore'
import { toFontFamilyCSS } from '../../lib/fontFamily'

export function PlainTextViewer({ content }: { content: string }) {
  const contentFontFamily = useSettingsStore((s) => s.contentFontFamily)
  const contentFontSize = useSettingsStore((s) => s.contentFontSize)

  return (
    <pre
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
