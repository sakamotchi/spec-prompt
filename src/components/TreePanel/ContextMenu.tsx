import * as RadixContextMenu from '@radix-ui/react-context-menu'
import { useAppStore } from '../../stores/appStore'
import { usePathInsertion } from '../../hooks/usePathInsertion'

interface TreeContextMenuProps {
  path: string
  children: React.ReactNode
}

export function TreeContextMenu({ path, children }: TreeContextMenuProps) {
  const selectedFiles = useAppStore((s) => s.selectedFiles)
  const { insertPath } = usePathInsertion()

  const handleInsertPath = () => {
    if (selectedFiles.length > 1 && selectedFiles.includes(path)) {
      insertPath(selectedFiles)
    } else {
      insertPath(path)
    }
  }

  const handleInsertSelected = () => {
    insertPath(selectedFiles)
  }

  const showInsertSelected = selectedFiles.length > 1 && selectedFiles.includes(path)

  return (
    <RadixContextMenu.Root>
      <RadixContextMenu.Trigger asChild>{children}</RadixContextMenu.Trigger>

      <RadixContextMenu.Portal>
        <RadixContextMenu.Content
          className="min-w-[180px] rounded py-1 shadow-lg z-50 text-xs"
          style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border)',
          }}
        >
          <RadixContextMenu.Item
            onSelect={handleInsertPath}
            className="flex items-center px-3 h-7 cursor-pointer outline-none select-none"
            style={{ color: 'var(--color-text-primary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--color-accent)'
              e.currentTarget.style.color = '#fff'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--color-text-primary)'
            }}
          >
            パスをターミナルに挿入
          </RadixContextMenu.Item>

          {showInsertSelected && (
            <>
              <RadixContextMenu.Separator
                className="h-px my-1"
                style={{ background: 'var(--color-border)' }}
              />
              <RadixContextMenu.Item
                onSelect={handleInsertSelected}
                className="flex items-center px-3 h-7 cursor-pointer outline-none select-none"
                style={{ color: 'var(--color-text-primary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-accent)'
                  e.currentTarget.style.color = '#fff'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--color-text-primary)'
                }}
              >
                選択中 {selectedFiles.length} 件をすべて挿入
              </RadixContextMenu.Item>
            </>
          )}
        </RadixContextMenu.Content>
      </RadixContextMenu.Portal>
    </RadixContextMenu.Root>
  )
}
