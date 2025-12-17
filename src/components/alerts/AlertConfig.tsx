import { useState } from 'react'
import {
  AlertRule,
  AlertType,
  FuturesAlertType,
  CombinedAlertType,
  FUTURES_ALERT_PRESETS,
  FUTURES_ALERT_LABELS,
} from '@/types/alert'
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
  const [showCustomBuilder, setShowCustomBuilder] = useState(false)

  const alertSettings = useStore((state) => state.alertSettings)
  const updateAlertSettings = useStore((state) => state.updateAlertSettings)

  const handleToggleBrowserNotifications = async () => {
    const currentPermission = getNotificationPermission()
    
    // If permission not granted yet, request it
    if (currentPermission === 'default') {
      const permission = await requestNotificationPermission()
      if (permission === 'granted') {
        updateAlertSettings({ browserNotificationEnabled: true })
        showTestNotification()
      }
    } else if (currentPermission === 'granted') {
      // Toggle the setting
      updateAlertSettings({
        browserNotificationEnabled: !alertSettings.browserNotificationEnabled,
      })
    }
    // If denied, do nothing (user needs to enable in browser settings)
  }

  const handlePresetToggle = (presetType: FuturesAlertType, enabled: boolean) => {
    const existingRule = rules.find(r => r.conditions[0]?.type === presetType)
    
    if (existingRule) {
      // Toggle existing rule
      onRuleToggle(existingRule.id, enabled)
    } else if (enabled) {
      // Create new rule from preset
      const preset = FUTURES_ALERT_PRESETS.find(p => p.type === presetType)
      if (!preset) return

      const newRule: AlertRule = {
        id: `rule_${Date.now()}`,
        name: preset.name,
        enabled: true,
        conditions: [
          {
            type: preset.type,
            threshold: 0,
            comparison: 'greater_than',
            timeframe: undefined,
          },
        ],
        symbols: [],
        severity: preset.severity,
        notificationEnabled: true,
        soundEnabled: true,
        createdAt: Date.now(),
      }

      onRuleCreate(newRule)
    }
  }

  const isPresetEnabled = (presetType: FuturesAlertType): boolean => {
    const rule = rules.find(r => r.conditions[0]?.type === presetType)
    return rule?.enabled ?? false
  }

  const getAlertTypeBadgeColor = (type: CombinedAlertType): string => {
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

  const getAlertTypeLabel = (type: CombinedAlertType): string => {
    // Check futures alerts first
    if (type.startsWith('futures_')) {
      return FUTURES_ALERT_LABELS[type as FuturesAlertType] || type
    }
    // Spot alerts
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
    return labels[type as AlertType] || type
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
          onClick={() => setShowCustomBuilder(!showCustomBuilder)}
          variant={showCustomBuilder ? 'secondary' : 'primary'}
          size="sm"
        >
          {showCustomBuilder ? 'Cancel' : '+ Custom Rule'}
        </Button>
      </div>

      {/* Custom Alert Builder */}
      {showCustomBuilder && (
        <CustomAlertBuilder
          onSave={(rule) => {
            onRuleCreate(rule)
            setShowCustomBuilder(false)
          }}
          onCancel={() => {
            setShowCustomBuilder(false)
          }}
        />
      )}

      {/* Futures Alert Presets - Always Visible */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
          </svg>
          <h4 className="text-sm font-semibold text-white">Futures Alerts</h4>
          <Badge className="bg-green-500/20 text-green-400 text-xs">Recommended</Badge>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Multi-timeframe analysis with progressive validation. Toggle to enable/disable.
        </p>
        
        <div className="space-y-2">
          {FUTURES_ALERT_PRESETS.map((preset) => (
            <div
              key={preset.type}
              className={`rounded-lg border p-3 transition-colors ${
                isPresetEnabled(preset.type)
                  ? 'border-green-500/50 bg-green-900/10'
                  : 'border-gray-700 bg-gray-800/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{preset.name}</span>
                    <Badge className={`text-xs ${
                      preset.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                      preset.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                      preset.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {preset.severity}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">{preset.description}</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center ml-3">
                  <input
                    type="checkbox"
                    checked={isPresetEnabled(preset.type)}
                    onChange={(e) => handlePresetToggle(preset.type, e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="peer h-5 w-9 rounded-full bg-gray-700 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-600 after:bg-white after:transition-all after:content-[''] peer-checked:bg-green-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-800"></div>
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Rules List */}
      {rules.some(r => {
        const type = r.conditions[0]?.type
        return type && !type.startsWith('futures_') && !type.startsWith('ichimoku_')
      }) && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-white mb-2">Custom Rules</h4>
          {rules
            .filter(r => {
              const type = r.conditions[0]?.type
              return type && !type.startsWith('futures_') && !type.startsWith('ichimoku_')
            })
            .map((rule) => (
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
                      <h5 className="font-medium text-white">{rule.name}</h5>
                      {rule.conditions.map((condition, idx) => (
                        <Badge
                          key={idx}
                          className={getAlertTypeBadgeColor(condition.type)}
                        >
                          {getAlertTypeLabel(condition.type)}
                        </Badge>
                      ))}
                    </div>
                    
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
            ))}
        </div>
      )}

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

      {/* Toast Notification Controls */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-white">Toast Notifications</h4>
            <p className="text-xs text-gray-400 mt-0.5">
              Show in-app popup alerts (may cover UI on small screens)
            </p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={alertSettings.notificationEnabled}
              onChange={(e) => updateAlertSettings({ notificationEnabled: e.target.checked })}
              className="peer sr-only"
            />
            <div className="peer h-5 w-9 rounded-full bg-gray-700 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-600 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800"></div>
          </label>
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
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={alertSettings.browserNotificationEnabled}
                onChange={handleToggleBrowserNotifications}
                className="peer sr-only"
              />
              <div className="peer h-5 w-9 rounded-full bg-gray-700 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-600 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800"></div>
            </label>
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
    </div>
  )
}
