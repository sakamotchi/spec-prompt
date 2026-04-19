import { describe, it, expect } from 'vitest'
import {
  getSlashSuggestCandidates,
  type SkillMetadata,
} from './slashSuggestItem'
import { BUILT_IN_COMMANDS } from './builtInCommands'
import type { PromptTemplate } from '../stores/promptPaletteStore'

const templates: PromptTemplate[] = [
  { id: 't1', name: 'review-pr', body: 'body-1', updatedAt: 0 },
  { id: 't2', name: 'summarize', body: 'body-2', updatedAt: 0 },
]

describe('getSlashSuggestCandidates', () => {
  it('空クエリで builtin / template セクションが返る', () => {
    const sections = getSlashSuggestCandidates({
      templates,
      builtIns: BUILT_IN_COMMANDS,
      query: '',
    })
    const kinds = sections.map((s) => s.kind)
    expect(kinds).toContain('builtin')
    expect(kinds).toContain('template')
    // セクションの順: builtin → user-skill → project-skill → template
    expect(kinds.indexOf('builtin')).toBeLessThan(kinds.indexOf('template'))
  })

  it('fuzzy クエリ "rev" が横断マッチする', () => {
    const sections = getSlashSuggestCandidates({
      templates,
      builtIns: BUILT_IN_COMMANDS,
      query: 'rev',
    })
    const allNames = sections.flatMap((s) => s.items.map((i) => i.name))
    // 組み込み側: review は無いが rewind が r→e→w...ではなく r→e→v の順なら...
    // 実際: "review" は組み込みに無く、バンドルにも無い。 'rewind' は r,e,w で v を含まないので rev マッチしない。
    // → 組み込み側はマッチせず、template 側の 'review-pr' のみ
    expect(allNames).toContain('review-pr')
  })

  it('fuzzy クエリ "res" で resume がマッチする', () => {
    const sections = getSlashSuggestCandidates({
      templates: [],
      builtIns: BUILT_IN_COMMANDS,
      query: 'res',
    })
    const names = sections.flatMap((s) => s.items.map((i) => i.name))
    expect(names).toContain('resume')
  })

  it('空セクションは結果から除外される', () => {
    const sections = getSlashSuggestCandidates({
      templates: [],
      builtIns: [],
      query: '',
    })
    expect(sections).toEqual([])
  })

  it('テンプレ 0 件のときは template セクションを含めない', () => {
    const sections = getSlashSuggestCandidates({
      templates: [],
      builtIns: BUILT_IN_COMMANDS,
      query: '',
    })
    const kinds = sections.map((s) => s.kind)
    expect(kinds).not.toContain('template')
    expect(kinds).toContain('builtin')
  })

  it('maxPerSection でセクション毎に上限適用', () => {
    const sections = getSlashSuggestCandidates({
      templates,
      builtIns: BUILT_IN_COMMANDS,
      query: '',
      maxPerSection: 3,
    })
    for (const s of sections) {
      expect(s.items.length).toBeLessThanOrEqual(3)
    }
  })

  it('各セクション内は name 昇順でソートされる', () => {
    const sections = getSlashSuggestCandidates({
      templates,
      builtIns: BUILT_IN_COMMANDS,
      query: '',
    })
    for (const s of sections) {
      const names = s.items.map((i) => i.name)
      const sorted = [...names].sort((a, b) => a.localeCompare(b))
      expect(names).toEqual(sorted)
    }
  })

  it('ユーザー Skill はセクションに含まれる', () => {
    const userSkills: SkillMetadata[] = [
      { kind: 'user', name: 'my-audit', description: 'Audit', path: '/u/my-audit/SKILL.md' },
    ]
    const sections = getSlashSuggestCandidates({
      templates: [],
      builtIns: [],
      userSkills,
      query: '',
    })
    expect(sections).toHaveLength(1)
    expect(sections[0].kind).toBe('user-skill')
    expect(sections[0].items[0].name).toBe('my-audit')
  })

  it('同名のユーザー Skill とプロジェクト Skill があった場合、ユーザー側のみ残る', () => {
    const userSkills: SkillMetadata[] = [
      { kind: 'user', name: 'dup', description: 'U', path: '/u/dup/SKILL.md' },
    ]
    const projectSkills: SkillMetadata[] = [
      { kind: 'project', name: 'dup', description: 'P', path: '/p/dup/SKILL.md' },
      { kind: 'project', name: 'only-project', description: 'P2', path: '/p/only/SKILL.md' },
    ]
    const sections = getSlashSuggestCandidates({
      templates: [],
      builtIns: [],
      userSkills,
      projectSkills,
      query: '',
    })
    const userSection = sections.find((s) => s.kind === 'user-skill')
    const projectSection = sections.find((s) => s.kind === 'project-skill')
    expect(userSection?.items.map((i) => i.name)).toEqual(['dup'])
    expect(projectSection?.items.map((i) => i.name)).toEqual(['only-project'])
  })

  it('各 kind に対応する labelKey / badgeKey が設定されている', () => {
    const sections = getSlashSuggestCandidates({
      templates,
      builtIns: BUILT_IN_COMMANDS,
      query: '',
    })
    const builtin = sections.find((s) => s.kind === 'builtin')
    const template = sections.find((s) => s.kind === 'template')
    expect(builtin?.labelKey).toBe('promptPalette.slashSuggest.section.commands')
    expect(builtin?.badgeKey).toBe('promptPalette.slashSuggest.badge.command')
    expect(template?.labelKey).toBe('promptPalette.slashSuggest.section.templates')
    expect(template?.badgeKey).toBe('promptPalette.slashSuggest.badge.template')
  })
})
