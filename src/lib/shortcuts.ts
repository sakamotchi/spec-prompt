export interface ShortcutDef {
  labelKey: string
  keys: string[]
  categoryKey: string
}

export const SHORTCUT_DEFS: ShortcutDef[] = [
  // ペイン切り替え
  { labelKey: 'shortcuts.label.togglePane',    keys: ['Ctrl', 'Tab'],    categoryKey: 'shortcuts.category.pane' },

  // タブ操作
  { labelKey: 'shortcuts.label.newTerminalTab', keys: ['⌘', 'T'],        categoryKey: 'shortcuts.category.tab' },
  { labelKey: 'shortcuts.label.closeTab',       keys: ['⌘', 'W'],        categoryKey: 'shortcuts.category.tab' },
  { labelKey: 'shortcuts.label.prevTab',        keys: ['Ctrl', '⇧', 'Tab'], categoryKey: 'shortcuts.category.tab' },
  { labelKey: 'shortcuts.label.nthTab',         keys: ['⌘', '1-9'],      categoryKey: 'shortcuts.category.tab' },

  // 分割表示
  { labelKey: 'shortcuts.label.splitContent',   keys: ['⌘', '\\'],       categoryKey: 'shortcuts.category.split' },
  { labelKey: 'shortcuts.label.splitTerminal',  keys: ['⌘', '⇧', '\\'], categoryKey: 'shortcuts.category.split' },
  { labelKey: 'shortcuts.label.parallelView',   keys: ['Ctrl', '\\'],    categoryKey: 'shortcuts.category.split' },

  // フォーカス移動
  { labelKey: 'shortcuts.label.focusTree',      keys: ['⌘', '0'],        categoryKey: 'shortcuts.category.focus' },

  // その他
  { labelKey: 'shortcuts.label.pathPalette',    keys: ['Ctrl', 'P'],     categoryKey: 'shortcuts.category.other' },
  { labelKey: 'shortcuts.label.promptPalette',  keys: ['⌘', '⇧', 'P'],   categoryKey: 'shortcuts.category.other' },
  { labelKey: 'shortcuts.label.shortcutList',   keys: ['?'],             categoryKey: 'shortcuts.category.other' },
]
