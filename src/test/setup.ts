import '@testing-library/jest-dom'
import { vi } from 'vitest'

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    label: 'main',
    setTitle: vi.fn(async () => {}),
    onFocusChanged: vi.fn(async () => () => {}),
    onCloseRequested: vi.fn(async () => () => {}),
    isFocused: vi.fn(async () => true),
  }),
}))
