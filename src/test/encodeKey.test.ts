import { describe, it, expect } from 'vitest'
import { encodeKey } from '../components/TerminalPanel/useTerminalInput'

const key = (overrides: Partial<KeyboardEvent>): Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'metaKey' | 'shiftKey'> => ({
  key: '',
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  shiftKey: false,
  ...overrides,
})

describe('encodeKey', () => {
  it('printable characters pass through', () => {
    expect(encodeKey(key({ key: 'a' }))).toBe('a')
    expect(encodeKey(key({ key: 'Z' }))).toBe('Z')
    expect(encodeKey(key({ key: '1' }))).toBe('1')
    expect(encodeKey(key({ key: ' ' }))).toBe(' ')
  })

  it('Enter → CR', () => {
    expect(encodeKey(key({ key: 'Enter' }))).toBe('\r')
  })

  it('Backspace → DEL', () => {
    expect(encodeKey(key({ key: 'Backspace' }))).toBe('\x7f')
  })

  it('Tab → HT', () => {
    expect(encodeKey(key({ key: 'Tab' }))).toBe('\t')
  })

  it('Escape → ESC', () => {
    expect(encodeKey(key({ key: 'Escape' }))).toBe('\x1b')
  })

  it('arrow keys → CSI sequences', () => {
    expect(encodeKey(key({ key: 'ArrowUp' }))).toBe('\x1b[A')
    expect(encodeKey(key({ key: 'ArrowDown' }))).toBe('\x1b[B')
    expect(encodeKey(key({ key: 'ArrowRight' }))).toBe('\x1b[C')
    expect(encodeKey(key({ key: 'ArrowLeft' }))).toBe('\x1b[D')
  })

  it('Ctrl+C → ETX', () => {
    expect(encodeKey(key({ key: 'c', ctrlKey: true }))).toBe('\x03')
  })

  it('Ctrl+D → EOT', () => {
    expect(encodeKey(key({ key: 'd', ctrlKey: true }))).toBe('\x04')
  })

  it('Ctrl+Z → SUB', () => {
    expect(encodeKey(key({ key: 'z', ctrlKey: true }))).toBe('\x1a')
  })

  it('Ctrl+A → SOH', () => {
    expect(encodeKey(key({ key: 'a', ctrlKey: true }))).toBe('\x01')
  })

  it('Ctrl+[ → ESC', () => {
    expect(encodeKey(key({ key: '[', ctrlKey: true }))).toBe('\x1b')
  })

  it('F1-F4 → SS3 sequences', () => {
    expect(encodeKey(key({ key: 'F1' }))).toBe('\x1bOP')
    expect(encodeKey(key({ key: 'F2' }))).toBe('\x1bOQ')
    expect(encodeKey(key({ key: 'F3' }))).toBe('\x1bOR')
    expect(encodeKey(key({ key: 'F4' }))).toBe('\x1bOS')
  })

  it('F5-F12 → CSI sequences', () => {
    expect(encodeKey(key({ key: 'F5' }))).toBe('\x1b[15~')
    expect(encodeKey(key({ key: 'F12' }))).toBe('\x1b[24~')
  })

  it('Alt+key → ESC prefix', () => {
    expect(encodeKey(key({ key: 'b', altKey: true }))).toBe('\x1bb')
  })

  it('Meta+key → null (OS shortcut)', () => {
    expect(encodeKey(key({ key: 'c', metaKey: true }))).toBeNull()
  })

  it('unknown special key → null', () => {
    expect(encodeKey(key({ key: 'Unidentified' }))).toBeNull()
  })
})
