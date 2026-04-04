import { create } from 'zustand'
import { tauriApi } from '../lib/tauriApi'

export type Theme = 'dark' | 'light' | 'system'

export interface AppearanceSettings {
  theme: Theme
  contentFontFamily: string
  contentFontSize: number
  terminalFontFamily: string
  terminalFontSize: number
}

export const DEFAULT_SETTINGS: AppearanceSettings = {
  theme: 'dark',
  contentFontFamily: 'Geist',
  contentFontSize: 16,
  terminalFontFamily: 'Geist Mono',
  terminalFontSize: 14,
}

interface SettingsState extends AppearanceSettings {
  setTheme: (theme: Theme) => void
  setContentFontFamily: (family: string) => void
  setContentFontSize: (size: number) => void
  setTerminalFontFamily: (family: string) => void
  setTerminalFontSize: (size: number) => void
  loadSettings: () => Promise<void>
  saveSettings: () => Promise<void>
}

function resolveTheme(theme: Theme): 'dark' | 'light' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', resolveTheme(theme))
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  ...DEFAULT_SETTINGS,

  setTheme: (theme) => {
    set({ theme })
    applyTheme(theme)
    get().saveSettings()
  },
  setContentFontFamily: (family) => {
    set({ contentFontFamily: family })
    get().saveSettings()
  },
  setContentFontSize: (size) => {
    set({ contentFontSize: size })
    get().saveSettings()
  },
  setTerminalFontFamily: (family) => {
    set({ terminalFontFamily: family })
    get().saveSettings()
  },
  setTerminalFontSize: (size) => {
    set({ terminalFontSize: size })
    get().saveSettings()
  },

  loadSettings: async () => {
    const s = await tauriApi.getAppearance()
    const mapped: AppearanceSettings = {
      theme: (s.theme as Theme) ?? 'dark',
      contentFontFamily: s.content_font_family,
      contentFontSize: s.content_font_size,
      terminalFontFamily: s.terminal_font_family,
      terminalFontSize: s.terminal_font_size,
    }
    set(mapped)
    applyTheme(mapped.theme)
  },

  saveSettings: async () => {
    const { theme, contentFontFamily, contentFontSize, terminalFontFamily, terminalFontSize } = get()
    await tauriApi.saveAppearance({
      theme,
      content_font_family: contentFontFamily,
      content_font_size: contentFontSize,
      terminal_font_family: terminalFontFamily,
      terminal_font_size: terminalFontSize,
    })
  },
}))
