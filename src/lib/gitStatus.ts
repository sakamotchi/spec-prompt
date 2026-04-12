import type { GitFileStatus } from './tauriApi'

const COLOR = {
  modified_unstaged: '#e2c08d',
  modified_staged:   '#73c991',
  added:             '#73c991',
  untracked:         '#73c991',
  deleted:           '#c74e39',
  conflict:          '#e5c07b',
}

export function getGitColor(status: GitFileStatus | undefined): string | undefined {
  if (!status) return undefined
  // unstaged が優先（ワーキングツリーの変更が最も目立つべき）
  if (status.unstaged === 'M') return COLOR.modified_unstaged
  if (status.unstaged === 'D') return COLOR.deleted
  if (status.staged === '?' || status.unstaged === '?') return COLOR.untracked
  if (status.staged === 'A') return COLOR.added
  if (status.staged === 'M') return COLOR.modified_staged
  if (status.staged === 'D') return COLOR.deleted
  if (status.staged === 'R') return COLOR.added
  if (status.staged === 'U' || status.unstaged === 'U') return COLOR.conflict
  return undefined
}

export function getGitBadge(status: GitFileStatus | undefined): string | undefined {
  if (!status) return undefined
  if (status.staged === '?' || status.unstaged === '?') return 'U'
  if (status.unstaged === 'M') return 'M'
  if (status.unstaged === 'D') return 'D'
  if (status.staged === 'A') return 'A'
  if (status.staged === 'M') return 'M'
  if (status.staged === 'D') return 'D'
  if (status.staged === 'R') return 'R'
  if (status.staged === 'U' || status.unstaged === 'U') return 'C'
  return undefined
}

export function getDirGitColor(
  dirPath: string,
  gitStatuses: Record<string, GitFileStatus>,
): string | undefined {
  const prefix = dirPath + '/'
  for (const [path, status] of Object.entries(gitStatuses)) {
    if (path.startsWith(prefix)) {
      const color = getGitColor(status)
      if (color) return color
    }
  }
  return undefined
}
