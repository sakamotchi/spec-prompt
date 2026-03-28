import { useEffect, useLayoutEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { tauriApi } from "../../lib/tauriApi";

interface TerminalPanelProps {
  cwd?: string;
  isActive?: boolean;
}

export function TerminalPanel({ cwd = "/", isActive = true }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

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
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    let unlistenFn: (() => void) | null = null;
    let ptyId: string | null = null;

    const shell = "/bin/zsh";

    tauriApi
      .spawnPty(shell, cwd)
      .then(async (id) => {
        ptyId = id;

        unlistenFn = await tauriApi.onPtyOutput((output) => {
          if (output.id === id) {
            term.write(output.data);
          }
        });

        term.onData((data) => {
          tauriApi.writePty(id, data).catch(console.error);
        });

        term.onResize(({ cols, rows }) => {
          tauriApi.resizePty(id, cols, rows).catch(console.error);
        });
      })
      .catch((err) => {
        term.write(`\r\nPTY 起動エラー: ${err}\r\n`);
      });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      unlistenFn?.();
      if (ptyId) tauriApi.closePty(ptyId).catch(console.error);
      term.dispose();
    };
  }, [cwd]);

  // タブが表示状態に切り替わった時にターミナルサイズを再計算する
  useLayoutEffect(() => {
    if (isActive && fitAddonRef.current) {
      requestAnimationFrame(() => {
        fitAddonRef.current?.fit();
      });
    }
  }, [isActive]);

  return <div ref={containerRef} className="w-full h-full" />;
}
