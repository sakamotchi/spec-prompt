import { GitBranch } from 'lucide-react'

interface BranchIndicatorProps {
  branch: string | null
}

export function BranchIndicator({ branch }: BranchIndicatorProps) {
  if (branch === null) return null
  return (
    <span
      className="flex min-w-0 items-center gap-1"
      title={branch}
    >
      <GitBranch size={14} />
      <span className="max-w-[240px] truncate">{branch}</span>
    </span>
  )
}
