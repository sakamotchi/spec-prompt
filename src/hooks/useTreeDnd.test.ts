import { describe, it, expect } from 'vitest'
import { __testing } from './useTreeDnd'

const { isDescendant, basename, dirname } = __testing

describe('useTreeDnd utilities', () => {
  describe('basename', () => {
    it('最後のセグメントを返す', () => {
      expect(basename('/a/b/c.md')).toBe('c.md')
      expect(basename('a.md')).toBe('a.md')
    })
  })

  describe('dirname', () => {
    it('親ディレクトリを返す', () => {
      expect(dirname('/a/b/c.md')).toBe('/a/b')
      expect(dirname('/a')).toBe('/')
    })
  })

  describe('isDescendant', () => {
    it('同一パスは true（自己ドロップ禁止）', () => {
      expect(isDescendant('/p/src', '/p/src')).toBe(true)
    })

    it('子孫パスは true', () => {
      expect(isDescendant('/p/src', '/p/src/sub')).toBe(true)
      expect(isDescendant('/p/src', '/p/src/sub/deep')).toBe(true)
    })

    it('兄弟・他系統は false', () => {
      expect(isDescendant('/p/src', '/p/docs')).toBe(false)
      expect(isDescendant('/p/src', '/p')).toBe(false)
    })

    it('プレフィックスが部分一致するだけのパスは false', () => {
      // /p/src と /p/src-old が誤って子孫扱いされないこと
      expect(isDescendant('/p/src', '/p/src-old')).toBe(false)
    })
  })
})
