import { useCallback, useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { BookTemplate, History } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePromptPaletteStore } from '../../stores/promptPaletteStore'
import { tauriApi } from '../../lib/tauriApi'
import { toast } from '../Toast'
import { usePromptHistoryCursor } from '../../hooks/usePromptHistoryCursor'
import { PromptHistoryDropdown } from './PromptHistoryDropdown'
import { PromptTemplateDropdown } from './PromptTemplateDropdown'
import { PromptTemplateEditor } from './PromptTemplateEditor'
import { SlashSuggest, type SlashSuggestHandle } from './SlashSuggest'
import { parseSlashQuery } from '../../lib/slashQuery'
import {
  findNextPlaceholder,
  findPreviousPlaceholder,
} from '../../lib/templatePlaceholders'
import {
  applyTemplateBodyToDraft,
  insertInlineCommand,
} from '../../lib/templateApply'
import type { SlashSuggestItem } from '../../lib/slashSuggestItem'

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
  const editorState = usePromptPaletteStore((s) => s.editorState)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const slashSuggestRef = useRef<SlashSuggestHandle>(null)

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
      state.pushHistory(body)
      state.clearDraft(ptyId)
      state.close()
      window.dispatchEvent(new CustomEvent('terminal:focus'))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(t('promptPalette.error.sendFailed', { message }))
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

  const toggleTemplateDropdown = useCallback(() => {
    const state = usePromptPaletteStore.getState()
    if (state.dropdown === 'template') {
      state.closeDropdown()
    } else {
      state.openDropdown('template')
    }
  }, [])

  // Tab でのプレースホルダ遷移
  const handleTabPlaceholder = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (e.key !== 'Tab') return false
      if (isComposing || e.nativeEvent.isComposing) return false
      if (e.metaKey || e.ctrlKey || e.altKey) return false
      const ta = textareaRef.current
      if (!ta) return false
      const caret = ta.selectionStart ?? 0
      const value = ta.value
      const next = e.shiftKey
        ? findPreviousPlaceholder(value, caret)
        : findNextPlaceholder(value, caret)
      if (!next) return false
      e.preventDefault()
      try {
        ta.setSelectionRange(next.start, next.end)
      } catch {
        // jsdom 用フォールバック
      }
      return true
    },
    [isComposing],
  )

  // SlashSuggest からの選択: kind により挙動を分岐する。
  // - template: 全置換＋プレースホルダ選択状態化
  // - builtin / user-skill / project-skill: draft を `/<name> ` に全置換
  const handleSlashSelect = useCallback((item: SlashSuggestItem) => {
    if (item.kind === 'template') {
      applyTemplateBodyToDraft(item.body)
    } else {
      insertInlineCommand(item.name)
    }
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const state = usePromptPaletteStore.getState()
      const slashActive =
        parseSlashQuery(state.drafts[state.targetPtyId ?? ''] ?? '') !== null
      const dropdownActive = state.dropdown !== 'none'

      // SlashSuggest 表示中は textarea の ↑/↓/Enter/Tab を SlashSuggest 側へ委譲。
      // 修飾付き（Cmd+Enter など送信系）は SlashSuggest 側で非消費のまま返る。
      if (slashActive && slashSuggestRef.current?.handleKeyDown(e)) return

      // Tab プレースホルダ遷移（ドロップダウン・SlashSuggest 非表示時のみ）
      if (!dropdownActive && !slashActive) {
        if (handleTabPlaceholder(e)) return
      }

      // ↑/↓ 履歴巡回（ドロップダウン・SlashSuggest 非表示時のみ）
      if (!dropdownActive && !slashActive) {
        if (handleArrowKey(e)) return
      }

      // Cmd+H / Ctrl+H で履歴ドロップダウン開閉
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

      // Cmd+T / Ctrl+T で テンプレドロップダウン開閉（パレット内スコープ）
      if (
        (e.key === 't' || e.key === 'T') &&
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        !e.altKey &&
        !isComposing &&
        !e.nativeEvent.isComposing
      ) {
        e.preventDefault()
        e.stopPropagation()
        toggleTemplateDropdown()
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
    [
      handleArrowKey,
      handleTabPlaceholder,
      handleSubmit,
      isComposing,
      toggleHistoryDropdown,
      toggleTemplateDropdown,
    ],
  )

  const canSubmit = draft.trim().length > 0

  const submitHint = IS_MAC
    ? t('promptPalette.hint.submit')
    : t('promptPalette.hint.submitCtrl')
  const historyHint = IS_MAC
    ? t('promptPalette.hint.historyOpen')
    : t('promptPalette.hint.historyOpen').replace('⌘H', 'Ctrl+H')
  const templateHint = IS_MAC
    ? t('promptPalette.hint.templateOpen')
    : t('promptPalette.hint.templateOpen').replace('⌘T', 'Ctrl+T')
  const ariaLabel = targetTabName
    ? `${t('promptPalette.ariaLabel')}: ${targetTabName}`
    : t('promptPalette.ariaLabel')

  return (
    <>
      <Dialog.Root
        open={isOpen}
        onOpenChange={(o) => !o && handleCancel()}
        modal={false}
      >
        <Dialog.Portal>
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
              const originalTarget = e.detail.originalEvent.target as Element | null
              if (!originalTarget) return
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
              e.preventDefault()
            }}
            onEscapeKeyDown={(e) => {
              const state = usePromptPaletteStore.getState()
              // ドロップダウン表示中 or エディタ表示中は親パレットを閉じない
              if (state.dropdown !== 'none' || state.editorState !== null) {
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
                <button
                  type="button"
                  onClick={toggleTemplateDropdown}
                  aria-label={t('promptPalette.template.openHint')}
                  title={templateHint}
                  className="flex items-center justify-center w-7 h-7 rounded transition-colors"
                  style={{
                    color:
                      dropdown === 'template'
                        ? 'var(--color-accent)'
                        : 'var(--color-text-muted)',
                    background:
                      dropdown === 'template'
                        ? 'var(--color-bg-panel)'
                        : 'transparent',
                  }}
                >
                  <BookTemplate size={14} />
                </button>
              </div>
            </div>

            {/* 本文 */}
            <div className="p-3">
              <SlashSuggest
                ref={slashSuggestRef}
                draft={draft}
                onSelect={handleSlashSelect}
              />
              {dropdown === 'history' && <PromptHistoryDropdown />}
              {dropdown === 'template' && <PromptTemplateDropdown />}
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
                data-testid={
                  targetPtyId
                    ? `prompt-palette-textarea-${targetPtyId}`
                    : 'prompt-palette-textarea'
                }
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
                    background: canSubmit
                      ? 'var(--color-accent)'
                      : 'var(--color-border)',
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
      {editorState !== null && <PromptTemplateEditor />}
    </>
  )
}
