import { useStore } from '@/hooks/useStore'
import {
  ALERT_COLOR_CATEGORIES,
  getAlertColorLabel,
  DEFAULT_ALERT_COLORS,
} from '@/types/alertColors'
import type { AlertColorKey } from '@/types/alertColors'
import { ColorPicker } from './ColorPicker'

const CATEGORY_LABELS: Record<string, { title: string; icon: string }> = {
  bullish: { title: 'Bullish', icon: '🟢' },
  bearish: { title: 'Bearish', icon: '🔴' },
  hunter: { title: 'Hunters', icon: '🟣' },
  v2: { title: 'V2 Optimized', icon: '⚡' },
  whale: { title: 'Whale', icon: '🐋' },
}

/**
 * Settings panel for configuring alert type colors.
 * Groups alert types by category with per-type color pickers.
 */
export function AlertColorSettings() {
  const alertColors = useStore((state) => state.alertColors)
  const updateAlertColor = useStore((state) => state.updateAlertColor)
  const resetAlertColors = useStore((state) => state.resetAlertColors)

  const hasCustomColors = Object.keys(alertColors).some(
    (key) => alertColors[key as AlertColorKey] !== DEFAULT_ALERT_COLORS[key as AlertColorKey],
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Alert Colors</h3>
          <p className="text-sm text-gray-400 mt-1">
            Customize the color of each alert type across badges, dots, and charts.
          </p>
        </div>
        {hasCustomColors && (
          <button
            onClick={resetAlertColors}
            className="px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            Reset to defaults
          </button>
        )}
      </div>

      {/* Category groups */}
      {Object.entries(ALERT_COLOR_CATEGORIES).map(([category, alertTypes]) => {
        const meta = CATEGORY_LABELS[category] ?? { title: category, icon: '🔵' }

        return (
          <div key={category} className="rounded-lg border border-gray-700 bg-gray-800/30 p-4">
            <h4 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
              <span>{meta.icon}</span>
              {meta.title}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {alertTypes.map((alertType) => (
                <ColorPicker
                  key={alertType}
                  label={getAlertColorLabel(alertType)}
                  color={alertColors[alertType]}
                  onChange={(color) => updateAlertColor(alertType, color)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
