import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { useTranslation } from 'react-i18next'

interface ConfirmDropDialogProps {
  open: boolean
  operation: 'move' | 'copy'
  count: number
  destDir: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDropDialog({
  open,
  operation,
  count,
  destDir,
  onConfirm,
  onCancel,
}: ConfirmDropDialogProps) {
  const { t } = useTranslation()
  const title = operation === 'move' ? t('dnd.confirm.moveTitle') : t('dnd.confirm.copyTitle')
  const desc =
    operation === 'move'
      ? t('dnd.confirm.moveDesc', { count, dest: destDir })
      : t('dnd.confirm.copyDesc', { count, dest: destDir })

  return (
    <AlertDialog.Root open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.5)' }}
        />
        <AlertDialog.Content
          className="fixed left-1/2 top-1/3 z-50 w-[460px] max-w-[90vw] rounded-lg shadow-2xl p-5"
          style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border)',
            transform: 'translateX(-50%)',
          }}
        >
          <AlertDialog.Title
            className="text-sm font-semibold mb-2"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {title}
          </AlertDialog.Title>

          <AlertDialog.Description
            className="text-xs mb-4 break-all"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {desc}
          </AlertDialog.Description>

          <div className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <button
                className="text-xs px-3 h-7 rounded cursor-pointer"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
              >
                {t('dnd.confirm.cancel')}
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                onClick={onConfirm}
                className="text-xs px-3 h-7 rounded cursor-pointer text-white"
                style={{ background: 'var(--color-accent)' }}
              >
                {t('dnd.confirm.execute')}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
