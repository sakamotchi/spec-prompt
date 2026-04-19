import { useAppStore } from '../../stores/appStore'
import { useGitBranch } from '../../hooks/useGitBranch'
import { BranchIndicator } from './BranchIndicator'
import { FileTypeIndicator } from './FileTypeIndicator'

export function StatusBar() {
  const projectRoot = useAppStore((s) => s.projectRoot)
  const { branch } = useGitBranch(projectRoot)

  return (
    <div
      data-testid="status-bar"
      className="flex h-7 flex-shrink-0 items-center justify-between gap-4 border-t px-3 text-xs"
      style={{
        background: 'var(--color-bg-elevated)',
        borderColor: 'var(--color-border)',
        color: 'var(--color-text-muted)',
      }}
    >
      <BranchIndicator branch={branch} />
      <FileTypeIndicator />
    </div>
  )
}
