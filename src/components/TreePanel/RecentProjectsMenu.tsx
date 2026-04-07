import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, Check, FolderOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface RecentProjectsMenuProps {
  projectName: string | null
  recentProjects: string[]
  currentProject: string | null
  onSelect: (path: string) => void
}

const itemClass =
  'flex items-center gap-2 px-3 h-7 cursor-pointer outline-none select-none text-xs'

export function RecentProjectsMenu({
  projectName,
  recentProjects,
  currentProject,
  onSelect,
}: RecentProjectsMenuProps) {
  const { t } = useTranslation()
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="flex items-center gap-1 text-xs truncate max-w-[140px] outline-none rounded px-1 hover:bg-[var(--color-bg-elevated)] transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
          title={currentProject ?? undefined}
        >
          <span className="truncate">{projectName ?? t('recentProjects.defaultName')}</span>
          <ChevronDown size={10} className="shrink-0" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[220px] max-w-[320px] rounded py-1 shadow-lg z-50"
          style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border)',
          }}
          sideOffset={4}
          align="start"
        >
          <DropdownMenu.Label
            className="px-3 h-6 flex items-center text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {t('recentProjects.label')}
          </DropdownMenu.Label>

          {recentProjects.length === 0 ? (
            <div
              className="px-3 h-7 flex items-center text-xs"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {t('recentProjects.empty')}
            </div>
          ) : (
            <>
              <DropdownMenu.Separator
                className="h-px my-1"
                style={{ background: 'var(--color-border)' }}
              />
              {recentProjects.map((path) => {
                const name = path.split('/').pop() ?? path
                const isCurrent = path === currentProject
                return (
                  <DropdownMenu.Item
                    key={path}
                    className={itemClass}
                    style={{ color: 'var(--color-text-primary)' }}
                    onSelect={() => onSelect(path)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--color-accent)'
                      e.currentTarget.style.color = '#fff'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = 'var(--color-text-primary)'
                    }}
                  >
                    <FolderOpen size={12} className="shrink-0" />
                    <span className="truncate flex-1" title={path}>{name}</span>
                    {isCurrent && <Check size={12} className="shrink-0" />}
                  </DropdownMenu.Item>
                )
              })}
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
