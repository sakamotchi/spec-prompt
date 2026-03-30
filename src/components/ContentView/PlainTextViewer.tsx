export function PlainTextViewer({ content }: { content: string }) {
  return (
    <pre
      className="h-full overflow-auto p-6 text-sm whitespace-pre-wrap break-words"
      style={{
        fontFamily: "'Geist Mono', monospace",
        color: 'var(--color-text-primary)',
        background: 'var(--color-bg-base)',
      }}
    >
      {content}
    </pre>
  )
}
