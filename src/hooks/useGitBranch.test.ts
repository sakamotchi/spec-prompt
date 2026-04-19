import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGitBranch } from './useGitBranch'
import { tauriApi } from '../lib/tauriApi'

vi.mock('../lib/tauriApi', () => ({
  tauriApi: { getBranch: vi.fn() },
}))

const getBranchMock = vi.mocked(tauriApi.getBranch)

// マイクロタスクキューを flush するヘルパー。useEffect 内の非同期 IIFE を
// 確実に進めるために複数回 await する。
async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

describe('useGitBranch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    getBranchMock.mockResolvedValue('main')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetAllMocks()
  })

  it('cwd が null のとき IPC を呼ばない', () => {
    const { result } = renderHook(() => useGitBranch(null))
    expect(getBranchMock).not.toHaveBeenCalled()
    expect(result.current.branch).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('cwd セット時にブランチ名を取得する', async () => {
    const { result } = renderHook(() => useGitBranch('/repo'))
    await flush()
    expect(getBranchMock).toHaveBeenCalledWith('/repo')
    expect(result.current.branch).toBe('main')
  })

  it('3 秒ごとにポーリングする', async () => {
    renderHook(() => useGitBranch('/repo'))
    await flush()
    expect(getBranchMock).toHaveBeenCalledTimes(1)

    getBranchMock.mockResolvedValue('feature/x')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    expect(getBranchMock).toHaveBeenCalledTimes(2)
    expect(getBranchMock).toHaveBeenLastCalledWith('/repo')
  })

  it('cwd 変更時に新しい cwd で再取得する', async () => {
    const { rerender } = renderHook(({ cwd }) => useGitBranch(cwd), {
      initialProps: { cwd: '/repo-a' as string | null },
    })
    await flush()
    expect(getBranchMock).toHaveBeenCalledWith('/repo-a')

    rerender({ cwd: '/repo-b' })
    await flush()
    expect(getBranchMock).toHaveBeenCalledWith('/repo-b')
  })

  it('アンマウント後はポーリングされない', async () => {
    const { unmount } = renderHook(() => useGitBranch('/repo'))
    await flush()
    expect(getBranchMock).toHaveBeenCalledTimes(1)

    unmount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })
    expect(getBranchMock).toHaveBeenCalledTimes(1)
  })
})
