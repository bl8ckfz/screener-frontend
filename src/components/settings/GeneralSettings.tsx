import { useStore } from '@/hooks/useStore'

/**
 * GeneralSettings Component
 * 
 * General application settings and preferences.
 * Placeholder for future features like theme, language, etc.
 * 
 * Phase 8.1.4: Create Settings Modal
 */
export function GeneralSettings() {
  const config = useStore((state) => state.config)
  const updateConfig = useStore((state) => state.updateConfig)

  const handleToggleAutoHide = () => {
    updateConfig({
      display: {
        ...config.display,
        autoHideHeader: !config.display.autoHideHeader,
      },
    })
  }

  return (
    <div className="space-y-6">
      {/* UI Preferences */}
      <div className="bg-gray-800 rounded-lg p-6 space-y-4">
        <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          User Interface
        </h4>
        <div className="space-y-4">
          {/* Auto-hide Header Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label htmlFor="auto-hide-header" className="text-white font-medium cursor-pointer">
                Auto-hide Toolbar
              </label>
              <p className="text-sm text-gray-400 mt-1">
                Hide toolbar on scroll down, show on scroll up or hover
              </p>
            </div>
            <button
              id="auto-hide-header"
              onClick={handleToggleAutoHide}
              className={`
                relative inline-flex h-6 w-11 items-center rounded-full
                transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-gray-800
                ${config.display.autoHideHeader ? 'bg-accent' : 'bg-gray-600'}
              `}
              role="switch"
              aria-checked={config.display.autoHideHeader}
            >
              <span
                className={`
                  inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out
                  ${config.display.autoHideHeader ? 'translate-x-6' : 'translate-x-1'}
                `}
              />
            </button>
          </div>
        </div>
      </div>

      {/* About Section */}
      <div className="bg-gray-800 rounded-lg p-6 space-y-4">
        <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          About
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Application</span>
            <span className="text-white font-semibold">Crypto Screener</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Version</span>
            <span className="text-white font-mono">2.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Build Date</span>
            <span className="text-white font-mono">{new Date().toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Environment</span>
            <span className="text-white font-mono">
              {import.meta.env.MODE === 'production' ? 'Production' : 'Development'}
            </span>
          </div>
        </div>
      </div>

      {/* Planned Features */}
      <div className="bg-gray-800 rounded-lg p-6 space-y-4">
        <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Coming Soon
        </h4>
        <ul className="space-y-2 text-sm text-gray-400">
          <li className="flex items-start gap-2">
            <span className="text-accent">•</span>
            <span>Theme selection (Dark / Light modes)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent">•</span>
            <span>Language preferences (English / Turkish)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent">•</span>
            <span>Notification preferences and sound controls</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent">•</span>
            <span>Data management (Export / Import / Clear cache)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent">•</span>
            <span>Keyboard shortcuts customization</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
