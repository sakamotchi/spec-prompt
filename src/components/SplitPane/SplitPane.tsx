import { useState, useRef, useCallback, useEffect } from 'react'

interface SplitPaneProps {
  direction: 'horizontal' | 'vertical'
  defaultSize?: number
  minSize?: number
  maxSize?: number
  children: [React.ReactNode, React.ReactNode]
}

export function SplitPane({
  direction = 'horizontal',
  defaultSize = 240,
  minSize = 160,
  maxSize = 480,
  children,
}: SplitPaneProps) {
  const [size, setSize] = useState(defaultSize)
  const isDragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const newSize =
        direction === 'horizontal'
          ? e.clientX - rect.left
          : e.clientY - rect.top
      setSize(Math.min(maxSize, Math.max(minSize, newSize)))
    },
    [direction, minSize, maxSize]
  )

  const onMouseUp = useCallback(() => {
    isDragging.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  useEffect(() => {
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [onMouseMove, onMouseUp])

  const onSeparatorMouseDown = useCallback(() => {
    isDragging.current = true
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
  }, [direction])

  const isHorizontal = direction === 'horizontal'

  return (
    <div
      ref={containerRef}
      className={`flex h-full w-full ${isHorizontal ? 'flex-row' : 'flex-col'}`}
    >
      {/* 第1ペイン */}
      <div
        style={isHorizontal ? { width: size, flexShrink: 0 } : { height: size, flexShrink: 0 }}
        className="overflow-hidden"
      >
        {children[0]}
      </div>

      {/* セパレーター */}
      <div
        onMouseDown={onSeparatorMouseDown}
        className={[
          'group flex-shrink-0 bg-[var(--color-border)] transition-colors duration-100',
          'hover:bg-[var(--color-accent)]',
          isHorizontal
            ? 'w-[3px] cursor-col-resize'
            : 'h-[3px] cursor-row-resize',
        ].join(' ')}
      />

      {/* 第2ペイン */}
      <div className="flex-1 overflow-hidden min-w-0 min-h-0">
        {children[1]}
      </div>
    </div>
  )
}
