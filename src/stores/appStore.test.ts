import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAppStore } from './appStore'

describe('appStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useAppStore.setState({
      activeMainTab: 'content',
      mainLayout: 'tab',
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

describe('appStore persist', () => {
  beforeEach(() => {
    localStorage.clear()
    useAppStore.setState({
      activeMainTab: 'content',
      mainLayout: 'tab',
      projectRoot: null,
      fileTree: [],
      selectedFile: null,
      expandedDirs: new Set(),
    })
  })

  it('projectRoot を設定すると localStorage に保存される', () => {
    useAppStore.getState().setProjectRoot('/my/project')
    const saved = JSON.parse(localStorage.getItem('sddesk-app-store:main') ?? '{}')
    expect(saved.state.projectRoot).toBe('/my/project')
  })

  it('expandedDirs の Set がシリアライズされて保存される', () => {
    useAppStore.getState().toggleExpandedDir('/my/project/src')
    const saved = JSON.parse(localStorage.getItem('sddesk-app-store:main') ?? '{}')
    expect(saved.state.expandedDirs).toEqual({ __type: 'Set', values: ['/my/project/src'] })
  })

  it('fileTree は localStorage に保存されない', () => {
    useAppStore.getState().setFileTree([{ name: 'test', path: '/test', is_dir: false, children: null }])
    const saved = JSON.parse(localStorage.getItem('sddesk-app-store:main') ?? '{}')
    expect(saved.state?.fileTree).toBeUndefined()
  })

  it('persist キーがウィンドウラベル付き（main）である', () => {
    useAppStore.getState().setActiveMainTab('terminal')
    expect(localStorage.getItem('sddesk-app-store:main')).not.toBeNull()
    expect(localStorage.getItem('sddesk-app-store')).toBeNull()
  })
})

describe('appStore migration (SpecPrompt → SDDesk)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('旧キー spec-prompt-app-store:main から sddesk-app-store:main へマイグレーションする', async () => {
    const legacyValue = JSON.stringify({
      state: { projectRoot: '/legacy', activeMainTab: 'terminal' },
      version: 0,
    })
    localStorage.setItem('spec-prompt-app-store:main', legacyValue)

    await import('./appStore')

    expect(localStorage.getItem('sddesk-app-store:main')).toBe(legacyValue)
    expect(localStorage.getItem('spec-prompt-app-store:main')).toBeNull()
  })

  it('さらに古いラベルなしキー spec-prompt-app-store から sddesk-app-store:main へマイグレーションする', async () => {
    const legacyValue = JSON.stringify({
      state: { projectRoot: '/oldest', activeMainTab: 'content' },
      version: 0,
    })
    localStorage.setItem('spec-prompt-app-store', legacyValue)

    await import('./appStore')

    expect(localStorage.getItem('sddesk-app-store:main')).toBe(legacyValue)
    expect(localStorage.getItem('spec-prompt-app-store')).toBeNull()
  })

  it('新キーが既にある場合は上書きせず旧キーのみ削除する', async () => {
    const legacyValue = '{"state":{"legacy":true},"version":0}'
    const currentValue = '{"state":{"current":true},"version":0}'
    localStorage.setItem('spec-prompt-app-store:main', legacyValue)
    localStorage.setItem('sddesk-app-store:main', currentValue)

    await import('./appStore')

    expect(localStorage.getItem('sddesk-app-store:main')).toBe(currentValue)
    expect(localStorage.getItem('spec-prompt-app-store:main')).toBeNull()
  })

  it('ラベル付き legacy と ラベルなし legacy が両方ある場合、ラベル付き（新しい）が優先される', async () => {
    const labelless = '{"state":{"oldest":true},"version":0}'
    const labeled = '{"state":{"mid":true},"version":0}'
    localStorage.setItem('spec-prompt-app-store', labelless)
    localStorage.setItem('spec-prompt-app-store:main', labeled)

    await import('./appStore')

    expect(localStorage.getItem('sddesk-app-store:main')).toBe(labeled)
    expect(localStorage.getItem('spec-prompt-app-store')).toBeNull()
    expect(localStorage.getItem('spec-prompt-app-store:main')).toBeNull()
  })

  it('旧キーが存在しない場合は何もしない', async () => {
    await import('./appStore')

    expect(localStorage.getItem('spec-prompt-app-store')).toBeNull()
    expect(localStorage.getItem('spec-prompt-app-store:main')).toBeNull()
    // 新キーは persist の初期化で生成される可能性があるが、マイグレーション自体は no-op
  })
})
