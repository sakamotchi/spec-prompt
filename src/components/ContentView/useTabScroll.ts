import { useLayoutEffect, useRef } from 'react'
import type { DependencyList, RefObject } from 'react'
import { useContentStore } from '../../stores/contentStore'

export function useTabScroll(
  tabId: string,
  scrollRef: RefObject<HTMLElement | null>,
  restoreAfterDeps: DependencyList = [],
) {
  const isRestoringRef = useRef(false)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const state = useContentStore.getState()
    const tab =
      state.primary.tabs.find((t) => t.id === tabId) ??
      state.secondary.tabs.find((t) => t.id === tabId)
    const saved = tab?.scrollTop ?? 0
    el.scrollTop = saved
    isRestoringRef.current = saved > 0

    return () => {
      useContentStore.getState().setScrollTop(tabId, el.scrollTop)
    }
  }, [tabId, scrollRef])

  useLayoutEffect(() => {
    if (!isRestoringRef.current) return
    const el = scrollRef.current
    if (!el) return
    const state = useContentStore.getState()
    const tab =
      state.primary.tabs.find((t) => t.id === tabId) ??
      state.secondary.tabs.find((t) => t.id === tabId)
    const saved = tab?.scrollTop ?? 0
    el.scrollTop = saved
    isRestoringRef.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, restoreAfterDeps)
}
