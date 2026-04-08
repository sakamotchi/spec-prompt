import { describe, it, expect, beforeEach } from 'vitest'
import {
  saveMySession,
  clearMySession,
  consolidateAndSave,
  loadWindowSessions,
  clearWindowSessions,
} from './windowSession'

describe('windowSession', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('saveMySession', () => {
    it('localStorage にキーが書き込まれる', () => {
      saveMySession('window-abc', '/path/to/project')
      expect(localStorage.getItem('specprompt-win-window-abc')).not.toBeNull()
    })

    it('projectRoot が null でも保存できる', () => {
      saveMySession('window-abc', null)
      const raw = localStorage.getItem('specprompt-win-window-abc')
      expect(raw).not.toBeNull()
      expect(JSON.parse(raw!).projectRoot).toBeNull()
    })

    it('保存した projectRoot を取り出せる', () => {
      saveMySession('window-xyz', '/my/project')
      const raw = localStorage.getItem('specprompt-win-window-xyz')
      expect(JSON.parse(raw!).projectRoot).toBe('/my/project')
    })
  })

  describe('clearMySession', () => {
    it('保存したキーを削除する', () => {
      saveMySession('window-abc', '/path')
      clearMySession('window-abc')
      expect(localStorage.getItem('specprompt-win-window-abc')).toBeNull()
    })
  })

  describe('consolidateAndSave', () => {
    it('per-window キーを統合して consolidated キーに保存する', () => {
      saveMySession('window-1', '/project/a')
      saveMySession('window-2', '/project/b')
      consolidateAndSave()
      const raw = localStorage.getItem('specprompt-window-sessions')
      expect(raw).not.toBeNull()
      const sessions = JSON.parse(raw!)
      expect(sessions).toHaveLength(2)
    })

    it('統合後、per-window キーが削除される', () => {
      saveMySession('window-1', '/project/a')
      consolidateAndSave()
      expect(localStorage.getItem('specprompt-win-window-1')).toBeNull()
    })

    it('per-window キーがない場合、consolidated キーを削除する', () => {
      localStorage.setItem('specprompt-window-sessions', '[]')
      consolidateAndSave()
      expect(localStorage.getItem('specprompt-window-sessions')).toBeNull()
    })
  })

  describe('loadWindowSessions', () => {
    it('統合セッションを読み取れる', () => {
      saveMySession('window-1', '/project/a')
      saveMySession('window-2', '/project/b')
      consolidateAndSave()
      const sessions = loadWindowSessions()
      expect(sessions).toHaveLength(2)
    })

    it('残留 per-window キーも拾い上げる', () => {
      // 統合せずに直接 per-window キーを残す（強制終了シミュレーション）
      saveMySession('window-orphan', '/project/orphan')
      const sessions = loadWindowSessions()
      expect(sessions.some((s) => s.label === 'window-orphan')).toBe(true)
    })

    it('セッションがない場合は空配列を返す', () => {
      const sessions = loadWindowSessions()
      expect(sessions).toHaveLength(0)
    })
  })

  describe('clearWindowSessions', () => {
    it('consolidated キーを削除する', () => {
      saveMySession('window-1', '/a')
      consolidateAndSave()
      clearWindowSessions()
      expect(localStorage.getItem('specprompt-window-sessions')).toBeNull()
    })

    it('残留 per-window キーも削除する', () => {
      saveMySession('window-1', '/a')
      clearWindowSessions()
      expect(localStorage.getItem('specprompt-win-window-1')).toBeNull()
    })
  })
})
