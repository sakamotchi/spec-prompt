import * as RadixContextMenu from '@radix-ui/react-context-menu'
import { X, ArrowRightFromLine, Columns, CircleX } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Props {
  children: React.ReactNode
  canClose: boolean
  canCloseToRight: boolean
  canCloseOthers: boolean
  onClose: () => void
  onCloseToRight: () => void
  onCloseOthers: () => void
  onCloseAll: () => void
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
      <span className="flex-1">{label}</span>
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

export function ContentTabContextMenu({
  children,
  canClose,
  canCloseToRight,
  canCloseOthers,
  onClose,
  onCloseToRight,
  onCloseOthers,
  onCloseAll,
}: Props) {
  const { t } = useTranslation()

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
            onSelect={onCloseToRight}
            icon={<ArrowRightFromLine size={12} />}
            label={t('content.tabMenu.closeToRight')}
            disabled={!canCloseToRight}
          />
          <MenuItem
            onSelect={onCloseOthers}
            icon={<Columns size={12} />}
            label={t('content.tabMenu.closeOthers')}
            disabled={!canCloseOthers}
          />
          <MenuItem
            onSelect={onCloseAll}
            icon={<CircleX size={12} />}
            label={t('content.tabMenu.closeAll')}
          />

          <Separator />

          <MenuItem
            onSelect={onClose}
            icon={<X size={12} />}
            label={t('content.tabMenu.close')}
            disabled={!canClose}
            danger
          />
        </RadixContextMenu.Content>
      </RadixContextMenu.Portal>
    </RadixContextMenu.Root>
  )
}
