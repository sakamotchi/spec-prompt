import { useEffect, useState } from 'react'
import { tauriApi } from '../lib/tauriApi'

export interface UseGitBranchResult {
  branch: string | null
  loading: boolean
}

const POLL_INTERVAL_MS = 3000

export function useGitBranch(cwd: string | null): UseGitBranchResult {
  const [branch, setBranch] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!cwd) {
      setBranch(null)
      setLoading(false)
      return
    }

    let disposed = false
    let timer: ReturnType<typeof setInterval> | null = null

    const fetchBranch = async () => {
      try {
        const next = await tauriApi.getBranch(cwd)
        if (!disposed) setBranch(next)
      } catch {
        if (!disposed) setBranch(null)
      }
    }

    setLoading(true)
    void fetchBranch().finally(() => {
      if (!disposed) setLoading(false)
    })

    timer = setInterval(() => {
      void fetchBranch()
    }, POLL_INTERVAL_MS)

    return () => {
      disposed = true
      if (timer) clearInterval(timer)
    }
  }, [cwd])

  return { branch, loading }
}
