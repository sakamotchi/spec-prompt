import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import "@xterm/xterm/css/xterm.css";
import i18n from "../../i18n";
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

// WKWebView では CSS カスケードの適用が遅延するため、charSizeService の計測用スパンに
// フォントを直接設定することで非システムフォントの計測精度を保証する
function applyFontToMeasureElement(container: HTMLElement, fontFamily: string) {
  const measureEl = container.querySelector<HTMLElement>('.xterm-char-measure-element')
  if (measureEl) measureEl.style.fontFamily = toFontFamilyCSS(fontFamily)
}

export function TerminalPanel({ tabId, cwd = "/", isActive = true }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const ptyIdRef = useRef<string | null>(null);
  // 非表示中にフォントが変更されたとき、表示時に再計測が必要なことを示すフラグ
  const needsRemeasureRef = useRef(false);
  // フレッシュスパンで計測した文字幅（ResizeObserver / useLayoutEffect で charSizeService の
  // DOM 計測をバイパスするためにキャッシュする。フォント変更時に recreateTerminal でリセット）
  const charWidthRef = useRef(0);

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
        termRef.current?.write(`\r\n${i18n.t('terminal.error.ptyStart', { error: err })}\r\n`);
      }
    }

    setupPty().catch(console.error)

    const resizeObserver = new ResizeObserver(() => {
      const w = containerRef.current?.offsetWidth ?? 0

      // コンテナが極小（非表示/最小化）のときは fit/sync をスキップして端末サイズを保持する。
      // これにより content view に切り替えた際に cols が 6 などに縮小されるのを防ぐ。
      if (w < 50) return

      // 非表示中に作成・フォント変更されたターミナルが表示されたとき、
      // nudge + fit では _afterResize() による charSizeService 汚染を防げないため
      // 可視状態で再作成することで正確な文字幅を保証する。
      if (needsRemeasureRef.current) {
        needsRemeasureRef.current = false
        setRecreateKey((k) => k + 1)
        return
      }

      const t = termRef.current
      const fa = fitAddonRef.current
      if (!t || !fa) return

      const cachedWidth = charWidthRef.current
      if (cachedWidth > 0) {
        // フレッシュスパンで計測済みの正確な文字幅をキャッシュから使い、
        // DOM 計測（WKWebView で不正確）をバイパスして charSizeService を直接更新する
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const core = (t as any)._core
        const svc = core?._charSizeService
        const renderSvc = core?._renderService
        if (svc && renderSvc) {
          svc.width = cachedWidth
          renderSvc.handleCharSizeChanged()
          requestAnimationFrame(() => {
            fa.fit()
            syncPtySize()
            // fit() 内の _afterResize() が svc.width を DOM 計測で上書きするため再適用する
            svc.width = cachedWidth
            renderSvc.handleCharSizeChanged()
            t.refresh(0, t.rows - 1)
          })
          return
        }
      }

      // フォールバック: charWidth 未計測の場合は nudge ベースの DOM 計測を使う
      if (containerRef.current) {
        applyFontToMeasureElement(containerRef.current, useSettingsStore.getState().terminalFontFamily)
      }
      const sz = t.options.fontSize!
      t.options.fontSize = sz + 0.001
      t.options.fontSize = sz
      requestAnimationFrame(() => {
        fa.fit()
        syncPtySize()
        const sz2 = t.options.fontSize!
        t.options.fontSize = sz2 + 0.001
        t.options.fontSize = sz2
        t.refresh(0, t.rows - 1)
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

      // フォント計測キャッシュをリセット（フレッシュスパン計測完了まで ResizeObserver はフォールバックを使う）
      charWidthRef.current = 0

      // 旧ターミナルのDOM残骸を確実に除去
      containerRef.current.innerHTML = ''

      const isDark = resolveTheme(useSettingsStore.getState().theme) === 'dark'
      term = new Terminal({
        cursorBlink: true,
        fontSize: terminalFontSize,
        fontFamily: toFontFamilyCSS(terminalFontFamily),
        theme: buildXtermTheme(isDark),
        allowProposedApi: true,
      });

      fitAddon = new FitAddon();
      const unicode11Addon = new Unicode11Addon();
      term.loadAddon(unicode11Addon);
      term.unicode.activeVersion = '11';
      term.loadAddon(fitAddon);
      term.open(containerRef.current);

      // .xterm-char-measure-element は body の font-family を継承するため、
      // .xterm 要素と計測用スパンの両方に正しい font-family を直接設定する。
      // inline style による直接設定により WKWebView の CSS カスケード遅延を回避する。
      const xtermEl = containerRef.current.querySelector<HTMLElement>('.xterm')
      if (xtermEl) xtermEl.style.fontFamily = toFontFamilyCSS(terminalFontFamily)
      applyFontToMeasureElement(containerRef.current, terminalFontFamily)

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
    // charSizeService の計測用スパンは再利用されるため WKWebView の内部フォントキャッシュの
    // 影響を受けることがある。独立した新規スパンを DOM に追加し 2 RAF 待機することで
    // WKWebView が非システムフォントを確実に適用してから offsetWidth を読み取る。
    requestAnimationFrame(() => {
      if (cancelled || !term || !fitAddon) return

      // 独立した計測スパンを作成する（charSizeService の measure element とは別）
      const testSpan = document.createElement('span')
      testSpan.style.cssText =
        `font-family:${toFontFamilyCSS(terminalFontFamily)};` +
        `font-size:${terminalFontSize}px;` +
        'position:absolute;top:-9999px;left:-9999px;' +
        'visibility:hidden;white-space:nowrap;pointer-events:none;'
      testSpan.textContent = 'W'.repeat(32)
      document.body.appendChild(testSpan)

      // RAF1 → WKWebView がスパンに非システムフォントを適用するペイントサイクル
      requestAnimationFrame(() => {
        if (cancelled || !term || !fitAddon) {
          testSpan.remove()
          return
        }
        // RAF2 → 確実に適用されてから offsetWidth を読み取る
        requestAnimationFrame(() => {
          const charWidth = testSpan.offsetWidth / 32
          testSpan.remove()

          if (cancelled || !term || !fitAddon) return
          if (!containerRef.current || containerRef.current.offsetWidth === 0) {
            needsRemeasureRef.current = true
            return
          }
          needsRemeasureRef.current = false

          if (charWidth > 0) {
            // 計測した正確な文字幅をキャッシュし、charSizeService に反映して cols を再計算する
            charWidthRef.current = charWidth
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const core = (term as any)._core
            const svc = core?._charSizeService
            const renderSvc = core?._renderService
            if (svc && renderSvc) {
              svc.width = charWidth
              renderSvc.handleCharSizeChanged()

              // fit() 内の _afterResize() → charSizeService.measure()（DOM 計測）が
              // svc.width を上書きするため、fit() 後に再度 charWidth を適用し直す
              fitAddon.fit()
              svc.width = charWidth
              renderSvc.handleCharSizeChanged()

              term.refresh(0, term.rows - 1)
              const ptyId = ptyIdRef.current
              if (ptyId) tauriApi.resizePty(ptyId, term.cols, term.rows).catch(console.error)
              return
            }
          }

          // フォールバック: charSizeService へのアクセスに失敗した場合は nudge を使う
          applyFontToMeasureElement(containerRef.current, terminalFontFamily)
          const sz = term.options.fontSize ?? terminalFontSize
          term.options.fontSize = sz + 0.001
          term.options.fontSize = sz
          fitAddon.fit()
          term.options.fontSize = sz + 0.001
          term.options.fontSize = sz
          term.refresh(0, term.rows - 1)
          const ptyId = ptyIdRef.current
          if (ptyId) tauriApi.resizePty(ptyId, term.cols, term.rows).catch(console.error)
        })
      })
    })

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
        const cachedWidth = charWidthRef.current

        if (needsRemeasureRef.current && t && fa) {
          needsRemeasureRef.current = false
          const currentFont = useSettingsStore.getState().terminalFontFamily
          const xtermEl = containerRef.current?.querySelector<HTMLElement>('.xterm')
          if (xtermEl) xtermEl.style.fontFamily = toFontFamilyCSS(currentFont)
          if (containerRef.current) applyFontToMeasureElement(containerRef.current, currentFont)

          if (cachedWidth > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const core = (t as any)._core
            const svc = core?._charSizeService
            const renderSvc = core?._renderService
            if (svc && renderSvc) {
              svc.width = cachedWidth
              renderSvc.handleCharSizeChanged()
              requestAnimationFrame(() => {
                fa.fit()
                svc.width = cachedWidth
                renderSvc.handleCharSizeChanged()
                t.refresh(0, t.rows - 1)
                const ptyId = ptyIdRef.current
                if (ptyId) tauriApi.resizePty(ptyId, t.cols, t.rows).catch(console.error)
                t.focus()
              })
              return
            }
          }

          // フォールバック: nudge ベース
          const sz = t.options.fontSize!
          t.options.fontSize = sz + 0.001
          t.options.fontSize = sz
          requestAnimationFrame(() => {
            fa.fit()
            const sz2 = t.options.fontSize!
            t.options.fontSize = sz2 + 0.001
            t.options.fontSize = sz2
            t.refresh(0, t.rows - 1)
            const ptyId = ptyIdRef.current
            if (ptyId) tauriApi.resizePty(ptyId, t.cols, t.rows).catch(console.error)
            t.focus()
          })
        } else if (t && fa) {
          if (cachedWidth > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const core = (t as any)._core
            const svc = core?._charSizeService
            const renderSvc = core?._renderService
            if (svc && renderSvc) {
              svc.width = cachedWidth
              renderSvc.handleCharSizeChanged()
              fa.fit()
              svc.width = cachedWidth
              renderSvc.handleCharSizeChanged()
              t.refresh(0, t.rows - 1)
              t.focus()
              return
            }
          }

          // フォールバック: nudge ベース
          if (containerRef.current) {
            applyFontToMeasureElement(containerRef.current, useSettingsStore.getState().terminalFontFamily)
          }
          const sz = t.options.fontSize!
          t.options.fontSize = sz + 0.001
          t.options.fontSize = sz
          fa.fit()
          t.options.fontSize = sz + 0.001
          t.options.fontSize = sz
          t.refresh(0, t.rows - 1)
          t.focus()
        }
      });
    }
  }, [isActive]);

  return <div ref={containerRef} className="w-full h-full" />;
}
