import { useEffect, useState } from 'react'
import { CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { subscribe, type ToastItem } from './toastBus'

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    return subscribe((item) => {
      setItems((prev) => [...prev, item])
      window.setTimeout(() => {
        setItems((prev) => prev.filter((i) => i.id !== item.id))
      }, 4000)
    })
  }, [])

  return (
    <div className="fixed right-4 bottom-4 z-[200] flex flex-col gap-2 pointer-events-none">
      {items.map((item) => {
        const Icon = item.kind === 'success' ? CheckCircle2 : item.kind === 'error' ? AlertCircle : Info
        const accent =
          item.kind === 'success'
            ? 'var(--color-accent)'
            : item.kind === 'error'
              ? '#f87171'
              : 'var(--color-text-muted)'
        return (
          <div
            key={item.id}
            role="status"
            className="flex items-start gap-2 px-3 py-2 rounded shadow-lg max-w-sm text-xs pointer-events-auto"
            style={{
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          >
            <Icon size={14} className="shrink-0 mt-0.5" style={{ color: accent }} />
            <span className="break-words">{item.message}</span>
          </div>
        )
      })}
    </div>
  )
}
