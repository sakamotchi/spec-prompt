import * as RadixContextMenu from '@radix-ui/react-context-menu'
import { FilePlus, FolderPlus, ExternalLink, SquareArrowOutUpRight, Pencil, Trash2, Check, ChevronRight, Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../stores/appStore'
import { usePathInsertion } from '../../hooks/usePathInsertion'
import { tauriApi } from '../../lib/tauriApi'
import {
  DOC_STATUS_COLOR,
  parseStatus,
  setStatus,
  type DocStatus,
} from '../../lib/frontmatter'

interface TreeContextMenuProps {
  path: string
  isDir: boolean
  children: React.ReactNode
  onNewFile: () => void
  onNewFolder: () => void
  onRename: () => void
  onDelete: () => void
  onOpenInEditor: () => void
  onOpenNewWindow?: () => void
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

const DOC_STATUSES: DocStatus[] = ['draft', 'reviewing', 'approved']

function StatusSubMenu({ path }: { path: string }) {
  const { t } = useTranslation()
  const docStatuses = useAppStore((s) => s.docStatuses)
  const setDocStatus = useAppStore((s) => s.setDocStatus)
  const current: DocStatus | null | undefined = docStatuses[path]

  const handleSelect = async (status: DocStatus) => {
    try {
      const content = await tauriApi.readFile(path)
      const updated = setStatus(content, status)
      await tauriApi.writeFile(path, updated)
      setDocStatus(path, parseStatus(updated))
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <RadixContextMenu.Sub>
      <RadixContextMenu.SubTrigger
        className={`${menuItemClass} justify-between`}
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
        <span>{t('contextMenu.status')}</span>
        <ChevronRight size={12} />
      </RadixContextMenu.SubTrigger>

      <RadixContextMenu.Portal>
        <RadixContextMenu.SubContent
          className="min-w-[140px] rounded py-1 shadow-lg z-50"
          style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border)',
          }}
          sideOffset={2}
        >
          {DOC_STATUSES.map((status) => (
            <RadixContextMenu.Item
              key={status}
              className={menuItemClass}
              style={{ color: 'var(--color-text-primary)' }}
              onSelect={() => handleSelect(status)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-accent)'
                e.currentTarget.style.color = '#fff'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--color-text-primary)'
              }}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: DOC_STATUS_COLOR[status] }}
              />
              <span className="flex-1">{t(`docStatus.${status}`)}</span>
              {current === status && <Check size={12} />}
            </RadixContextMenu.Item>
          ))}
        </RadixContextMenu.SubContent>
      </RadixContextMenu.Portal>
    </RadixContextMenu.Sub>
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
  onOpenNewWindow,
}: TreeContextMenuProps) {
  const { t } = useTranslation()
  const projectRoot = useAppStore((s) => s.projectRoot)
  const selectedFiles = useAppStore((s) => s.selectedFiles)
  const { insertPath } = usePathInsertion()

  const isMd = !isDir && /\.(md|mdx)$/i.test(path)

  const getRelativePath = () => {
    if (!projectRoot) return path
    const prefix = projectRoot.endsWith('/') ? projectRoot : projectRoot + '/'
    return path.startsWith(prefix) ? path.slice(prefix.length) : path
  }

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
            label={t('contextMenu.insertPath')}
          />

          {showInsertSelected && (
            <MenuItem
              onSelect={() => insertPath(selectedFiles)}
              icon={null}
              label={t('contextMenu.insertAll', { count: selectedFiles.length })}
            />
          )}

          <Separator />

          {/* パスをコピー */}
          <MenuItem
            onSelect={() => navigator.clipboard.writeText(getRelativePath())}
            icon={<Copy size={12} />}
            label={t('contextMenu.copyRelativePath')}
          />
          <MenuItem
            onSelect={() => navigator.clipboard.writeText(path)}
            icon={<Copy size={12} />}
            label={t('contextMenu.copyAbsolutePath')}
          />

          <Separator />

          {/* ファイル操作 */}
          <MenuItem
            onSelect={onNewFile}
            icon={<FilePlus size={12} />}
            label={t('contextMenu.newFile')}
          />
          <MenuItem
            onSelect={onNewFolder}
            icon={<FolderPlus size={12} />}
            label={t('contextMenu.newFolder')}
          />

          <Separator />

          <MenuItem
            onSelect={onOpenInEditor}
            icon={<ExternalLink size={12} />}
            label={isDir ? t('contextMenu.openInFinder') : t('contextMenu.openInEditor')}
          />
          {isDir && onOpenNewWindow && (
            <MenuItem
              onSelect={onOpenNewWindow}
              icon={<SquareArrowOutUpRight size={12} />}
              label={t('contextMenu.openInNewWindow')}
            />
          )}

          {isMd && (
            <>
              <Separator />
              <StatusSubMenu path={path} />
            </>
          )}

          <Separator />

          <MenuItem
            onSelect={onRename}
            icon={<Pencil size={12} />}
            label={t('contextMenu.rename')}
          />
          <MenuItem
            onSelect={onDelete}
            icon={<Trash2 size={12} />}
            label={t('contextMenu.delete')}
            danger
          />
        </RadixContextMenu.Content>
      </RadixContextMenu.Portal>
    </RadixContextMenu.Root>
  )
}
