import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { SHORTCUT_DEFS, type ShortcutCategory } from '../../lib/shortcuts'

const CATEGORY_ORDER: ShortcutCategory[] = [
  'ペイン切り替え',
  'タブ操作',
  '分割表示',
  'フォーカス移動',
  'その他',
]

interface ShortcutsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ShortcutsModal({ open, onOpenChange }: ShortcutsModalProps) {
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: SHORTCUT_DEFS.filter((d) => d.category === cat),
  })).filter((g) => g.items.length > 0)

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[400px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-xl focus:outline-none"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
            <Dialog.Title className="text-sm font-semibold text-[var(--color-text-primary)]">
              キーボードショートカット
            </Dialog.Title>
            <Dialog.Close className="p-1 rounded hover:bg-[var(--color-bg-panel)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
              <X size={14} />
            </Dialog.Close>
          </div>

          <div className="px-5 py-4 flex flex-col gap-5 max-h-[70vh] overflow-y-auto">
            {grouped.map(({ category, items }) => (
              <section key={category}>
                <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                  {category}
                </h3>
                <div className="flex flex-col gap-1">
                  {items.map((def) => (
                    <div
                      key={def.label}
                      className="flex items-center justify-between gap-4"
                    >
                      <span className="text-xs text-[var(--color-text-primary)]">
                        {def.label}
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {def.keys.map((k, i) => (
                          <kbd
                            key={i}
                            className="px-1.5 py-0.5 text-xs rounded border border-[var(--color-border)] bg-[var(--color-bg-panel)] text-[var(--color-text-muted)] font-mono"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
