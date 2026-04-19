import { create } from 'zustand'
import { tauriApi } from '../lib/tauriApi'
import i18n from '../i18n'

export type Theme = 'dark' | 'light' | 'system'
export type Language = 'ja' | 'en'

const LANGUAGE_KEY = 'spec-prompt-language'

export interface AppearanceSettings {
  theme: Theme
  contentFontFamily: string
  contentFontSize: number
  terminalFontFamily: string
  terminalFontSize: number
  notificationEnabled: boolean
}

export const DEFAULT_SETTINGS: AppearanceSettings = {
  theme: 'dark',
  contentFontFamily: 'system-ui',
  contentFontSize: 16,
  terminalFontFamily: "ui-monospace, 'Cascadia Code', 'Menlo', 'Consolas', monospace",
  terminalFontSize: 14,
  notificationEnabled: true,
}

interface SettingsState extends AppearanceSettings {
  language: Language
  setTheme: (theme: Theme) => void
  setContentFontFamily: (family: string) => void
  setContentFontSize: (size: number) => void
  setTerminalFontFamily: (family: string) => void
  setTerminalFontSize: (size: number) => void
  setNotificationEnabled: (enabled: boolean) => void
  setLanguage: (lang: Language) => void
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
  language: (localStorage.getItem(LANGUAGE_KEY) as Language) ?? 'ja',

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
  setNotificationEnabled: (enabled) => {
    set({ notificationEnabled: enabled })
    get().saveSettings()
  },

  setLanguage: (lang) => {
    set({ language: lang })
    localStorage.setItem(LANGUAGE_KEY, lang)
    i18n.changeLanguage(lang)
  },

  loadSettings: async () => {
    // Rust 側は snake_case の JSON を返す
    const s = await tauriApi.getAppearance()
    const mapped: AppearanceSettings = {
      theme: (s.theme as Theme) ?? 'dark',
      contentFontFamily: s.content_font_family,
      contentFontSize: s.content_font_size,
      terminalFontFamily: s.terminal_font_family,
      terminalFontSize: s.terminal_font_size,
      notificationEnabled: s.notification_enabled ?? true,
    }
    set(mapped)
    applyTheme(mapped.theme)
  },

  saveSettings: async () => {
    const { theme, contentFontFamily, contentFontSize, terminalFontFamily, terminalFontSize, notificationEnabled } = get()
    // Rust 側は snake_case の JSON を期待する
    await tauriApi.saveAppearance({
      theme,
      content_font_family: contentFontFamily,
      content_font_size: contentFontSize,
      terminal_font_family: terminalFontFamily,
      terminal_font_size: terminalFontSize,
      notification_enabled: notificationEnabled,
    })
  },
}))
