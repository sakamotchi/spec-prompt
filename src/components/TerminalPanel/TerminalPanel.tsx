import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { tauriApi } from "../../lib/tauriApi";
import { useTerminalStore } from "../../stores/terminalStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useAppStore } from "../../stores/appStore";

interface TerminalPanelProps {
  tabId: string
  cwd?: string;
  isActive?: boolean;
}

// スペースなしはそのまま、スペースありは CSS クォートで囲む
// DOM レンダラーでは CSS font-family がそのまま解決されるので FontFace 登録不要
function toFontFamilyCSS(family: string): string {
  return family.includes(' ') ? `'${family}'` : family
}

function resolveTheme(theme: string): 'dark' | 'light' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme as 'dark' | 'light'
}

function buildXtermTheme(isDark: boolean) {
  return {
    background: isDark ? '#0d0d0d' : '#ffffff',
    foreground: isDark ? '#e8e8e8' : '#1a1a1a',
    cursor: '#7c6af7',
    selectionBackground: '#7c6af740',
  }
}

export function TerminalPanel({ tabId, cwd = "/", isActive = true }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const ptyIdRef = useRef<string | null>(null);
  // 非表示中にフォントが変更されたとき、表示時に再計測が必要なことを示すフラグ
  const needsRemeasureRef = useRef(false);

  const terminalFontFamily = useSettingsStore((s) => s.terminalFontFamily)
  const terminalFontSize = useSettingsStore((s) => s.terminalFontSize)
  const theme = useSettingsStore((s) => s.theme)
  const resolvedTheme = resolveTheme(theme)
  const activeMainTab = useAppStore((s) => s.activeMainTab)
  const mainLayout = useAppStore((s) => s.mainLayout)
  // フォント変更後にターミナルペインへ切り替えたとき再作成を強制するためのキー
  const [recreateKey, setRecreateKey] = useState(0)

  useEffect(() => {
    if (!containerRef.current) return;

    const getTab = () => {
      const s = useTerminalStore.getState()
      return s.primary.tabs.find((t) => t.id === tabId) ?? s.secondary.tabs.find((t) => t.id === tabId)
    }

    let cancelled = false
    let unlistenFn: (() => void) | null = null;
    const existingTab = getTab()
    let activePtyId = existingTab?.ptyId ?? null
    ptyIdRef.current = activePtyId

    const syncPtySize = () => {
      const term = termRef.current
      const ptyId = ptyIdRef.current
      if (!term || !ptyId) return
      tauriApi.resizePty(ptyId, term.cols, term.rows).catch(console.error)
    }

    const attachOutputListener = async (ptyId: string) => {
      const unlisten = await tauriApi.onPtyOutput((output) => {
        if (output.id !== ptyId) return
        termRef.current?.write(output.data);
        useTerminalStore.getState().appendScrollback(tabId, output.data)
      });
      if (cancelled) {
        unlisten()
        return
      }
      unlistenFn = unlisten
    }

    const setupPty = async () => {
      if (activePtyId) {
        await attachOutputListener(activePtyId)
        syncPtySize()
        return
      }

      try {
        const id = await tauriApi.spawnPty("/bin/zsh", cwd)
        if (cancelled) {
          tauriApi.closePty(id).catch(console.error)
          return
        }
        activePtyId = id
        ptyIdRef.current = id
        useTerminalStore.getState().setPtyId(tabId, id)
        await attachOutputListener(id)
        syncPtySize()
      } catch (err) {
        termRef.current?.write(`\r\nPTY 起動エラー: ${err}\r\n`);
      }
    }

    setupPty().catch(console.error)

    const resizeObserver = new ResizeObserver(() => {
      const w = containerRef.current?.offsetWidth ?? 0

      // コンテナが極小（非表示/最小化）のときは fit/sync をスキップして端末サイズを保持する。
      // これにより content view に切り替えた際に cols が 6 などに縮小されるのを防ぐ。
      if (w < 50) return

      needsRemeasureRef.current = false

      const t = termRef.current
      const fa = fitAddonRef.current
      if (!t || !fa) return

      // fit() 内の _afterResize() が charSizeService を誤った値で上書きすることがある。
      // fit() の直前に fontSize nudge で charSizeService を強制再計測することで
      // 正確な文字幅を保証し、ウィンドウリサイズ時の列数ずれを防ぐ。
      const sz = t.options.fontSize!
      t.options.fontSize = sz + 0.001
      t.options.fontSize = sz
      requestAnimationFrame(() => {
        fa.fit()
        syncPtySize()
      })
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      cancelled = true
      resizeObserver.disconnect();
      unlistenFn?.();

      // タブがストアから削除された場合のみ PTY を閉じる（移動時は閉じない）
      const s = useTerminalStore.getState()
      const tabExists =
        s.primary.tabs.some((t) => t.id === tabId) ||
        s.secondary.tabs.some((t) => t.id === tabId)
      if (!tabExists && activePtyId) {
        tauriApi.closePty(activePtyId).catch(console.error);
        ptyIdRef.current = null
      }
    };
  }, [tabId, cwd]);

  useEffect(() => {
    let cancelled = false
    let term: Terminal | null = null
    let fitAddon: FitAddon | null = null
    let dataDisposable: { dispose(): void } | null = null
    let resizeDisposable: { dispose(): void } | null = null

    const getTab = () => {
      const s = useTerminalStore.getState()
      return s.primary.tabs.find((t) => t.id === tabId) ?? s.secondary.tabs.find((t) => t.id === tabId)
    }

    const recreateTerminal = () => {
      if (!containerRef.current) return

      // 旧ターミナルのDOM残骸を確実に除去
      containerRef.current.innerHTML = ''

      const isDark = resolveTheme(useSettingsStore.getState().theme) === 'dark'
      term = new Terminal({
        cursorBlink: true,
        fontSize: terminalFontSize,
        fontFamily: toFontFamilyCSS(terminalFontFamily),
        theme: buildXtermTheme(isDark),
      });

      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(containerRef.current);

      // .xterm-char-measure-element は body の font-family を継承するため、
      // .xterm 要素に正しい font-family を明示的に設定することで計測精度を確保する。
      const xtermEl = containerRef.current.querySelector<HTMLElement>('.xterm')
      if (xtermEl) xtermEl.style.fontFamily = toFontFamilyCSS(terminalFontFamily)

      const existingTab = getTab()
      if (existingTab?.scrollback) {
        term.write(existingTab.scrollback)
      }

      fitAddon.fit();
      termRef.current = term;
      fitAddonRef.current = fitAddon;

      dataDisposable = term.onData((data) => {
        const ptyId = ptyIdRef.current
        if (!ptyId) return
        tauriApi.writePty(ptyId, data).catch(console.error);
      });

      resizeDisposable = term.onResize(({ cols, rows }) => {
        const ptyId = ptyIdRef.current
        if (!ptyId) return
        tauriApi.resizePty(ptyId, cols, rows).catch(console.error);
      });

      const ptyId = ptyIdRef.current
      if (ptyId) {
        tauriApi.resizePty(ptyId, term.cols, term.rows).catch(console.error)
      }
    }

    recreateTerminal()

    // フォントが WKWebView に確実に反映されてから文字幅を再計測する。
    // term.open() 直後は CSS がまだ適用されていないことがあるため、
    // document.fonts.load() 完了後の requestAnimationFrame で強制再計測する。
    const fontKey = `${terminalFontSize}px ${toFontFamilyCSS(terminalFontFamily)}`
    document.fonts.load(fontKey).then(() => {
      if (cancelled || !term || !fitAddon) return
      requestAnimationFrame(() => {
        if (cancelled || !term || !fitAddon) return
        // 非表示中（offsetWidth === 0）は計測が狂うためスキップし、
        // ResizeObserver 発火時に再計測するようフラグを立てる
        if (!containerRef.current || containerRef.current.offsetWidth === 0) {
          needsRemeasureRef.current = true
          return
        }
        needsRemeasureRef.current = false
        // xterm.js OptionsService は値が同じだと onOptionChange を発火しない。
        // 微小変化 → 元値 の 2 回代入で CharSizeService.measure() を強制実行する。
        const sz = term.options.fontSize ?? terminalFontSize
        term.options.fontSize = sz + 0.001
        term.options.fontSize = sz
        fitAddon.fit()
        const ptyId = ptyIdRef.current
        if (ptyId) tauriApi.resizePty(ptyId, term.cols, term.rows).catch(console.error)
      })
    }).catch(() => { /* フォントが見つからない場合は無視 */ })

    return () => {
      cancelled = true
      dataDisposable?.dispose()
      resizeDisposable?.dispose()
      if (termRef.current === term) termRef.current = null
      if (fitAddonRef.current === fitAddon) fitAddonRef.current = null
      term?.dispose()
    }
  }, [tabId, terminalFontFamily, terminalFontSize, recreateKey])

  // コンテンツ→ターミナルへ切り替えたとき、非表示中にフォントが変更されていれば再作成する
  useEffect(() => {
    // splitモードは常に両ペインが表示されているのでスキップ
    if (mainLayout === 'split') return
    if (activeMainTab !== 'terminal') return
    if (!needsRemeasureRef.current) return
    needsRemeasureRef.current = false
    setRecreateKey((k) => k + 1)
  }, [activeMainTab, mainLayout])

  // テーマ変更を xterm.js に反映
  useEffect(() => {
    if (!termRef.current) return
    termRef.current.options.theme = buildXtermTheme(resolvedTheme === 'dark')
  }, [resolvedTheme])

  useLayoutEffect(() => {
    if (isActive) {
      requestAnimationFrame(() => {
        const t = termRef.current
        const fa = fitAddonRef.current
        // 非表示中にフォントが変更されていた場合のみ再計測する
        if (needsRemeasureRef.current && t && fa) {
          needsRemeasureRef.current = false
          // .xterm に正しい font-family を再設定してから CharSizeService に再計測させる。
          // fontSize nudge で CharSizeService.measure() を起動し、その結果が
          // _renderService.dimensions に伝播するのを待つためダブル RAF で fit() する。
          const xtermEl = containerRef.current?.querySelector<HTMLElement>('.xterm')
          if (xtermEl) xtermEl.style.fontFamily = toFontFamilyCSS(useSettingsStore.getState().terminalFontFamily)
          const sz = t.options.fontSize!
          t.options.fontSize = sz + 0.001
          t.options.fontSize = sz
          requestAnimationFrame(() => {
            fa.fit()
            const ptyId = ptyIdRef.current
            if (ptyId) tauriApi.resizePty(ptyId, t.cols, t.rows).catch(console.error)
            t.focus()
          })
        } else {
          fa?.fit()
          t?.focus()
        }
      });
    }
  }, [isActive]);

  return <div ref={containerRef} className="w-full h-full" />;
}
