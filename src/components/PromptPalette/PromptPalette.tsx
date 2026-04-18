import { useCallback, useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { History } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePromptPaletteStore } from '../../stores/promptPaletteStore'
import { tauriApi } from '../../lib/tauriApi'
import { toast } from '../Toast'
import { usePromptHistoryCursor } from '../../hooks/usePromptHistoryCursor'
import { PromptHistoryDropdown } from './PromptHistoryDropdown'

const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iP(hone|od|ad)/.test(navigator.platform)

export function PromptPalette() {
  const { t } = useTranslation()
  const isOpen = usePromptPaletteStore((s) => s.isOpen)
  const targetPtyId = usePromptPaletteStore((s) => s.targetPtyId)
  const targetTabName = usePromptPaletteStore((s) => s.targetTabName)
  const draft = usePromptPaletteStore((s) =>
    s.targetPtyId ? s.drafts[s.targetPtyId] ?? '' : '',
  )
  const dropdown = usePromptPaletteStore((s) => s.dropdown)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // IME 変換中は Enter / Cmd+Enter を送信扱いにしない。
  // e.nativeEvent.isComposing と state の OR で二重ガード（ブラウザ差異対策）。
  const [isComposing, setIsComposing] = useState(false)

  // パス挿入直後の視覚フィードバック（F4-2）。
  // prefers-reduced-motion 設定時はスキップする。
  const lastInsertAt = usePromptPaletteStore((s) => s.lastInsertAt)
  const [flashing, setFlashing] = useState(false)
  useEffect(() => {
    if (!lastInsertAt) return
    if (typeof window === 'undefined') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    setFlashing(true)
    const id = window.setTimeout(() => setFlashing(false), 300)
    return () => window.clearTimeout(id)
  }, [lastInsertAt])

  // textarea ref を store に登録（パス挿入ディスパッチのパレット分岐で使用）
  useEffect(() => {
    const register = usePromptPaletteStore.getState().registerTextarea
    register(textareaRef)
    return () => register(null)
  }, [])

  // 履歴巡回フック
  const { handleArrowKey, resetCursor } = usePromptHistoryCursor({
    textareaRef,
    isComposing,
  })

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const ptyId = usePromptPaletteStore.getState().targetPtyId
      if (!ptyId) return
      usePromptPaletteStore.getState().setDraft(ptyId, e.target.value)
      resetCursor()
    },
    [resetCursor],
  )

  const handleSubmit = useCallback(async () => {
    const state = usePromptPaletteStore.getState()
    const ptyId = state.targetPtyId
    if (!ptyId) return
    const body = (state.drafts[ptyId] ?? '').replace(/\s+$/u, '')
    if (body.length === 0) return
    try {
      await tauriApi.writePty(ptyId, body + '\n')
      // 送信成功時のみ履歴へ追加（clearDraft より前）
      state.pushHistory(body)
      state.clearDraft(ptyId)
      state.close()
      window.dispatchEvent(new CustomEvent('terminal:focus'))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(t('promptPalette.error.sendFailed', { message }))
      // 失敗時はパレットと本文を維持し、ユーザーが再送信できるようにする
    }
  }, [t])

  const handleCancel = useCallback(() => {
    usePromptPaletteStore.getState().close()
  }, [])

  const toggleHistoryDropdown = useCallback(() => {
    const state = usePromptPaletteStore.getState()
    if (state.dropdown === 'history') {
      state.closeDropdown()
    } else {
      state.openDropdown('history')
    }
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // ↑/↓ 履歴巡回（空 textarea または巡回中のみ）
      if (handleArrowKey(e)) return

      // Cmd+H (mac) / Ctrl+H (win/linux) で履歴ドロップダウン開閉
      if (
        (e.key === 'h' || e.key === 'H') &&
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        !e.altKey &&
        !isComposing &&
        !e.nativeEvent.isComposing
      ) {
        e.preventDefault()
        e.stopPropagation()
        toggleHistoryDropdown()
        return
      }

      // Cmd+Enter (mac) / Ctrl+Enter (win/linux) で送信
      if (
        e.key === 'Enter' &&
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        !e.altKey &&
        !isComposing &&
        !e.nativeEvent.isComposing
      ) {
        e.preventDefault()
        e.stopPropagation()
        void handleSubmit()
      }
    },
    [handleArrowKey, handleSubmit, isComposing, toggleHistoryDropdown],
  )

  const canSubmit = draft.trim().length > 0

  const submitHint = IS_MAC ? t('promptPalette.hint.submit') : t('promptPalette.hint.submitCtrl')
  const historyHint = IS_MAC
    ? t('promptPalette.hint.historyOpen')
    : t('promptPalette.hint.historyOpen').replace('⌘H', 'Ctrl+H')
  const ariaLabel = targetTabName
    ? `${t('promptPalette.ariaLabel')}: ${targetTabName}`
    : t('promptPalette.ariaLabel')

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(o) => !o && handleCancel()}
      modal={false}
    >
      <Dialog.Portal>
        {/* non-modal: オーバーレイは視覚的な薄掛けのみで、ツリー等へのクリックを透過させる */}
        <Dialog.Overlay
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.35)', pointerEvents: 'none' }}
        />
        <Dialog.Content
          className="fixed left-1/2 top-1/3 z-50 w-[640px] max-w-[90vw] rounded-lg shadow-2xl overflow-hidden"
          style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border)',
            transform: 'translateX(-50%)',
          }}
          aria-label={ariaLabel}
          onPointerDownOutside={(e) => {
            // Radix の pointerDownOutside は CustomEvent。実 DOM ターゲットは
            // e.detail.originalEvent.target に入る。
            const originalTarget = e.detail.originalEvent.target as Element | null
            if (!originalTarget) return
            // ツリー / 右クリックメニュー / Ctrl+P パレットからの操作で
            // パレットが閉じないようにする（usePathInsertion で textarea に差し込むため）。
            if (
              originalTarget.closest('[data-panel="tree"]') ||
              originalTarget.closest('[role="menu"]') ||
              originalTarget.closest('[data-radix-menu-content]') ||
              originalTarget.closest('[data-radix-context-menu-content]') ||
              originalTarget.closest('[data-radix-popper-content-wrapper]') ||
              originalTarget.closest('[data-palette-dropdown]')
            ) {
              e.preventDefault()
            }
          }}
          onFocusOutside={(e) => {
            // フォーカスが外側に移動してもパレットは閉じない（textarea にフォーカスを返すため）。
            e.preventDefault()
          }}
          onEscapeKeyDown={(e) => {
            // ドロップダウン表示中の Esc はドロップダウン側で処理し、パレット本体は閉じない。
            // Radix Dialog の Esc は document レベルで処理されるため React の stopPropagation
            // では止まらず、子コンポーネント側の preventDefault だけではパレットも閉じてしまう。
            if (usePromptPaletteStore.getState().dropdown !== 'none') {
              e.preventDefault()
            }
          }}
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            const ta = textareaRef.current
            if (ta) {
              ta.focus()
              const len = ta.value.length
              ta.setSelectionRange(len, len)
            }
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault()
            window.dispatchEvent(new CustomEvent('terminal:focus'))
          }}
        >
          {/* ヘッダ */}
          <div
            className="flex items-center gap-1 px-4 h-10 border-b text-xs"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          >
            <Dialog.Title className="font-semibold">
              {t('promptPalette.title')}
            </Dialog.Title>
            {targetTabName && (
              <>
                <span style={{ color: 'var(--color-text-muted)' }}>
                  {t('promptPalette.targetPrefix')}
                </span>
                <span
                  className="font-mono truncate max-w-[24rem]"
                  style={{ color: 'var(--color-accent)' }}
                >
                  {targetTabName}
                </span>
                <span style={{ color: 'var(--color-text-muted)' }}>
                  {t('promptPalette.targetSuffix')}
                </span>
              </>
            )}
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={toggleHistoryDropdown}
                aria-label={t('promptPalette.history.openHint')}
                title={historyHint}
                className="flex items-center justify-center w-7 h-7 rounded transition-colors"
                style={{
                  color:
                    dropdown === 'history'
                      ? 'var(--color-accent)'
                      : 'var(--color-text-muted)',
                  background:
                    dropdown === 'history'
                      ? 'var(--color-bg-panel)'
                      : 'transparent',
                }}
              >
                <History size={14} />
              </button>
            </div>
          </div>

          {/* 本文 */}
          <div className="p-3">
            {dropdown === 'history' && <PromptHistoryDropdown />}
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              placeholder={t('promptPalette.placeholder')}
              rows={8}
              spellCheck={false}
              className="w-full block text-sm outline-none rounded px-3 py-2 font-mono"
              style={{
                background: 'var(--color-bg-panel)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
                resize: 'vertical',
                minHeight: '10rem',
                boxShadow: flashing ? '0 0 0 2px var(--color-accent)' : 'none',
                transition: 'box-shadow 120ms ease-out',
              }}
              aria-label={t('promptPalette.ariaLabel')}
              data-testid={targetPtyId ? `prompt-palette-textarea-${targetPtyId}` : 'prompt-palette-textarea'}
            />
          </div>

          {/* フッタ */}
          <div
            className="flex items-center justify-between px-4 h-10 border-t text-xs"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-muted)',
            }}
          >
            <div className="flex items-center gap-3">
              <span>{t('promptPalette.hint.newline')}</span>
              <span>·</span>
              <span>{submitHint}</span>
              <span>·</span>
              <span>{t('promptPalette.hint.cancel')}</span>
              <span>·</span>
              <span>{t('promptPalette.hint.historyUp')}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 h-7 rounded text-xs transition-colors"
                style={{
                  color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                  background: 'transparent',
                }}
              >
                {t('promptPalette.button.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={!canSubmit}
                className="px-3 h-7 rounded text-xs transition-colors font-semibold"
                style={{
                  color: '#fff',
                  background: canSubmit ? 'var(--color-accent)' : 'var(--color-border)',
                  opacity: canSubmit ? 1 : 0.6,
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                }}
              >
                {t('promptPalette.button.submit')}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
