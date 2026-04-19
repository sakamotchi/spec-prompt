export function StatusBar() {
  return (
    <div
      data-testid="status-bar"
      className="flex h-7 flex-shrink-0 items-center border-t px-3 text-xs"
      style={{
        background: 'var(--color-bg-elevated)',
        borderColor: 'var(--color-border)',
        color: 'var(--color-text-muted)',
      }}
    />
  )
}
