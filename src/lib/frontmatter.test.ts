import { describe, it, expect } from 'vitest'
import { parseStatus, setStatus } from './frontmatter'

describe('parseStatus', () => {
  it('フロントマターに status: draft があれば draft を返す', () => {
    const content = '---\nstatus: draft\n---\n# Title'
    expect(parseStatus(content)).toBe('draft')
  })

  it('フロントマターに status: reviewing があれば reviewing を返す', () => {
    const content = '---\nstatus: reviewing\n---\n本文'
    expect(parseStatus(content)).toBe('reviewing')
  })

  it('フロントマターに status: approved があれば approved を返す', () => {
    const content = '---\nstatus: approved\n---\n本文'
    expect(parseStatus(content)).toBe('approved')
  })

  it('フロントマターがなければ null を返す', () => {
    expect(parseStatus('# Title\nno frontmatter')).toBeNull()
  })

  it('フロントマターはあるが status キーがなければ null を返す', () => {
    const content = '---\ntitle: foo\n---\n本文'
    expect(parseStatus(content)).toBeNull()
  })

  it('不正なステータス値は null を返す', () => {
    const content = '---\nstatus: unknown\n---\n本文'
    expect(parseStatus(content)).toBeNull()
  })
})

describe('setStatus', () => {
  it('フロントマターなしのファイルに status を追加する', () => {
    const result = setStatus('# Title\n本文', 'draft')
    expect(result).toContain('status: draft')
    expect(result).toMatch(/^---\n/)
  })

  it('既存の status を更新する', () => {
    const content = '---\nstatus: draft\n---\n# Title'
    const result = setStatus(content, 'approved')
    expect(result).toContain('status: approved')
    expect(result).not.toContain('status: draft')
  })

  it('フロントマターはあるが status がない場合は追記する', () => {
    const content = '---\ntitle: foo\n---\n本文'
    const result = setStatus(content, 'reviewing')
    expect(result).toContain('status: reviewing')
    expect(result).toContain('title: foo')
  })

  it('setStatus 後に parseStatus で同じ値を取り出せる', () => {
    const content = '# Title\n本文'
    const updated = setStatus(content, 'approved')
    expect(parseStatus(updated)).toBe('approved')
  })
})
