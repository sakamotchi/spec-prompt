export type ToastKind = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

export type ToastListener = (item: ToastItem) => void

const listeners = new Set<ToastListener>()
let nextId = 1

function emit(kind: ToastKind, message: string) {
  const item: ToastItem = { id: nextId++, kind, message }
  listeners.forEach((l) => l(item))
}

export const toast = {
  success: (message: string) => emit('success', message),
  error: (message: string) => emit('error', message),
  info: (message: string) => emit('info', message),
}

export function subscribe(listener: ToastListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
