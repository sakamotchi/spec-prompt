import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './appStore'

describe('appStore', () => {
  beforeEach(() => {
    useAppStore.setState({ activeMainTab: 'content' })
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
})
