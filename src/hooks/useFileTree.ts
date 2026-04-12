import { useEffect, useRef, useState } from 'react'
import { watch } from '@tauri-apps/plugin-fs'
import { tauriApi } from '../lib/tauriApi'
import { useAppStore } from '../stores/appStore'

const DEBOUNCE_MS = 500

export function useFileTree() {
  const projectRoot = useAppStore((s) => s.projectRoot)
  const setFileTree = useAppStore((s) => s.setFileTree)
  const updateDirChildren = useAppStore((s) => s.updateDirChildren)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isUpdatingRef = useRef(false)

  const refreshGitStatus = useAppStore((s) => s.refreshGitStatus)

  // ファイルツリー初回取得（ルート1階層のみ）
  useEffect(() => {
    if (!projectRoot) return
    setLoading(true)
    setError(null)
    tauriApi
      .readDir(projectRoot)
      .then((tree) => {
        setFileTree(tree)
        refreshGitStatus()
      })
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [projectRoot, setFileTree, refreshGitStatus])

  // ファイル監視 → 変更があった親ディレクトリのみ更新
  useEffect(() => {
    if (!projectRoot) return

    let unlisten: (() => void) | null = null

    const scheduleUpdate = (changedPaths: string[]) => {
      if (pendingRef.current) clearTimeout(pendingRef.current)
      pendingRef.current = setTimeout(() => {
        if (isUpdatingRef.current) {
          scheduleUpdate(changedPaths)
          return
        }
        isUpdatingRef.current = true

        // 変更パスの親ディレクトリを収集し、重複を除去
        // ルートは常に含める（node_modules 新規作成など深い階層からの変更を検知するため）
        const parentDirs = new Set<string>([projectRoot])
        for (const p of changedPaths) {
          const idx = p.lastIndexOf('/')
          if (idx > 0) parentDirs.add(p.substring(0, idx))
        }

        const promises = [...parentDirs].map((dir) =>
          tauriApi
            .readDir(dir)
            .then((children) => updateDirChildren(dir, children))
            .catch(console.error),
        )

        Promise.all(promises).finally(() => {
          isUpdatingRef.current = false
          refreshGitStatus()
        })
      }, DEBOUNCE_MS)
    }

    // .git/ 内の特定ファイル変更は外部 git 操作（commit, checkout 等）を示す
    const isGitStateChange = (p: string) =>
      p.includes('/.git/HEAD') ||
      p.includes('/.git/refs/') ||
      p.includes('/.git/MERGE_HEAD')

    watch(
      projectRoot,
      (event) => {
        // プロジェクトファイルの変更（.git/ 以外）→ ツリー更新 + git status 更新
        const projectChanges = event.paths.filter((p) => !p.includes('/.git/'))
        if (projectChanges.length > 0) {
          scheduleUpdate(projectChanges)
        }
        // .git/HEAD, .git/refs/ 等の変更 → git status のみ更新（外部 commit/checkout 検知）
        // .git/index は git status 自身が更新するため除外（無限ループ防止）
        if (event.paths.some(isGitStateChange)) {
          refreshGitStatus()
        }
      },
      { recursive: true, delayMs: 300 },
    )
      .then((fn) => {
        unlisten = fn
      })
      .catch(console.error)

    return () => {
      if (pendingRef.current) clearTimeout(pendingRef.current)
      unlisten?.()
    }
  }, [projectRoot, setFileTree, updateDirChildren, refreshGitStatus])

  return { loading, error }
}
