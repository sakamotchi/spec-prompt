import * as RadixContextMenu from '@radix-ui/react-context-menu'
import { Pencil, RotateCcw, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Props {
  children: React.ReactNode
  pinned: boolean
  canClose: boolean
  onRename: () => void
  onUnpin: () => void
  onClose: () => void
}

const menuItemClass =
  'flex items-center gap-2 px-3 h-7 cursor-pointer outline-none select-none text-xs'

function MenuItem({
  onSelect,
  icon,
  label,
  disabled,
  danger,
}: {
  onSelect: () => void
  icon: React.ReactNode
  label: string
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

export function TabContextMenu({
  children,
  pinned,
  canClose,
  onRename,
  onUnpin,
  onClose,
}: Props) {
  const { t } = useTranslation()

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
