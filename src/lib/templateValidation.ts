import type { PromptTemplate } from '../stores/promptPaletteStore'

export const TEMPLATE_NAME_MAX = 255
export const TEMPLATE_BODY_MAX = 10000

export type TemplateValidation =
  | { ok: true }
  | { ok: false; nameError?: string; bodyError?: string }

/**
 * テンプレートの name/body を検証する。`selfId` を渡した場合、同名重複チェックから自分自身を除外する。
 * エラーメッセージは i18n キー（`promptPalette.template.editor.error.*`）を返す。
 */
export function validateTemplate(
  name: string,
  body: string,
  existing: PromptTemplate[],
  selfId: string | null,
): TemplateValidation {
  const nameTrim = name.trim()
  const bodyTrim = body.trim()
  let nameError: string | undefined
  let bodyError: string | undefined
  if (nameTrim.length === 0) {
    nameError = 'promptPalette.template.editor.error.nameEmpty'
  } else if (nameTrim.length > TEMPLATE_NAME_MAX) {
    nameError = 'promptPalette.template.editor.error.nameTooLong'
  } else if (
    existing.some((t) => t.id !== selfId && t.name.trim() === nameTrim)
  ) {
    nameError = 'promptPalette.template.editor.error.nameDuplicate'
  }
  if (bodyTrim.length === 0) {
    bodyError = 'promptPalette.template.editor.error.bodyEmpty'
  } else if (body.length > TEMPLATE_BODY_MAX) {
    bodyError = 'promptPalette.template.editor.error.bodyTooLong'
  }
  if (!nameError && !bodyError) return { ok: true }
  return { ok: false, nameError, bodyError }
}
