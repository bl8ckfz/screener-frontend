import { useEffect, useRef } from 'react'

interface VerticalSplitterProps {
  onDrag: (delta: number) => void
}

/**
 * VerticalSplitter
 *
 * A thin draggable handle that fires onDrag(delta) in pixels as the user drags.
 * Uses document-level mouse listeners so fast cursor movement never loses the drag.
 */
export function VerticalSplitter({ onDrag }: VerticalSplitterProps) {
  const isDragging = useRef(false)

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      onDrag(e.movementY)
    }

    const onMouseUp = () => {
      if (!isDragging.current) return
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [onDrag])

  const onMouseDown = () => {
    isDragging.current = true
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <div
      onMouseDown={onMouseDown}
      className="mx-1 md:mx-4 h-1.5 rounded-full bg-gray-700 hover:bg-purple-500 active:bg-purple-400 cursor-row-resize transition-colors duration-150 group flex items-center justify-center"
      title="Drag to resize charts"
    >
      {/* Visual grip dots */}
      <div className="flex gap-1 opacity-40 group-hover:opacity-80 transition-opacity">
        <span className="w-1 h-1 rounded-full bg-gray-300" />
        <span className="w-1 h-1 rounded-full bg-gray-300" />
        <span className="w-1 h-1 rounded-full bg-gray-300" />
      </div>
    </div>
  )
}
