import { useState, useEffect } from 'react'
import { AlertRule, AlertType, LEGACY_ALERT_PRESETS } from '@/types/alert'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { CustomAlertBuilder } from './CustomAlertBuilder'
import { WebhookManager } from './WebhookManager'
import { useStore } from '@/hooks/useStore'
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  showTestNotification,
  type NotificationPermissionStatus,
} from '@/services/notification'
import { audioNotificationService } from '@/services/audioNotification'

interface AlertConfigProps {
  rules: AlertRule[]
  onRuleToggle: (ruleId: string, enabled: boolean) => void
  onRuleCreate: (rule: AlertRule) => void
  onRuleDelete: (ruleId: string) => void
}

/**
 * AlertConfig - UI for managing alert rules
 * 
 * Features:
 * - Display active alert rules with enable/disable toggles
 * - Preset selector for 8 legacy alert types
 * - Create custom rules with condition editor
 * - Edit existing rules (name, conditions, thresholds)
 */
export function AlertConfig({
  rules,
  onRuleToggle,
  onRuleCreate,
  onRuleDelete,
}: AlertConfigProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [showCustomBuilder, setShowCustomBuilder] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermissionStatus>(
    getNotificationPermission()
  )
  const [isRequestingPermission, setIsRequestingPermission] = useState(false)

  const alertSettings = useStore((state) => state.alertSettings)
  const updateAlertSettings = useStore((state) => state.updateAlertSettings)

  // Update permission status on mount and when window gains focus
  useEffect(() => {
    const updatePermission = () => {
      setNotificationPermission(getNotificationPermission())
    }

    window.addEventListener('focus', updatePermission)
    return () => window.removeEventListener('focus', updatePermission)
  }, [])

  const handleRequestPermission = async () => {
    setIsRequestingPermission(true)
    const permission = await requestNotificationPermission()
    setNotificationPermission(permission)
    setIsRequestingPermission(false)

    if (permission === 'granted') {
      // Enable browser notifications in settings
      updateAlertSettings({ browserNotificationEnabled: true })
      // Show test notification
      showTestNotification()
    }
  }

  const handleToggleBrowserNotifications = () => {
    if (notificationPermission === 'granted') {
      updateAlertSettings({
        browserNotificationEnabled: !alertSettings.browserNotificationEnabled,
      })
    } else if (notificationPermission === 'default') {
      handleRequestPermission()
    }
  }

  const handlePresetSelect = (presetName: string) => {
    const preset = LEGACY_ALERT_PRESETS.find(p => p.name === presetName)
    if (!preset) return

    const newRule: AlertRule = {
      id: `rule_${Date.now()}`,
      name: preset.name,
      enabled: true,
      conditions: [
        {
          type: preset.type,
          threshold: 0, // Legacy alerts use preset logic
          comparison: 'greater_than',
          timeframe: undefined,
        },
      ],
      symbols: [], // Empty = all symbols
      severity: preset.severity,
      notificationEnabled: true,
      soundEnabled: true,
      createdAt: Date.now(),
    }

    onRuleCreate(newRule)
    setIsCreating(false)
  }

  const getAlertTypeBadgeColor = (type: AlertType): string => {
    if (type.includes('bull') || type === 'price_pump' || type === 'volume_spike') {
      return 'bg-green-500/20 text-green-400'
    }
    if (type.includes('bear') || type === 'price_dump' || type === 'volume_drop') {
      return 'bg-red-500/20 text-red-400'
    }
    if (type.includes('hunter')) {
      return 'bg-purple-500/20 text-purple-400'
    }
    return 'bg-blue-500/20 text-blue-400'
  }

  const getAlertTypeLabel = (type: AlertType): string => {
    const labels: Record<AlertType, string> = {
      price_pump: 'Price Pump',
      price_dump: 'Price Dump',
      volume_spike: 'Volume Spike',
      volume_drop: 'Volume Drop',
      vcp_signal: 'VCP Signal',
      fibonacci_break: 'Fibonacci Break',
      trend_reversal: 'Trend Reversal',
      custom: 'Custom Alert',
      pioneer_bull: '🎯 Pioneer Bull',
      pioneer_bear: '🎯 Pioneer Bear',
      '5m_big_bull': '⚡ 5m Big Bull',
      '5m_big_bear': '⚡ 5m Big Bear',
      '15m_big_bull': '🔥 15m Big Bull',
      '15m_big_bear': '🔥 15m Big Bear',
      bottom_hunter: '🎣 Bottom Hunter',
      top_hunter: '🎣 Top Hunter',
    }
    return labels[type] || type
  }

  const getPermissionStatusDisplay = () => {
    switch (notificationPermission) {
      case 'granted':
        return { label: 'Enabled', color: 'text-green-400', icon: '✓' }
      case 'denied':
        return { label: 'Blocked', color: 'text-red-400', icon: '✗' }
      case 'default':
        return { label: 'Not Set', color: 'text-yellow-400', icon: '?' }
      case 'unsupported':
        return { label: 'Unsupported', color: 'text-gray-400', icon: '✗' }
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Alert Rules</h3>
          <p className="text-sm text-gray-400">
            {rules.filter(r => r.enabled).length} of {rules.length} rules active
          </p>
        </div>
        <Button
          onClick={() => setIsCreating(!isCreating)}
          variant="secondary"
          size="sm"
        >
          {isCreating ? 'Cancel' : '+ Add Rule'}
        </Button>
      </div>

      {/* Sound Notification Controls */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-white">Sound Notifications</h4>
            <p className="text-xs text-gray-400 mt-0.5">
              Play audio alerts for different severity levels
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={alertSettings.soundEnabled}
                onChange={(e) => {
                  updateAlertSettings({ soundEnabled: e.target.checked })
                  // Enable audio context on user interaction
                  if (e.target.checked) {
                    audioNotificationService.setEnabled(true)
                  }
                }}
                className="peer sr-only"
              />
              <div className="peer h-5 w-9 rounded-full bg-gray-700 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-600 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800"></div>
            </label>
            <Button
              onClick={() => audioNotificationService.testSound()}
              variant="secondary"
              size="sm"
              disabled={!alertSettings.soundEnabled}
            >
              Test Sound
            </Button>
          </div>
        </div>
      </div>

      {/* Browser Notification Controls */}
      {isNotificationSupported() && (
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-white">Browser Notifications</h4>
              <p className="text-xs text-gray-400 mt-0.5">
                Desktop notifications even when tab is not visible
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${getPermissionStatusDisplay().color}`}>
                {getPermissionStatusDisplay().icon} {getPermissionStatusDisplay().label}
              </span>
              {notificationPermission === 'granted' ? (
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={alertSettings.browserNotificationEnabled}
                    onChange={handleToggleBrowserNotifications}
                    className="peer sr-only"
                  />
                  <div className="peer h-5 w-9 rounded-full bg-gray-700 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-600 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800"></div>
                </label>
              ) : notificationPermission === 'default' ? (
                <Button
                  onClick={handleRequestPermission}
                  variant="primary"
                  size="sm"
                  disabled={isRequestingPermission}
                >
                  {isRequestingPermission ? 'Requesting...' : 'Enable'}
                </Button>
              ) : notificationPermission === 'denied' ? (
                <span className="text-xs text-gray-500">
                  Enable in browser settings
                </span>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Webhook Manager */}
      <WebhookManager />

      {/* Legacy Discord Webhook (Deprecated - for backwards compatibility) */}
      {alertSettings.discordWebhookUrl && (
        <div className="rounded-lg border border-yellow-600/50 bg-yellow-900/10 p-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <h4 className="text-sm font-medium text-yellow-500">Legacy Webhook Detected</h4>
            </div>
            <p className="text-xs text-gray-400">
              You have a legacy Discord webhook configured. Please migrate to the new Webhook Manager above for better features (rate limiting, retry logic, multiple webhooks).
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Input
                type="url"
                value={alertSettings.discordWebhookUrl}
                readOnly
                className="flex-1 text-xs opacity-70"
              />
              <Button
                onClick={() => updateAlertSettings({ discordWebhookUrl: '' })}
                variant="secondary"
                size="sm"
              >
                Clear
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Builder */}
      {showCustomBuilder && (
        <CustomAlertBuilder
          onSave={(rule) => {
            onRuleCreate(rule)
            setShowCustomBuilder(false)
            setIsCreating(false)
          }}
          onCancel={() => {
            setShowCustomBuilder(false)
            setIsCreating(false)
          }}
        />
      )}

      {/* Preset Selector */}
      {isCreating && !showCustomBuilder && (
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <h4 className="mb-3 text-sm font-medium text-white">Choose Alert Type</h4>
          <div className="grid grid-cols-1 gap-2">
            {/* Custom Rule Button */}
            <button
              onClick={() => setShowCustomBuilder(true)}
              className="flex items-center justify-between rounded-lg border-2 border-blue-500/50 bg-blue-500/10 p-3 text-left transition-colors hover:border-blue-500 hover:bg-blue-500/20"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-blue-400">
                    ⚙️ Custom Rule
                  </span>
                  <Badge className="bg-blue-500/20 text-blue-400">
                    Advanced
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-blue-300">
                  Build your own alert with custom conditions and thresholds
                </p>
              </div>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 border-t border-gray-700"></div>
              <span className="text-xs text-gray-500">OR CHOOSE PRESET</span>
              <div className="flex-1 border-t border-gray-700"></div>
            </div>

            {/* Legacy Presets */}
            {LEGACY_ALERT_PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => handlePresetSelect(preset.name)}
                className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800 p-3 text-left transition-colors hover:border-blue-500 hover:bg-gray-700"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">
                      {getAlertTypeLabel(preset.type)}
                    </span>
                    <Badge className={getAlertTypeBadgeColor(preset.type)}>
                      Legacy
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">{preset.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active Rules List */}
      <div className="space-y-2">
        {rules.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-700 bg-gray-800/30 p-8 text-center">
            <p className="text-sm text-gray-400">
              No alert rules configured yet.
              <br />
              Click "Add Rule" to create your first alert.
            </p>
          </div>
        ) : (
          rules.map((rule) => (
            <div
              key={rule.id}
              className={`rounded-lg border p-4 transition-colors ${
                rule.enabled
                  ? 'border-blue-500/50 bg-gray-800'
                  : 'border-gray-700 bg-gray-800/50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-white">{rule.name}</h4>
                    {rule.conditions.map((condition, idx) => (
                      <Badge
                        key={idx}
                        className={getAlertTypeBadgeColor(condition.type)}
                      >
                        {getAlertTypeLabel(condition.type)}
                      </Badge>
                    ))}
                  </div>
                  
                  {/* Rule Details */}
                  <div className="mt-2 space-y-1 text-xs text-gray-400">
                    <div>
                      Symbols: {rule.symbols.length === 0 ? 'All' : rule.symbols.join(', ')}
                    </div>
                    {rule.conditions.length > 0 && (
                      <div>
                        Conditions: {rule.conditions.length} condition(s)
                        {rule.conditions[0].threshold !== undefined && 
                          ` (threshold: ${rule.conditions[0].threshold})`}
                        {rule.conditions[0].timeframe && 
                          ` [${rule.conditions[0].timeframe}]`}
                      </div>
                    )}
                    <div className="text-gray-500">
                      Created: {new Date(rule.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(e) => onRuleToggle(rule.id, e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="peer h-5 w-9 rounded-full bg-gray-700 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-600 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800"></div>
                  </label>
                  <Button
                    onClick={() => onRuleDelete(rule.id)}
                    variant="secondary"
                    size="sm"
                    className="text-red-400 hover:text-red-300"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Legacy alerts disclaimer removed per UI cleanup request */}
    </div>
  )
}
