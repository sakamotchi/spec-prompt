import { convertFileSrc } from '@tauri-apps/api/core'

export function ImageViewer({ filePath }: { filePath: string }) {
  return (
    <div
      className="flex h-full w-full items-center justify-center overflow-auto p-6"
      style={{ background: 'var(--color-bg-base)' }}
    >
      <img
        src={convertFileSrc(filePath)}
        alt={filePath}
        className="max-h-full max-w-full object-contain"
      />
    </div>
  )
}
