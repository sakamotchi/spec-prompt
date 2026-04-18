import * as RadixContextMenu from '@radix-ui/react-context-menu'
import { MessageSquarePlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePromptPaletteStore } from '../../stores/promptPaletteStore'

const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iP(hone|od|ad)/.test(navigator.platform)

interface Props {
  children: React.ReactNode
  ptyId: string | null
  tabTitle: string
}

export function TerminalBodyContextMenu({ children, ptyId, tabTitle }: Props) {
  const { t } = useTranslation()
  const shortcut = IS_MAC ? '⌘⇧P' : 'Ctrl+⇧+P'
  const disabled = !ptyId

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
          <RadixContextMenu.Item
            disabled={disabled}
            onSelect={() => {
              if (!ptyId) return
              usePromptPaletteStore.getState().open(ptyId, tabTitle)
            }}
            className="flex items-center gap-2 px-3 h-7 cursor-pointer outline-none select-none text-xs"
            style={{
              color: disabled ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
              opacity: disabled ? 0.5 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => {
              if (disabled) return
              e.currentTarget.style.background = 'var(--color-accent)'
              e.currentTarget.style.color = '#fff'
            }}
            onMouseLeave={(e) => {
              if (disabled) return
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--color-text-primary)'
            }}
          >
            <MessageSquarePlus size={12} />
            <span className="flex-1">{t('promptPalette.menu.openPalette')}</span>
            <span
              className="ml-4 font-mono"
              style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}
            >
              {shortcut}
            </span>
          </RadixContextMenu.Item>
        </RadixContextMenu.Content>
      </RadixContextMenu.Portal>
    </RadixContextMenu.Root>
  )
}
