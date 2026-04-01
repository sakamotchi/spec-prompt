import { useEffect, useRef, useState } from 'react'

interface InlineInputProps {
  defaultValue?: string
  placeholder?: string
  depth: number
  onCommit: (name: string) => Promise<string | null> // null = 成功、string = エラーメッセージ
  onCancel: () => void
}

export function InlineInput({ defaultValue = '', placeholder, depth, onCommit, onCancel }: InlineInputProps) {
  const [value, setValue] = useState(defaultValue)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const cancelledRef = useRef(false)
  const indent = depth * 16

  useEffect(() => {
    // Radix ContextMenu のフォーカス復元より後に実行するため setTimeout を使う
    const timer = setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const trimmed = value.trim()
      if (!trimmed) return
      cancelledRef.current = true
      const errorMsg = await onCommit(trimmed)
      if (errorMsg) {
        // エラー: 入力欄を維持してエラーを表示
        cancelledRef.current = false
        setError(errorMsg)
        inputRef.current?.focus()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelledRef.current = true
      onCancel()
    }
  }

  const handleBlur = () => {
    if (cancelledRef.current) return
    onCancel()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
    if (error) setError(null)
  }

  return (
    <div>
      <div
        className="flex items-center h-7 pr-2"
        style={{ paddingLeft: `${indent + 8 + 16 + 14 + 6}px` }}
      >
        <input
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="flex-1 text-xs rounded px-1 h-5 outline-none"
          style={{
            background: 'var(--color-bg-base)',
            border: `1px solid ${error ? '#ef4444' : 'var(--color-accent)'}`,
            color: 'var(--color-text-primary)',
          }}
        />
      </div>
      {error && (
        <div
          className="text-xs px-1 pb-0.5 truncate"
          style={{ paddingLeft: `${indent + 8 + 16 + 14 + 6}px`, color: '#ef4444' }}
        >
          {error}
        </div>
      )}
    </div>
  )
}
