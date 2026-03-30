import { describe, it, expect } from 'vitest'
import { getViewMode } from './viewMode'

describe('getViewMode', () => {
  it('md → markdown', () => expect(getViewMode('README.md')).toBe('markdown'))
  it('mdx → markdown', () => expect(getViewMode('page.mdx')).toBe('markdown'))
  it('ts → code', () => expect(getViewMode('app.ts')).toBe('code'))
  it('tsx → code', () => expect(getViewMode('App.tsx')).toBe('code'))
  it('rs → code', () => expect(getViewMode('main.rs')).toBe('code'))
  it('py → code', () => expect(getViewMode('script.py')).toBe('code'))
  it('json → code', () => expect(getViewMode('package.json')).toBe('code'))
  it('toml → code', () => expect(getViewMode('Cargo.toml')).toBe('code'))
  it('yaml → code', () => expect(getViewMode('config.yaml')).toBe('code'))
  it('txt → plain', () => expect(getViewMode('notes.txt')).toBe('plain'))
  it('拡張子なし → plain', () => expect(getViewMode('Makefile')).toBe('plain'))
  it('大文字拡張子 → code', () => expect(getViewMode('file.TS')).toBe('code'))
})
