import { useEffect, useState } from "react";
import { tauriApi } from "../../lib/tauriApi";
import { useTerminalStore } from "../../stores/terminalStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { TerminalRenderer } from "./TerminalRenderer";

function resolveTheme(theme: string): 'dark' | 'light' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme as 'dark' | 'light'
}

interface TerminalPanelProps {
  tabId: string
  cwd?: string;
  isActive?: boolean;
}

export function TerminalPanel({ tabId, cwd = "/" }: TerminalPanelProps) {
  const terminalFontFamily = useSettingsStore((s) => s.terminalFontFamily)
  const terminalFontSize = useSettingsStore((s) => s.terminalFontSize)
  const theme = useSettingsStore((s) => s.theme)
  const resolvedTheme = resolveTheme(theme)

  const [rendererPtyId, setRendererPtyId] = useState<string | null>(null)

  useEffect(() => {
    const getTab = () => {
      const s = useTerminalStore.getState()
      return s.primary.tabs.find((t) => t.id === tabId) ?? s.secondary.tabs.find((t) => t.id === tabId)
    }

    let cancelled = false
    const existingTab = getTab()
    let activePtyId = existingTab?.ptyId ?? null

    const setupPty = async () => {
      if (activePtyId) {
        setRendererPtyId(activePtyId)
        return
      }

      try {
        const notificationEnabled = useSettingsStore.getState().notificationEnabled
        const id = await tauriApi.spawnPty("/bin/zsh", cwd, notificationEnabled)
        if (cancelled) {
          tauriApi.closePty(id).catch(console.error)
          return
        }
        activePtyId = id
        useTerminalStore.getState().setPtyId(tabId, id)
        setRendererPtyId(id)
      } catch (err) {
        console.error('PTY spawn failed:', err)
      }
    }

    setupPty().catch(console.error)

    return () => {
      cancelled = true
      const s = useTerminalStore.getState()
      const tabExists =
        s.primary.tabs.some((t) => t.id === tabId) ||
        s.secondary.tabs.some((t) => t.id === tabId)
      if (!tabExists && activePtyId) {
        tauriApi.closePty(activePtyId).catch(console.error)
      }
    }
  }, [tabId, cwd])

  return (
    <TerminalRenderer
      ptyId={rendererPtyId}
      fontFamily={terminalFontFamily}
      fontSize={terminalFontSize}
      theme={resolvedTheme}
    />
  )
}
