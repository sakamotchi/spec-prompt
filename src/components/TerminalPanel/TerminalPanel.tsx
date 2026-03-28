import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { tauriApi } from "../../lib/tauriApi";

interface TerminalPanelProps {
  cwd?: string;
}

export function TerminalPanel({ cwd = "/" }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const ptyIdRef = useRef<string | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "monospace",
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
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

    // PTY を起動してイベントリスナーを登録
    tauriApi
      .spawnPty(shell, cwd)
      .then(async (id) => {
        ptyId = id;
        ptyIdRef.current = id;

        unlistenFn = await tauriApi.onPtyOutput((output) => {
          if (output.id === id) {
            term.write(output.data);
          }
        });

        // キー入力を PTY に送信
        term.onData((data) => {
          tauriApi.writePty(id, data).catch(console.error);
        });

        // リサイズ時に PTY を更新
        term.onResize(({ cols, rows }) => {
          tauriApi.resizePty(id, cols, rows).catch(console.error);
        });
      })
      .catch((err) => {
        term.write(`\r\nPTY 起動エラー: ${err}\r\n`);
      });

    // ウィンドウリサイズに追従
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

  return <div ref={containerRef} className="w-full h-full" />;
}
