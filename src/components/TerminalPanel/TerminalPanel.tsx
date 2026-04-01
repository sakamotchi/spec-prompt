import { useEffect, useLayoutEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { tauriApi } from "../../lib/tauriApi";
import { useTerminalStore } from "../../stores/terminalStore";

interface TerminalPanelProps {
  tabId: string
  cwd?: string;
  isActive?: boolean;
}

export function TerminalPanel({ tabId, cwd = "/", isActive = true }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const getTab = () => {
      const s = useTerminalStore.getState()
      return s.primary.tabs.find((t) => t.id === tabId) ?? s.secondary.tabs.find((t) => t.id === tabId)
    }

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'Geist Mono', monospace",
      theme: {
        background: "#0d0d0d",
        foreground: "#e8e8e8",
        cursor: "#7c6af7",
        selectionBackground: "#7c6af740",
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    // タブ移動後の再マウント時はスクロールバックを復元
    const existingTab = getTab()
    if (existingTab?.scrollback) {
      term.write(existingTab.scrollback)
    }

    fitAddon.fit();
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    let unlistenFn: (() => void) | null = null;
    let activePtyId = existingTab?.ptyId ?? null

    const attachToPty = async (ptyId: string): Promise<void> => {
      unlistenFn = await tauriApi.onPtyOutput((output) => {
        if (output.id === ptyId) {
          term.write(output.data);
          useTerminalStore.getState().appendScrollback(tabId, output.data)
        }
      });

      term.onData((data) => {
        tauriApi.writePty(ptyId, data).catch(console.error);
      });

      term.onResize(({ cols, rows }) => {
        tauriApi.resizePty(ptyId, cols, rows).catch(console.error);
      });
    }

    if (activePtyId) {
      // タブ移動後：既存 PTY に接続し、現在のサイズを同期
      attachToPty(activePtyId).then(() => {
        tauriApi.resizePty(activePtyId!, term.cols, term.rows).catch(console.error)
      })
    } else {
      // 新規タブ：PTY を起動し、現在のサイズを同期
      tauriApi
        .spawnPty("/bin/zsh", cwd)
        .then(async (id) => {
          activePtyId = id;
          useTerminalStore.getState().setPtyId(tabId, id)
          await attachToPty(id)
          tauriApi.resizePty(id, term.cols, term.rows).catch(console.error)
        })
        .catch((err) => {
          term.write(`\r\nPTY 起動エラー: ${err}\r\n`);
        });
    }

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      unlistenFn?.();

      // タブがストアから削除された場合のみ PTY を閉じる（移動時は閉じない）
      const s = useTerminalStore.getState()
      const tabExists =
        s.primary.tabs.some((t) => t.id === tabId) ||
        s.secondary.tabs.some((t) => t.id === tabId)
      if (!tabExists && activePtyId) {
        tauriApi.closePty(activePtyId).catch(console.error);
      }

      term.dispose();
    };
  }, [tabId, cwd]);

  useLayoutEffect(() => {
    if (isActive) {
      requestAnimationFrame(() => {
        fitAddonRef.current?.fit();
        termRef.current?.focus();
      });
    }
  }, [isActive]);

  return <div ref={containerRef} className="w-full h-full" />;
}
