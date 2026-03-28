import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './appStore'

describe('appStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      activeMainTab: 'content',
      projectRoot: null,
      fileTree: [],
      selectedFile: null,
      expandedDirs: new Set(),
    })
  })

  it('初期値は content', () => {
    expect(useAppStore.getState().activeMainTab).toBe('content')
  })

  it('setActiveMainTab で terminal に切り替わる', () => {
    useAppStore.getState().setActiveMainTab('terminal')
    expect(useAppStore.getState().activeMainTab).toBe('terminal')
  })

  it('setActiveMainTab で content に戻せる', () => {
    useAppStore.getState().setActiveMainTab('terminal')
    useAppStore.getState().setActiveMainTab('content')
    expect(useAppStore.getState().activeMainTab).toBe('content')
  })

  it('toggleExpandedDir でディレクトリが展開される', () => {
    useAppStore.getState().toggleExpandedDir('/project/src')
    expect(useAppStore.getState().expandedDirs.has('/project/src')).toBe(true)
  })

  it('toggleExpandedDir を2回呼ぶと折りたたまれる', () => {
    useAppStore.getState().toggleExpandedDir('/project/src')
    useAppStore.getState().toggleExpandedDir('/project/src')
    expect(useAppStore.getState().expandedDirs.has('/project/src')).toBe(false)
  })
})
