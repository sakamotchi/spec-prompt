import * as AlertDialog from '@radix-ui/react-alert-dialog'

interface DeleteDialogProps {
  open: boolean
  name: string
  isDir: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteDialog({ open, name, isDir, onConfirm, onCancel }: DeleteDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.5)' }}
        />
        <AlertDialog.Content
          className="fixed left-1/2 top-1/3 z-50 w-[420px] max-w-[90vw] rounded-lg shadow-2xl p-5"
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
            {isDir ? 'フォルダを削除' : 'ファイルを削除'}
          </AlertDialog.Title>

          <AlertDialog.Description
            className="text-xs mb-4"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <span style={{ color: 'var(--color-text-primary)' }}>{name}</span>
            {isDir
              ? ' を削除します。フォルダ内のファイルもすべて削除されます。この操作は取り消せません。'
              : ' を削除します。この操作は取り消せません。'}
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
                キャンセル
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                onClick={onConfirm}
                className="text-xs px-3 h-7 rounded cursor-pointer bg-red-600 text-white"
              >
                削除
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
