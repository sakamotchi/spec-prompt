import { useCallback, useEffect, useMemo, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { useTranslation } from 'react-i18next'
import {
  usePromptPaletteStore,
  type PromptTemplate,
} from '../../stores/promptPaletteStore'
import { TEMPLATE_NAME_MAX, validateTemplate } from '../../lib/templateValidation'

export interface PromptTemplateEditorProps {
  onAfterSave?: (template: PromptTemplate) => void
}

export function PromptTemplateEditor({ onAfterSave }: PromptTemplateEditorProps = {}) {
  const { t } = useTranslation()
  const editorState = usePromptPaletteStore((s) => s.editorState)
  const templates = usePromptPaletteStore((s) => s.templates)

  const currentTemplate = useMemo<PromptTemplate | null>(() => {
    if (editorState?.mode === 'edit') {
      return templates.find((t) => t.id === editorState.templateId) ?? null
    }
    return null
  }, [editorState, templates])

  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  // editorState が変わるたびに初期値を再設定
  useEffect(() => {
    if (!editorState) return
    if (editorState.mode === 'create') {
      setName('')
      setBody(editorState.initialBody ?? '')
    } else if (editorState.mode === 'edit' && currentTemplate) {
      setName(currentTemplate.name)
      setBody(currentTemplate.body)
    }
    setConfirmingDelete(false)
  }, [editorState, currentTemplate])

  const validation = useMemo(
    () => validateTemplate(name, body, templates, currentTemplate?.id ?? null),
    [name, body, templates, currentTemplate],
  )
  const canSave = validation.ok

  const handleSave = useCallback(() => {
    if (!canSave) return
    const state = usePromptPaletteStore.getState()
    const saved = state.upsertTemplate({
      id: currentTemplate?.id,
      name: name.trim(),
      body,
      tags: currentTemplate?.tags,
    })
    state.closeEditor()
    onAfterSave?.(saved)
  }, [canSave, currentTemplate, name, body, onAfterSave])

  const handleCancel = useCallback(() => {
    usePromptPaletteStore.getState().closeEditor()
  }, [])

  const handleDelete = useCallback(() => {
    if (!currentTemplate) return
    usePromptPaletteStore.getState().removeTemplate(currentTemplate.id)
    usePromptPaletteStore.getState().closeEditor()
    setConfirmingDelete(false)
  }, [currentTemplate])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (
        e.key === 'Enter' &&
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        !e.altKey
      ) {
        e.preventDefault()
        handleSave()
      }
    },
    [handleSave],
  )

  const isOpen = editorState !== null
  const isEdit = editorState?.mode === 'edit'

  return (
    <Dialog.Root open={isOpen} onOpenChange={(o) => !o && handleCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-[55]"
          style={{ background: 'rgba(0,0,0,0.5)' }}
        />
        <Dialog.Content
          data-palette-dropdown="editor"
          className="fixed left-1/2 top-1/2 z-[60] w-[560px] max-w-[90vw] rounded-lg overflow-hidden"
          style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border)',
            transform: 'translate(-50%, -50%)',
            color: 'var(--color-text-primary)',
          }}
          onKeyDown={handleKeyDown}
          aria-label={t('promptPalette.template.editor.title')}
        >
          <div
            className="flex items-center px-4 h-10 border-b text-sm font-semibold"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <Dialog.Title>{t('promptPalette.template.editor.title')}</Dialog.Title>
          </div>
          <Dialog.Description className="sr-only">
            {t('promptPalette.template.editor.title')}
          </Dialog.Description>

          <div className="p-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs">
              <span style={{ color: 'var(--color-text-muted)' }}>
                {t('promptPalette.template.editor.name')}
              </span>
              <input
                aria-label={t('promptPalette.template.editor.name')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="px-2 py-1 text-sm outline-none rounded"
                style={{
                  background: 'var(--color-bg-panel)',
                  border: `1px solid ${
                    !validation.ok && validation.nameError
                      ? '#dc2626'
                      : 'var(--color-border)'
                  }`,
                  color: 'var(--color-text-primary)',
                }}
                maxLength={TEMPLATE_NAME_MAX + 10}
              />
              {!validation.ok && validation.nameError && (
                <span className="text-[11px]" style={{ color: '#dc2626' }}>
                  {t(validation.nameError)}
                </span>
              )}
            </label>

            <label className="flex flex-col gap-1 text-xs">
              <span style={{ color: 'var(--color-text-muted)' }}>
                {t('promptPalette.template.editor.body')}
              </span>
              <textarea
                aria-label={t('promptPalette.template.editor.body')}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                spellCheck={false}
                className="px-2 py-1 text-sm outline-none rounded font-mono"
                style={{
                  background: 'var(--color-bg-panel)',
                  border: `1px solid ${
                    !validation.ok && validation.bodyError
                      ? '#dc2626'
                      : 'var(--color-border)'
                  }`,
                  color: 'var(--color-text-primary)',
                  resize: 'vertical',
                  minHeight: '10rem',
                }}
              />
              {!validation.ok && validation.bodyError && (
                <span className="text-[11px]" style={{ color: '#dc2626' }}>
                  {t(validation.bodyError)}
                </span>
              )}
            </label>
          </div>

          <div
            className="flex items-center justify-between px-4 h-11 border-t"
            style={{ borderColor: 'var(--color-border)' }}
          >
            {isEdit ? (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="px-3 h-7 rounded text-xs"
                style={{
                  color: '#dc2626',
                  border: '1px solid var(--color-border)',
                  background: 'transparent',
                }}
              >
                {t('promptPalette.template.delete')}
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 h-7 rounded text-xs"
                style={{
                  color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                  background: 'transparent',
                }}
              >
                {t('promptPalette.template.editor.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="px-3 h-7 rounded text-xs font-semibold"
                style={{
                  color: '#fff',
                  background: canSave ? 'var(--color-accent)' : 'var(--color-border)',
                  opacity: canSave ? 1 : 0.6,
                  cursor: canSave ? 'pointer' : 'not-allowed',
                }}
              >
                {t('promptPalette.template.editor.save')}
              </button>
            </div>
          </div>

          <AlertDialog.Root
            open={confirmingDelete}
            onOpenChange={(o) => !o && setConfirmingDelete(false)}
          >
            <AlertDialog.Portal>
              <AlertDialog.Overlay
                className="fixed inset-0 z-[65]"
                style={{ background: 'rgba(0,0,0,0.5)' }}
              />
              <AlertDialog.Content
                className="fixed left-1/2 top-1/2 z-[75] w-[380px] max-w-[90vw] rounded-lg p-4"
                style={{
                  background: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border)',
                  transform: 'translate(-50%, -50%)',
                  color: 'var(--color-text-primary)',
                }}
              >
                <AlertDialog.Title className="text-sm font-semibold mb-2">
                  {t('promptPalette.template.delete')}
                </AlertDialog.Title>
                <AlertDialog.Description
                  className="text-xs mb-4"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {t('promptPalette.template.editor.deleteConfirm')}
                </AlertDialog.Description>
                <div className="flex justify-end gap-2">
                  <AlertDialog.Cancel asChild>
                    <button
                      type="button"
                      className="px-3 h-7 rounded text-xs"
                      style={{
                        color: 'var(--color-text-muted)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      {t('promptPalette.template.editor.cancel')}
                    </button>
                  </AlertDialog.Cancel>
                  <AlertDialog.Action asChild>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="px-3 h-7 rounded text-xs font-semibold"
                      style={{ background: '#dc2626', color: '#fff' }}
                    >
                      {t('promptPalette.template.delete')}
                    </button>
                  </AlertDialog.Action>
                </div>
              </AlertDialog.Content>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
