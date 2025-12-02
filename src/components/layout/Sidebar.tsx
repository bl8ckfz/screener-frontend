import { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface SidebarProps {
  children: ReactNode
  position: 'left' | 'right'
  title: string
  isCollapsed: boolean
  onToggle: () => void
}

export function Sidebar({
  children,
  position,
  title,
  isCollapsed,
  onToggle,
}: SidebarProps) {
  const isLeft = position === 'left'
  // Icon now represents the intended action rather than static side
  // When expanded: show chevron pointing outward (to indicate collapse)
  // When collapsed: show chevron pointing inward (to indicate expand)
  const Icon = (() => {
    if (isLeft) {
      return isCollapsed ? ChevronRight : ChevronLeft
    }
    // Right sidebar: inward is ChevronLeft, outward is ChevronRight
    return isCollapsed ? ChevronLeft : ChevronRight
  })()

  return (
    <aside
      className={`
        relative bg-gray-900 rounded-lg border border-gray-800 
        transition-all duration-300 ease-in-out
        ${isCollapsed ? 'w-12' : 'w-full'}
        ${isCollapsed ? 'overflow-hidden' : ''}
      `}
    >
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className={`
          absolute top-4 ${isLeft ? 'right-2' : 'left-2'} z-30
          p-2 bg-gray-800 hover:bg-gray-700 rounded-lg
          transition-colors duration-200
        `}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <Icon className="w-4 h-4 text-gray-400" />
      </button>

      {/* Sidebar Content */}
      <div
        className={`
          transition-opacity duration-300
          ${isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}
        `}
      >
        {/* Header */}
        <div className={`p-4 border-b border-gray-800 ${isLeft ? 'pr-10' : 'pl-10'} relative z-10`}>
          <h2 className="text-lg font-semibold text-gray-100">{title}</h2>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[calc(100vh-12rem)] overflow-y-auto">
          {children}
        </div>
      </div>

      {/* Collapsed State Label */}
      {isCollapsed && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="writing-vertical text-xs text-gray-500 uppercase tracking-wider">
            {title}
          </span>
        </div>
      )}
    </aside>
  )
}
