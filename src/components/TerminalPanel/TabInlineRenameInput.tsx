import { useEffect, useRef, useState } from 'react'

interface Props {
  defaultValue: string
  onCommit: (title: string) => void
  onCancel: () => void
}

export function TabInlineRenameInput({ defaultValue, onCommit, onCancel }: Props) {
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)
  const settledRef = useRef(false)

  useEffect(() => {
    // Radix ContextMenu のフォーカス復元より後にフォーカスするため setTimeout を挟む
    const t = setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 50)
    return () => clearTimeout(t)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (settledRef.current) return
      settledRef.current = true
      onCommit(value)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (settledRef.current) return
      settledRef.current = true
      onCancel()
    }
  }

  const handleBlur = () => {
    if (settledRef.current) return
    settledRef.current = true
    onCommit(value)
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      className="text-xs rounded px-1 h-5 outline-none min-w-[80px] max-w-[12rem]"
      style={{
        background: 'var(--color-bg-base)',
        border: '1px solid var(--color-accent)',
        color: 'var(--color-text-primary)',
      }}
    />
  )
}
