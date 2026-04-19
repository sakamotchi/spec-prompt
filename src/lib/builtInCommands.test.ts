import { describe, it, expect } from 'vitest'
import { BUILT_IN_COMMANDS } from './builtInCommands'

describe('BUILT_IN_COMMANDS', () => {
  it('最低 20 件以上の組み込みコマンドを含む', () => {
    expect(BUILT_IN_COMMANDS.length).toBeGreaterThanOrEqual(20)
  })

  it('name が重複していない', () => {
    const names = BUILT_IN_COMMANDS.map((c) => c.name)
    const unique = new Set(names)
    expect(unique.size).toBe(names.length)
  })

  it('すべてのエントリが非空の name と description を持つ', () => {
    for (const cmd of BUILT_IN_COMMANDS) {
      expect(cmd.name).toBeTruthy()
      expect(cmd.name).not.toContain(' ')
      expect(cmd.description).toBeTruthy()
    }
  })

  it('バンドル Skill が含まれる（debug / simplify / loop 等）', () => {
    const names = BUILT_IN_COMMANDS.map((c) => c.name)
    expect(names).toContain('debug')
    expect(names).toContain('simplify')
    expect(names).toContain('loop')
  })

  it('主要な組み込みコマンドが含まれる（resume / clear / model 等）', () => {
    const names = BUILT_IN_COMMANDS.map((c) => c.name)
    expect(names).toContain('resume')
    expect(names).toContain('clear')
    expect(names).toContain('model')
    expect(names).toContain('help')
  })
})
