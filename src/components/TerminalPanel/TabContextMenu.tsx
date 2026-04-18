import * as RadixContextMenu from '@radix-ui/react-context-menu'
import { Pencil, RotateCcw, X, MessageSquarePlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Props {
  children: React.ReactNode
  pinned: boolean
  canClose: boolean
  onRename: () => void
  onUnpin: () => void
  onClose: () => void
  onOpenPromptPalette: () => void
}

const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iP(hone|od|ad)/.test(navigator.platform)

const menuItemClass =
  'flex items-center gap-2 px-3 h-7 cursor-pointer outline-none select-none text-xs'

function MenuItem({
  onSelect,
  icon,
  label,
  shortcut,
  disabled,
  danger,
}: {
  onSelect: () => void
  icon: React.ReactNode
  label: string
  shortcut?: string
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <RadixContextMenu.Item
      onSelect={disabled ? undefined : onSelect}
      disabled={disabled}
      className={menuItemClass}
      style={{
        color: disabled
          ? 'var(--color-text-muted)'
          : danger
          ? '#ef4444'
          : 'var(--color-text-primary)',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onMouseEnter={(e) => {
        if (disabled) return
        e.currentTarget.style.background = danger ? '#ef4444' : 'var(--color-accent)'
        e.currentTarget.style.color = '#fff'
      }}
      onMouseLeave={(e) => {
        if (disabled) return
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = danger ? '#ef4444' : 'var(--color-text-primary)'
      }}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span
          className="ml-4 font-mono"
          style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}
        >
          {shortcut}
        </span>
      )}
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

export function TabContextMenu({
  children,
  pinned,
  canClose,
  onRename,
  onUnpin,
  onClose,
  onOpenPromptPalette,
}: Props) {
  const { t } = useTranslation()
  const promptShortcut = IS_MAC ? '⌘⇧P' : 'Ctrl+⇧+P'

  return (
    <RadixContextMenu.Root>
      <RadixContextMenu.Trigger asChild>{children}</RadixContextMenu.Trigger>

      <RadixContextMenu.Portal>
        <RadixContextMenu.Content
          className="min-w-[220px] rounded py-1 shadow-lg z-50"
          style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border)',
          }}
        >
          <MenuItem
            onSelect={onOpenPromptPalette}
            icon={<MessageSquarePlus size={12} />}
            label={t('promptPalette.menu.openPalette')}
            shortcut={promptShortcut}
          />

          <Separator />

          <MenuItem
            onSelect={onRename}
            icon={<Pencil size={12} />}
            label={t('terminal.tabMenu.rename')}
          />
          <MenuItem
            onSelect={onUnpin}
            icon={<RotateCcw size={12} />}
            label={t('terminal.tabMenu.unpinTitle')}
            disabled={!pinned}
          />

          <Separator />

          <MenuItem
            onSelect={onClose}
            icon={<X size={12} />}
            label={t('terminal.tabMenu.close')}
            disabled={!canClose}
            danger
          />
        </RadixContextMenu.Content>
      </RadixContextMenu.Portal>
    </RadixContextMenu.Root>
  )
}
