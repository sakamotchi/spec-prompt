/**
 * Claude Code の組み込みスラッシュコマンド + バンドル Skill の静的リスト。
 *
 * 2026-04 時点の公式ドキュメント（https://code.claude.com/docs/en/commands.md,
 * https://code.claude.com/docs/en/skills.md）に準拠。
 * Claude Code のバージョンアップで組み込みが増減した際は、この配列を手動で更新する。
 */

export interface BuiltInCommand {
  name: string
  description: string
}

export const BUILT_IN_COMMANDS: BuiltInCommand[] = [
  // 組み込みコマンド（セッション管理・設定・文脈・コスト 他）
  { name: 'resume', description: 'Resume a previous session' },
  { name: 'clear', description: 'Clear the current conversation' },
  { name: 'compact', description: 'Compact conversation history' },
  { name: 'help', description: 'Show help' },
  { name: 'model', description: 'Change the model' },
  { name: 'config', description: 'Open settings' },
  { name: 'context', description: 'Show context usage' },
  { name: 'cost', description: 'Show session cost' },
  { name: 'usage', description: 'Show usage statistics' },
  { name: 'doctor', description: 'Run diagnostics' },
  { name: 'feedback', description: 'Send feedback' },
  { name: 'login', description: 'Log in to Anthropic' },
  { name: 'logout', description: 'Log out' },
  { name: 'exit', description: 'Exit Claude Code' },
  { name: 'permissions', description: 'Manage tool permissions' },
  { name: 'effort', description: 'Change reasoning effort' },
  { name: 'theme', description: 'Change color theme' },
  { name: 'rename', description: 'Rename the current session' },
  { name: 'rewind', description: 'Rewind to a checkpoint' },
  { name: 'branch', description: 'Branch the conversation' },
  { name: 'diff', description: 'Show conversation diff' },
  { name: 'desktop', description: 'Switch to desktop app' },
  { name: 'teleport', description: 'Pull web session into terminal' },
  // バンドル Skill
  { name: 'debug', description: 'Enable debug logging and diagnostics' },
  { name: 'simplify', description: 'Review code quality and auto-fix' },
  { name: 'batch', description: 'Large-scale parallel changes' },
  { name: 'loop', description: 'Run a prompt on a recurring interval' },
  { name: 'claude-api', description: 'Load Claude API reference automatically' },
]
