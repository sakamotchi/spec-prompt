import { useEffect, useState } from 'react'
import { tauriApi } from '../lib/tauriApi'
import { useAppStore } from '../stores/appStore'

export function useFileTree() {
  const projectRoot = useAppStore((s) => s.projectRoot)
  const setFileTree = useAppStore((s) => s.setFileTree)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectRoot) return
    setLoading(true)
    setError(null)
    tauriApi
      .readDir(projectRoot)
      .then(setFileTree)
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [projectRoot, setFileTree])

  return { loading, error }
}
