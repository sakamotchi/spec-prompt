/**
 * ウィンドウセッション管理
 *
 * 方式:
 *   - 追加ウィンドウは自身の projectRoot を `sddesk-win-{label}` キーに随時保存する
 *   - メインウィンドウが閉じるとき、全 `sddesk-win-*` キーを読み取って
 *     `sddesk-window-sessions` に統合保存する
 *   - 追加ウィンドウが明示的に閉じられたとき、自身のキーを削除する
 *   - 次回起動時、メインウィンドウは統合セッションを読み取って追加ウィンドウを復元する
 */

import { migrateLegacyKey, migrateLegacyKeyPrefix } from './legacyStorageMigration'

const CONSOLIDATED_KEY = 'sddesk-window-sessions'
const PER_WINDOW_PREFIX = 'sddesk-win-'

// SpecPrompt → SDDesk 改名 (2026-04-21) の旧キー
const LEGACY_CONSOLIDATED_KEY = 'specprompt-window-sessions'
const LEGACY_PER_WINDOW_PREFIX = 'specprompt-win-'

migrateLegacyKey(LEGACY_CONSOLIDATED_KEY, CONSOLIDATED_KEY)
migrateLegacyKeyPrefix(LEGACY_PER_WINDOW_PREFIX, PER_WINDOW_PREFIX)

export interface WindowSession {
  label: string
  projectRoot: string | null
}

/** 追加ウィンドウ: マウント時およびプロジェクト変更時に呼び出す */
export function saveMySession(label: string, projectRoot: string | null): void {
  localStorage.setItem(PER_WINDOW_PREFIX + label, JSON.stringify({ projectRoot }))
}

/** 追加ウィンドウ: 明示的に閉じられたとき、自身のキーを削除する */
export function clearMySession(label: string): void {
  localStorage.removeItem(PER_WINDOW_PREFIX + label)
}

/**
 * メインウィンドウ: 閉じるときに呼び出す。
 * 生きている追加ウィンドウのセッションを統合保存する。
 */
export function consolidateAndSave(): void {
  // まず全 per-window キーを収集（イテレーション中に変更しないよう先に取得）
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(PER_WINDOW_PREFIX)) keys.push(key)
  }

  const sessions: WindowSession[] = []
  for (const key of keys) {
    const label = key.slice(PER_WINDOW_PREFIX.length)
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const { projectRoot } = JSON.parse(raw) as { projectRoot: string | null }
        sessions.push({ label, projectRoot })
      }
    } catch { /* 壊れたエントリは無視 */ }
    localStorage.removeItem(key)
  }

  if (sessions.length > 0) {
    localStorage.setItem(CONSOLIDATED_KEY, JSON.stringify(sessions))
  } else {
    localStorage.removeItem(CONSOLIDATED_KEY)
  }
}

/** メインウィンドウ: 起動時に前回セッションを読み取る */
export function loadWindowSessions(): WindowSession[] {
  const sessions: WindowSession[] = []

  // 1. 正常終了時に統合されたセッションを読む
  try {
    const raw = localStorage.getItem(CONSOLIDATED_KEY)
    if (raw) {
      sessions.push(...(JSON.parse(raw) as WindowSession[]))
    }
  } catch { /* ignore */ }

  // 2. Cmd+Q などの強制終了で統合されずに残ってしまった追加ウィンドウのセッションを拾い上げる
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(PER_WINDOW_PREFIX)) {
      const label = key.slice(PER_WINDOW_PREFIX.length)
      try {
        const raw = localStorage.getItem(key)
        if (raw) {
          const { projectRoot } = JSON.parse(raw) as { projectRoot: string | null }
          // 重複チェック
          if (!sessions.some(s => s.label === label)) {
            sessions.push({ label, projectRoot })
          }
        }
      } catch { /* ignore */ }
    }
  }

  return sessions
}

/** メインウィンドウ: 起動時に統合セッションおよび残留 per-window キーをクリアする */
export function clearWindowSessions(): void {
  localStorage.removeItem(CONSOLIDATED_KEY)
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(PER_WINDOW_PREFIX)) keys.push(key)
  }
  keys.forEach((k) => localStorage.removeItem(k))
}
