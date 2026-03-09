import { useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { authService } from '@/services/authService'

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

  // Change password state
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  const handleToggleAutoHide = () => {
    updateConfig({
      display: {
        ...config.display,
        autoHideHeader: !config.display.autoHideHeader,
      },
    })
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError('')
    setPwSuccess(false)

    if (newPw.length < 8) {
      setPwError('New password must be at least 8 characters.')
      return
    }
    if (newPw !== confirmPw) {
      setPwError('New passwords do not match.')
      return
    }

    setPwLoading(true)
    try {
      await authService.changePassword(oldPw, newPw)
      setPwSuccess(true)
      setOldPw('')
      setNewPw('')
      setConfirmPw('')
    } catch (err: any) {
      setPwError(err.message || 'Failed to change password.')
    } finally {
      setPwLoading(false)
    }
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

      {/* Security — Change Password */}
      <div className="bg-gray-800 rounded-lg p-6 space-y-4">
        <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Security
        </h4>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Current password</label>
            <input
              type="password"
              value={oldPw}
              onChange={(e) => setOldPw(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white
                         placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500
                         focus:border-transparent transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">New password</label>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="Minimum 8 characters"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white
                         placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500
                         focus:border-transparent transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Confirm new password</label>
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="Repeat new password"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white
                         placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500
                         focus:border-transparent transition-colors"
            />
          </div>

          {pwError && (
            <p className="text-red-400 text-xs">{pwError}</p>
          )}
          {pwSuccess && (
            <p className="text-green-400 text-xs">Password changed successfully.</p>
          )}

          <button
            type="submit"
            disabled={pwLoading || !oldPw || !newPw || !confirmPw}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800
                       disabled:opacity-50 text-white text-sm font-medium rounded-lg
                       transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {pwLoading ? 'Saving…' : 'Change password'}
          </button>
        </form>
      </div>

      {/* About Section */}
      <div className="bg-gray-800 rounded-lg p-6 space-y-4">
        <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          About
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Application</span>
            <span className="text-white font-semibold">Coin Sniffer</span>
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
