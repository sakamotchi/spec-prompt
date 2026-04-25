import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../stores/appStore'
import { useContentStore } from '../stores/contentStore'
import { tauriApi } from '../lib/tauriApi'
import { toast } from '../components/Toast'

export const TREE_DND_MIME = 'text/x-sddesk-paths'

export type DropOperation = 'move' | 'copy'

export interface DropResult {
  succeeded: { src: string; dest: string }[]
  skipped: { src: string; reason: string }[]
}

export interface PendingConfirm {
  operation: DropOperation
  count: number
  destDir: string
  execute: () => Promise<void>
}

const CONFIRM_THRESHOLD_INTERNAL = 2
const CONFIRM_THRESHOLD_EXTERNAL_COUNT = 50

function basename(path: string): string {
  const idx = path.lastIndexOf('/')
  return idx >= 0 ? path.slice(idx + 1) : path
}

function dirname(path: string): string {
  const idx = path.lastIndexOf('/')
  return idx > 0 ? path.slice(0, idx) : '/'
}

// dest が src の子孫（または src 自身）の場合 true
function isDescendant(src: string, dest: string): boolean {
  if (src === dest) return true
  return dest.startsWith(src + '/')
}

export function useTreeDnd() {
  const { t } = useTranslation()
  const updateDirChildren = useAppStore((s) => s.updateDirChildren)
  const setSelectedFile = useAppStore((s) => s.setSelectedFile)
  const clearFileSelection = useAppStore((s) => s.clearFileSelection)
  const renameTabPath = useContentStore((s) => s.renameTabPath)

  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null)
  // toast / state 更新のクロージャに最新値を渡すための参照
  const tRef = useRef(t)
  tRef.current = t

  const reloadParents = useCallback(
    async (paths: Set<string>) => {
      await Promise.all(
        Array.from(paths).map(async (dir) => {
          try {
            const children = await tauriApi.readDir(dir)
            updateDirChildren(dir, children)
          } catch (e) {
            console.error('readDir failed', dir, e)
          }
        }),
      )
    },
    [updateDirChildren],
  )

  const performMove = useCallback(
    async (srcPaths: string[], destDir: string): Promise<DropResult> => {
      const result: DropResult = { succeeded: [], skipped: [] }
      const dirsToReload = new Set<string>([destDir])

      for (const src of srcPaths) {
        const srcParent = dirname(src)
        if (srcParent === destDir) {
          // 同一親フォルダへの移動は no-op として扱う
          result.skipped.push({ src, reason: 'same-parent' })
          continue
        }
        if (isDescendant(src, destDir)) {
          result.skipped.push({ src, reason: 'descendant' })
          continue
        }

        const newPath = `${destDir}/${basename(src)}`
        try {
          await tauriApi.renamePath(src, newPath)
          result.succeeded.push({ src, dest: newPath })
          dirsToReload.add(srcParent)
          renameTabPath(src, newPath)
          if (useAppStore.getState().selectedFile === src) {
            setSelectedFile(newPath)
          }
        } catch (e) {
          result.skipped.push({ src, reason: e instanceof Error ? e.message : String(e) })
        }
      }

      await reloadParents(dirsToReload)
      clearFileSelection()
      return result
    },
    [reloadParents, renameTabPath, setSelectedFile, clearFileSelection],
  )

  const performCopy = useCallback(
    async (srcPaths: string[], destDir: string): Promise<DropResult> => {
      const result: DropResult = { succeeded: [], skipped: [] }
      for (const src of srcPaths) {
        try {
          const dest = await tauriApi.copyPath(src, destDir)
          result.succeeded.push({ src, dest })
        } catch (e) {
          result.skipped.push({ src, reason: e instanceof Error ? e.message : String(e) })
        }
      }
      await reloadParents(new Set([destDir]))
      return result
    },
    [reloadParents],
  )

  const reportResult = useCallback((operation: DropOperation, result: DropResult) => {
    const okCount = result.succeeded.length
    const failCount = result.skipped.length
    if (okCount > 0 && failCount === 0) {
      const key = operation === 'move' ? 'dnd.toast.moveSuccess' : 'dnd.toast.copySuccess'
      toast.success(tRef.current(key, { count: okCount }))
    } else if (okCount > 0 && failCount > 0) {
      toast.info(tRef.current('dnd.toast.partialFailure', { ok: okCount, fail: failCount }))
    } else if (okCount === 0 && failCount > 0) {
      // 同名衝突のみのケースか、その他のエラーかで分ける
      const conflictReasons = result.skipped.filter(
        (s) => s.reason !== 'same-parent' && s.reason !== 'descendant',
      )
      if (conflictReasons.length > 0) {
        const first = conflictReasons[0]
        if (conflictReasons.every((s) => /既に存在|exist/i.test(s.reason))) {
          toast.info(tRef.current('dnd.toast.skipped', { count: conflictReasons.length }))
        } else {
          toast.error(tRef.current('dnd.toast.error', { message: first.reason }))
        }
      }
      // same-parent / descendant のみなら no-op（無音）
    }
  }, [])

  const handleInternalDrop = useCallback(
    async (srcPaths: string[], destDir: string) => {
      if (srcPaths.length === 0) return
      const filtered = srcPaths.filter((s) => !isDescendant(s, destDir) && dirname(s) !== destDir)
      if (filtered.length === 0) return

      const run = async () => {
        const result = await performMove(srcPaths, destDir)
        reportResult('move', result)
      }

      if (filtered.length >= CONFIRM_THRESHOLD_INTERNAL) {
        setPendingConfirm({
          operation: 'move',
          count: filtered.length,
          destDir,
          execute: run,
        })
      } else {
        await run()
      }
    },
    [performMove, reportResult],
  )

  const handleExternalDrop = useCallback(
    async (srcPaths: string[], destDir: string) => {
      if (srcPaths.length === 0) return

      const run = async () => {
        const result = await performCopy(srcPaths, destDir)
        reportResult('copy', result)
      }

      if (srcPaths.length >= CONFIRM_THRESHOLD_EXTERNAL_COUNT) {
        setPendingConfirm({
          operation: 'copy',
          count: srcPaths.length,
          destDir,
          execute: run,
        })
      } else {
        await run()
      }
    },
    [performCopy, reportResult],
  )

  const confirmPending = useCallback(async () => {
    const p = pendingConfirm
    setPendingConfirm(null)
    if (p) await p.execute()
  }, [pendingConfirm])

  const cancelPending = useCallback(() => {
    setPendingConfirm(null)
  }, [])

  return {
    handleInternalDrop,
    handleExternalDrop,
    pendingConfirm,
    confirmPending,
    cancelPending,
  }
}

export type TreeDndApi = ReturnType<typeof useTreeDnd>

const TreeDndContext = createContext<TreeDndApi | null>(null)

export const TreeDndProvider = TreeDndContext.Provider

export function useTreeDndContext(): TreeDndApi {
  const ctx = useContext(TreeDndContext)
  if (!ctx) throw new Error('useTreeDndContext must be used within TreeDndProvider')
  return ctx
}

// テスト用エクスポート
export const __testing = { isDescendant, basename, dirname }
