interface ViewToggleProps {
  activeView: 'coins' | 'alerts'
  onViewChange: (view: 'coins' | 'alerts') => void
  alertCount?: number
}

/**
 * Tab switcher for main view (Coin List vs Alert History)
 */
export function ViewToggle({ activeView, onViewChange, alertCount = 0 }: ViewToggleProps) {
  return (
    <div className="bg-gray-900 rounded-lg p-1 flex gap-1">
      <button
        onClick={() => onViewChange('coins')}
        className={`
          flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors
          ${activeView === 'coins'
            ? 'bg-accent text-white'
            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
          }
        `}
      >
        📊 Coin List
      </button>
      <button
        onClick={() => onViewChange('alerts')}
        className={`
          flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors relative
          ${activeView === 'alerts'
            ? 'bg-accent text-white'
            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
          }
        `}
      >
        🔔 Alert History
        {alertCount > 0 && (
          <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
            {alertCount}
          </span>
        )}
      </button>
    </div>
  )
}
