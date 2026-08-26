import { useState, useMemo } from 'react'
import {
  AlertRule,
  AlertType,
  FuturesAlertType,
  CombinedAlertType,
  FUTURES_ALERT_PRESETS,
  FUTURES_ALERT_LABELS,
  type FuturesAlertPreset,
} from '@/types/alert'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { CustomAlertBuilder } from './CustomAlertBuilder'
import { useStore } from '@/hooks/useStore'
import { useAlertRules } from '@/hooks/useAlertRules'
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

// ── Preset grouping ───────────────────────────────────────────────
const ORIGINAL_TYPES = new Set<FuturesAlertType>([
  'futures_big_bull_60', 'futures_big_bear_60',
  'futures_pioneer_bull', 'futures_pioneer_bear',
  'futures_5_big_bull', 'futures_5_big_bear',
  'futures_15_big_bull', 'futures_15_big_bear',
  'futures_bottom_hunter', 'futures_top_hunter',
])

const V2_TYPES = new Set<FuturesAlertType>([
  'futures_bottom_hunter_v2', 'futures_top_hunter_v2',
  'futures_big_bull_60_v2', 'futures_big_bear_60_v2',
])

const WHALE_TYPES = new Set<FuturesAlertType>([
  'futures_whale_accumulation',
  'futures_whale_distribution',
])

const V4_TYPES = new Set<FuturesAlertType>([
  'futures_surge_42',
  'futures_knife_catcher',
  'futures_capitulation_catcher',
])

// Dojo confluence zones. Ordered rarest first: on a weekly chart the only
// higher-timeframe slot is monthly, so a confluence score of 2 demands a
// monthly fibonacci level AND a live fair value gap on the same price.
//
// The zone-entered pair goes last, and is a different kind of alert from the
// six above it: those say a zone has formed and is worth an order, this one
// says price has arrived at one. Subscribing to it without any of the armed
// rules is perfectly reasonable — the arrival is the moment you act.
const DOJO_TYPES = new Set<FuturesAlertType>([
  'futures_dojo_otz_long_1w', 'futures_dojo_otz_short_1w',
  'futures_dojo_otz_long_5d', 'futures_dojo_otz_short_5d',
  'futures_dojo_otz_long_1d', 'futures_dojo_otz_short_1d',
  'futures_dojo_near_long', 'futures_dojo_near_short',
])

interface PresetGroup {
  label: string
  presets: FuturesAlertPreset[]
}

// ── Preset Row ────────────────────────────────────────
function PresetRow({
  preset,
  enabled,
  onToggle,
  isToggling,
}: {
  preset: FuturesAlertPreset
  enabled: boolean
  onToggle: (type: FuturesAlertType, enabled: boolean) => void
  isToggling: boolean
}) {
  return (
    <label
      className={`flex cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2 transition-colors ${
        enabled
          ? 'border-green-500/50 bg-green-900/10'
          : 'border-gray-700 bg-gray-800/30 hover:bg-gray-800/60'
      }`}
    >
      <span className="truncate text-sm font-medium text-white">{preset.name}</span>
      <span className="relative inline-flex shrink-0 items-center">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(preset.type, e.target.checked)}
          disabled={isToggling}
          className="peer sr-only"
        />
        <span className="peer block h-5 w-9 rounded-full bg-gray-700 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-600 after:bg-white after:transition-all after:content-[''] peer-checked:bg-green-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-800"></span>
      </span>
    </label>
  )
}

/**
 * AlertConfig - UI for managing alert rules
 * 
 * Features:
 * - Display active alert rules with enable/disable toggles
 * - Grouped presets (name + toggle only): Original / V2 / V4 / Whale / Dojo
 * - Backend sync for per-user rule toggles (when authenticated)
 * - Local Zustand fallback when anonymous
 * - Create custom rules with condition editor
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

  // Backend rule toggles (only active when authenticated)
  const {
    isAuthenticated,
    isRuleEnabled: isBackendRuleEnabled,
    toggleRule: toggleBackendRule,
    isLoading: isLoadingRules,
    isToggling,
  } = useAlertRules()

  // ── Grouped presets ──────────────────────────────────────────────
  // Ordered by lineage: base rules → their optimized successors → newer
  // generations → specialised detectors → higher-timeframe zones.
  const presetGroups: PresetGroup[] = useMemo(() => [
    {
      label: 'Original Rules',
      presets: FUTURES_ALERT_PRESETS.filter(p => ORIGINAL_TYPES.has(p.type)),
    },
    {
      label: 'Optimized V2 Rules',
      presets: FUTURES_ALERT_PRESETS.filter(p => V2_TYPES.has(p.type)),
    },
    {
      label: 'V4 Long-Bias Contrarian',
      presets: FUTURES_ALERT_PRESETS.filter(p => V4_TYPES.has(p.type)),
    },
    {
      label: 'Whale Detection',
      presets: FUTURES_ALERT_PRESETS.filter(p => WHALE_TYPES.has(p.type)),
    },
    {
      label: 'Dojo Confluence Zones',
      presets: FUTURES_ALERT_PRESETS.filter(p => DOJO_TYPES.has(p.type)),
    },
  ], [])

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

  // ── Preset toggle logic ──────────────────────────────────────────
  // When authenticated: toggle via backend API
  // When anonymous: toggle via local Zustand rules
  const handlePresetToggle = (presetType: FuturesAlertType, enabled: boolean) => {
    if (isAuthenticated) {
      toggleBackendRule(presetType, enabled)
      return
    }

    // Local-only fallback
    const existingRule = rules.find(r => r.conditions[0]?.type === presetType)
    
    if (existingRule) {
      onRuleToggle(existingRule.id, enabled)
    } else if (enabled) {
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
    if (isAuthenticated) {
      return isBackendRuleEnabled(presetType)
    }
    // Local fallback
    const rule = rules.find(r => r.conditions[0]?.type === presetType)
    return rule?.enabled ?? false
  }

  const getAlertTypeBadgeColor = (type: CombinedAlertType): string => {
    if (type.includes('whale')) {
      return 'bg-cyan-500/20 text-cyan-400'
    }
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
      pioneer_bull: '🎯 Scout Bull',
      pioneer_bear: '🎯 Scout Bear',
      '5m_big_bull': '⚡ Surge 5 Bull',
      '5m_big_bear': '⚡ Surge 5 Bear',
      '15m_big_bull': '🔥 Surge 15 Bull',
      '15m_big_bear': '🔥 Surge 15 Bear',
      bottom_hunter: '🎣 Bottom Raid',
      top_hunter: '🎣 Top Raid',
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
            {isAuthenticated ? (
              isLoadingRules ? 'Loading rules…' : 'Synced with your account'
            ) : (
              `${rules.filter(r => r.enabled).length} of ${rules.length} rules active`
            )}
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

      {/* Signal presets — name + toggle only, grouped */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {presetGroups.map((group) => {
          const activeCount = group.presets.filter(p => isPresetEnabled(p.type)).length
          return (
            <div key={group.label} className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <h4 className="text-sm font-semibold text-white">{group.label}</h4>
                <span className="text-xs tabular-nums text-gray-500">
                  {activeCount}/{group.presets.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {group.presets.map((preset) => (
                  <PresetRow
                    key={preset.type}
                    preset={preset}
                    enabled={isPresetEnabled(preset.type)}
                    onToggle={handlePresetToggle}
                    isToggling={isToggling}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Custom Rules List */}
      {rules.some(r => {
        const type = r.conditions[0]?.type
        return type && !type.startsWith('futures_')
      }) && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-white mb-2">Custom Rules</h4>
          {rules
            .filter(r => {
              const type = r.conditions[0]?.type
              return type && !type.startsWith('futures_')
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
