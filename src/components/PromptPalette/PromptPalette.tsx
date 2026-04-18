import { useCallback, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useTranslation } from 'react-i18next'
import { usePromptPaletteStore } from '../../stores/promptPaletteStore'
import { tauriApi } from '../../lib/tauriApi'

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

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const ptyId = usePromptPaletteStore.getState().targetPtyId
      if (!ptyId) return
      usePromptPaletteStore.getState().setDraft(ptyId, e.target.value)
    },
    [],
  )

  const handleSubmit = useCallback(async () => {
    const state = usePromptPaletteStore.getState()
    const ptyId = state.targetPtyId
    if (!ptyId) return
    const body = (state.drafts[ptyId] ?? '').replace(/\s+$/u, '')
    if (body.length === 0) return
    try {
      await tauriApi.writePty(ptyId, body + '\n')
      state.clearDraft(ptyId)
      state.close()
      window.dispatchEvent(new CustomEvent('terminal:focus'))
    } catch (err) {
      console.error('Failed to send prompt:', err)
    }
  }, [])

  const handleCancel = useCallback(() => {
    usePromptPaletteStore.getState().close()
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Cmd+Enter (mac) / Ctrl+Enter (win/linux) で送信
      if (
        e.key === 'Enter' &&
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        !e.altKey &&
        !e.nativeEvent.isComposing
      ) {
        e.preventDefault()
        e.stopPropagation()
        void handleSubmit()
      }
    },
    [handleSubmit],
  )

  const canSubmit = draft.trim().length > 0

  const submitHint = IS_MAC ? t('promptPalette.hint.submit') : t('promptPalette.hint.submitCtrl')
  const ariaLabel = targetTabName
    ? `${t('promptPalette.ariaLabel')}: ${targetTabName}`
    : t('promptPalette.ariaLabel')

  return (
    <Dialog.Root open={isOpen} onOpenChange={(o) => !o && handleCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.5)' }}
        />
        <Dialog.Content
          className="fixed left-1/2 top-1/3 z-50 w-[640px] max-w-[90vw] rounded-lg shadow-2xl overflow-hidden"
          style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border)',
            transform: 'translateX(-50%)',
          }}
          aria-label={ariaLabel}
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
          </div>

          {/* 本文 */}
          <div className="p-3">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
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
