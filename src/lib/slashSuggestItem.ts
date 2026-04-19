import type { PromptTemplate } from '../stores/promptPaletteStore'
import type { BuiltInCommand } from './builtInCommands'

/**
 * SlashSuggest の候補種別。
 * Phase A では template / builtin のみ実値が生成される。
 * user-skill / project-skill は Phase B で `~/.claude/skills/` 等から読み取る予定。
 */
export type SlashSuggestKind =
  | 'template'
  | 'builtin'
  | 'user-skill'
  | 'project-skill'

/** Rust `list_claude_skills` が返す Skill メタデータ */
export interface SkillMetadata {
  /** ユーザー (`~/.claude/skills/`) / プロジェクト (`<projectRoot>/.claude/skills/`) の出所 */
  kind: 'user' | 'project'
  name: string
  description?: string
  argumentHint?: string
  /** SKILL.md の絶対パス */
  path: string
}

export type SlashSuggestItem =
  | {
      kind: 'template'
      id: string
      name: string
      body: string
    }
  | {
      kind: 'builtin'
      name: string
      description: string
    }
  | {
      kind: 'user-skill'
      name: string
      description?: string
      argumentHint?: string
      path: string
    }
  | {
      kind: 'project-skill'
      name: string
      description?: string
      argumentHint?: string
      path: string
    }

export interface SlashSuggestSection {
  kind: SlashSuggestKind
  labelKey: string
  badgeKey: string
  items: SlashSuggestItem[]
}

export interface GetCandidatesInput {
  templates: PromptTemplate[]
  builtIns: BuiltInCommand[]
  userSkills?: SkillMetadata[]
  projectSkills?: SkillMetadata[]
  query: string
  maxPerSection?: number
}

const DEFAULT_MAX_PER_SECTION = 10

/** name と query を小文字化した上で、query の各文字が name の順序どおりに出現すれば true */
function fuzzyMatch(name: string, query: string): boolean {
  if (!query) return true
  const lower = name.toLowerCase()
  const q = query.toLowerCase()
  let qi = 0
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++
  }
  return qi === q.length
}

/**
 * 候補を kind 別セクションに合成する。
 *
 * - セクションの並びは `builtin` → `user-skill` → `project-skill` → `template` 固定
 * - 各セクション内は name 昇順
 * - 同名衝突は「ユーザー Skill > プロジェクト Skill」で前者のみを残す（Phase B で効く）
 * - 空セクションは結果から除外
 * - 各セクションは maxPerSection 件まで（既定 10）
 */
export function getSlashSuggestCandidates(
  input: GetCandidatesInput,
): SlashSuggestSection[] {
  const {
    templates,
    builtIns,
    userSkills = [],
    projectSkills = [],
    query,
    maxPerSection = DEFAULT_MAX_PER_SECTION,
  } = input

  const userNames = new Set(userSkills.map((s) => s.name))
  const dedupedProjectSkills = projectSkills.filter((s) => !userNames.has(s.name))

  const builtinItems: SlashSuggestItem[] = builtIns
    .filter((c) => fuzzyMatch(c.name, query))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ kind: 'builtin', name: c.name, description: c.description }))

  const userSkillItems: SlashSuggestItem[] = userSkills
    .filter((s) => fuzzyMatch(s.name, query))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => ({
      kind: 'user-skill',
      name: s.name,
      description: s.description,
      argumentHint: s.argumentHint,
      path: s.path,
    }))

  const projectSkillItems: SlashSuggestItem[] = dedupedProjectSkills
    .filter((s) => fuzzyMatch(s.name, query))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => ({
      kind: 'project-skill',
      name: s.name,
      description: s.description,
      argumentHint: s.argumentHint,
      path: s.path,
    }))

  const templateItems: SlashSuggestItem[] = templates
    .filter((t) => fuzzyMatch(t.name, query))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((t) => ({ kind: 'template', id: t.id, name: t.name, body: t.body }))

  const sections: SlashSuggestSection[] = [
    {
      kind: 'builtin',
      labelKey: 'promptPalette.slashSuggest.section.commands',
      badgeKey: 'promptPalette.slashSuggest.badge.command',
      items: builtinItems.slice(0, maxPerSection),
    },
    {
      kind: 'user-skill',
      labelKey: 'promptPalette.slashSuggest.section.userSkills',
      badgeKey: 'promptPalette.slashSuggest.badge.userSkill',
      items: userSkillItems.slice(0, maxPerSection),
    },
    {
      kind: 'project-skill',
      labelKey: 'promptPalette.slashSuggest.section.projectSkills',
      badgeKey: 'promptPalette.slashSuggest.badge.projectSkill',
      items: projectSkillItems.slice(0, maxPerSection),
    },
    {
      kind: 'template',
      labelKey: 'promptPalette.slashSuggest.section.templates',
      badgeKey: 'promptPalette.slashSuggest.badge.template',
      items: templateItems.slice(0, maxPerSection),
    },
  ]

  return sections.filter((s) => s.items.length > 0)
}
