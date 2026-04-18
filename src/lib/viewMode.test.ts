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
  it('png → image', () => expect(getViewMode('logo.png')).toBe('image'))
  it('jpg → image', () => expect(getViewMode('photo.jpg')).toBe('image'))
  it('jpeg → image', () => expect(getViewMode('photo.jpeg')).toBe('image'))
  it('gif → image', () => expect(getViewMode('anim.gif')).toBe('image'))
  it('webp → image', () => expect(getViewMode('pic.webp')).toBe('image'))
  it('svg → image', () => expect(getViewMode('icon.svg')).toBe('image'))
  it('大文字画像拡張子 → image', () => expect(getViewMode('shot.PNG')).toBe('image'))
})
