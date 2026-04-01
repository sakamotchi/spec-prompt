import * as RadixContextMenu from '@radix-ui/react-context-menu'
import { FilePlus, FolderPlus, ExternalLink, Pencil, Trash2 } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { usePathInsertion } from '../../hooks/usePathInsertion'

interface TreeContextMenuProps {
  path: string
  isDir: boolean
  children: React.ReactNode
  onNewFile: () => void
  onNewFolder: () => void
  onRename: () => void
  onDelete: () => void
  onOpenInEditor: () => void
}

const menuItemClass =
  'flex items-center gap-2 px-3 h-7 cursor-pointer outline-none select-none text-xs'

function MenuItem({
  onSelect,
  icon,
  label,
  danger,
}: {
  onSelect: () => void
  icon: React.ReactNode
  label: string
  danger?: boolean
}) {
  return (
    <RadixContextMenu.Item
      onSelect={onSelect}
      className={menuItemClass}
      style={{ color: danger ? '#ef4444' : 'var(--color-text-primary)' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? '#ef4444' : 'var(--color-accent)'
        e.currentTarget.style.color = '#fff'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = danger ? '#ef4444' : 'var(--color-text-primary)'
      }}
    >
      {icon}
      {label}
    </RadixContextMenu.Item>
  )
}

function Separator() {
  return (
    <RadixContextMenu.Separator
      className="h-px my-1"
      style={{ background: 'var(--color-border)' }}
    />
  )
}

export function TreeContextMenu({
  path,
  isDir,
  children,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
  onOpenInEditor,
}: TreeContextMenuProps) {
  const selectedFiles = useAppStore((s) => s.selectedFiles)
  const { insertPath } = usePathInsertion()

  const handleInsertPath = () => {
    if (selectedFiles.length > 1 && selectedFiles.includes(path)) {
      insertPath(selectedFiles)
    } else {
      insertPath(path)
    }
  }

  const showInsertSelected = selectedFiles.length > 1 && selectedFiles.includes(path)

  return (
    <RadixContextMenu.Root>
      <RadixContextMenu.Trigger asChild>{children}</RadixContextMenu.Trigger>

      <RadixContextMenu.Portal>
        <RadixContextMenu.Content
          className="min-w-[180px] rounded py-1 shadow-lg z-50"
          style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border)',
          }}
        >
          {/* パス挿入 */}
          <MenuItem
            onSelect={handleInsertPath}
            icon={null}
            label="パスをターミナルに挿入"
          />

          {showInsertSelected && (
            <MenuItem
              onSelect={() => insertPath(selectedFiles)}
              icon={null}
              label={`選択中 ${selectedFiles.length} 件をすべて挿入`}
            />
          )}

          <Separator />

          {/* ファイル操作 */}
          <MenuItem
            onSelect={onNewFile}
            icon={<FilePlus size={12} />}
            label="新規ファイル"
          />
          <MenuItem
            onSelect={onNewFolder}
            icon={<FolderPlus size={12} />}
            label="新規フォルダ"
          />

          <Separator />

          <MenuItem
            onSelect={onOpenInEditor}
            icon={<ExternalLink size={12} />}
            label={isDir ? 'Finderで開く' : '外部エディタで開く'}
          />

          <Separator />

          <MenuItem
            onSelect={onRename}
            icon={<Pencil size={12} />}
            label="リネーム"
          />
          <MenuItem
            onSelect={onDelete}
            icon={<Trash2 size={12} />}
            label="削除"
            danger
          />
        </RadixContextMenu.Content>
      </RadixContextMenu.Portal>
    </RadixContextMenu.Root>
  )
}
