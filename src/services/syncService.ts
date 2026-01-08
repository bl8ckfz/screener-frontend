import { supabase } from '@/config'
import { debug } from '@/utils/debug'
import type { AlertRule, AlertSettings } from '@/types/alert'
import type { WebhookConfig } from '@/types/alert'

/**
 * Sync Service - Bidirectional sync between IndexedDB and Supabase
 * 
 * Strategy:
 * - On sign in: Pull from cloud (cloud is source of truth)
 * - On local changes: Push to cloud immediately (optimistic updates)
 * - On real-time changes: Update local state
 * - Conflict resolution: Last-write-wins based on updated_at timestamp
 */

// ============================================================================
// User Settings Sync
// ============================================================================

export async function syncUserSettingsToCloud(userId: string, settings: {
  currentPair: string
  currentList: number
  refreshInterval: number
  sortField?: string | null
  sortDirection: string
  theme: string
}) {
  const { data, error } = await supabase
    .from('user_settings')
    .upsert({
      user_id: userId,
      current_pair: settings.currentPair,
      current_list: settings.currentList,
      refresh_interval: settings.refreshInterval,
      sort_field: settings.sortField,
      sort_direction: settings.sortDirection,
      theme: settings.theme,
      updated_at: new Date().toISOString(),
    } as any)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function syncUserSettingsFromCloud(userId: string) {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    // If no settings exist, return null (will use local defaults)
    if (error.code === 'PGRST116') return null
    throw error
  }

  const settings: any = data
  return {
    currentPair: settings.current_pair,
    currentList: settings.current_list,
    refreshInterval: settings.refresh_interval,
    sortField: settings.sort_field,
    sortDirection: settings.sort_direction,
    theme: settings.theme,
    updatedAt: settings.updated_at,
  }
}

// ============================================================================
// Alert Settings Sync
// ============================================================================

export async function syncAlertSettingsToCloud(userId: string, settings: AlertSettings) {
  const { data, error } = await supabase
    .from('alert_settings')
    .upsert({
      user_id: userId,
      cooldown_seconds: settings.alertCooldown,
      max_alerts_per_symbol: settings.maxAlertsPerSymbol,
      sound_enabled: settings.soundEnabled,
      browser_notification_enabled: settings.browserNotificationEnabled,
      webhook_enabled: settings.webhookEnabled,
      discord_webhook_url: settings.discordWebhookUrl || null,
      telegram_bot_token: settings.telegramBotToken || null,
      telegram_chat_id: settings.telegramChatId || null,
      updated_at: new Date().toISOString(),
    } as any)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function syncAlertSettingsFromCloud(userId: string) {
  const { data, error } = await supabase
    .from('alert_settings')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  const settings: any = data
  return {
    alertCooldown: settings.cooldown_seconds,
    maxAlertsPerSymbol: settings.max_alerts_per_symbol,
    soundEnabled: settings.sound_enabled,
    browserNotificationEnabled: settings.browser_notification_enabled,
    webhookEnabled: settings.webhook_enabled,
    discordWebhookUrl: settings.discord_webhook_url || '',
    telegramBotToken: settings.telegram_bot_token || '',
    telegramChatId: settings.telegram_chat_id || '',
    updatedAt: settings.updated_at,
  }
}

// ============================================================================
// Watchlists Sync (deprecated - moved to simplified watchlistSymbols array)
// ============================================================================

// OLD IMPLEMENTATION COMMENTED OUT - uses Watchlist[] type
/*
export async function syncWatchlistsToCloud(userId: string, watchlists: Watchlist[]) {
  // Delete all existing watchlists for this user
  await supabase.from('watchlists').delete().eq('user_id', userId)

  // Insert all watchlists
  if (watchlists.length === 0) return []

  const { data, error } = await supabase
    .from('watchlists')
    .insert(
      watchlists.map((wl) => ({
        id: wl.id,
        user_id: userId,
        name: wl.name,
        color: wl.color,
        icon: wl.icon,
        symbols: wl.symbols,
        created_at: new Date(wl.createdAt).toISOString(),
        updated_at: new Date(wl.updatedAt).toISOString(),
      })) as any
    )
    .select()

  if (error) throw error
  return data
}
*/

export async function syncWatchlistsFromCloud(_userId: string): Promise<string[]> {
  // TODO: Implement for simplified watchlist
  debug.log('⚠️ syncWatchlistsFromCloud not implemented for simplified watchlist')
  return []
}

// ============================================================================
// Alert Rules Sync
// ============================================================================

export async function syncAlertRulesToCloud(userId: string, rules: AlertRule[]) {
  // Delete all existing rules for this user
  await supabase.from('alert_rules').delete().eq('user_id', userId)

  // Insert all rules
  if (rules.length === 0) return []

  const { data, error } = await supabase
    .from('alert_rules')
    .insert(
      rules.map((rule) => ({
        id: rule.id,
        user_id: userId,
        name: rule.name,
        enabled: rule.enabled,
        conditions: rule.conditions as any,
        symbols: rule.symbols,
        severity: rule.severity,
        notification_enabled: rule.notificationEnabled,
        sound_enabled: rule.soundEnabled,
        webhook_enabled: rule.webhookEnabled || false,
        created_at: new Date(rule.createdAt).toISOString(),
        updated_at: new Date().toISOString(),
      })) as any
    )
    .select()

  if (error) throw error
  return data
}

export async function syncAlertRulesFromCloud(userId: string): Promise<AlertRule[]> {
  const { data, error } = await supabase
    .from('alert_rules')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) throw error
  if (!data) return []

  return (data as any[]).map((rule) => ({
    id: rule.id,
    name: rule.name,
    enabled: rule.enabled,
    conditions: rule.conditions as any,
    symbols: rule.symbols,
    severity: rule.severity as any,
    notificationEnabled: rule.notification_enabled,
    soundEnabled: rule.sound_enabled,
    webhookEnabled: rule.webhook_enabled,
    createdAt: new Date(rule.created_at).getTime(),
  }))
}

export async function syncSingleAlertRuleToCloud(userId: string, rule: AlertRule) {
  const { data, error } = await supabase
    .from('alert_rules')
    .upsert({
      id: rule.id,
      user_id: userId,
      name: rule.name,
      enabled: rule.enabled,
      conditions: rule.conditions as any,
      symbols: rule.symbols,
      severity: rule.severity,
      notification_enabled: rule.notificationEnabled,
      sound_enabled: rule.soundEnabled,
      webhook_enabled: rule.webhookEnabled || false,
      created_at: new Date(rule.createdAt).toISOString(),
      updated_at: new Date().toISOString(),
    } as any)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteAlertRuleFromCloud(ruleId: string) {
  const { error } = await supabase
    .from('alert_rules')
    .delete()
    .eq('id', ruleId)

  if (error) throw error
}

// ============================================================================
// Webhooks Sync
// ============================================================================

export async function syncWebhooksToCloud(userId: string, webhooks: WebhookConfig[]) {
  // Delete all existing webhooks for this user
  await supabase.from('webhooks').delete().eq('user_id', userId)

  // Insert all webhooks
  if (webhooks.length === 0) return []

  const { data, error } = await supabase
    .from('webhooks')
    .insert(
      webhooks.map((wh) => ({
        id: wh.id,
        user_id: userId,
        name: wh.name,
        type: wh.type,
        url: wh.url,
        enabled: wh.enabled,
        created_at: new Date(wh.createdAt).toISOString(),
        updated_at: new Date().toISOString(),
      })) as any
    )
    .select()

  if (error) throw error
  return data
}

export async function syncWebhooksFromCloud(userId: string): Promise<WebhookConfig[]> {
  const { data, error } = await supabase
    .from('webhooks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) throw error
  if (!data) return []

  return (data as any[]).map((wh) => ({
    id: wh.id,
    name: wh.name,
    type: wh.type as 'discord' | 'telegram',
    url: wh.url,
    enabled: wh.enabled,
    createdAt: new Date(wh.created_at).getTime(),
  }))
}

export async function syncSingleWebhookToCloud(userId: string, webhook: WebhookConfig) {
  const { data, error } = await supabase
    .from('webhooks')
    .upsert({
      id: webhook.id,
      user_id: userId,
      name: webhook.name,
      type: webhook.type,
      url: webhook.url,
      enabled: webhook.enabled,
      created_at: new Date(webhook.createdAt).toISOString(),
      updated_at: new Date().toISOString(),
    } as any)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteWebhookFromCloud(webhookId: string) {
  const { error } = await supabase
    .from('webhooks')
    .delete()
    .eq('id', webhookId)

  if (error) throw error
}

// ============================================================================
// Full Sync Operations
// ============================================================================

export interface SyncState {
  userSettings?: any
  alertSettings?: Partial<AlertSettings>
  watchlistSymbols?: string[]
  alertRules: AlertRule[]
  webhooks: WebhookConfig[]
}

/**
 * Pull all user data from cloud
 * Called on sign in or manual refresh
 */
export async function pullAllFromCloud(userId: string): Promise<SyncState> {
  const [userSettings, alertSettings, watchlistSymbols, alertRules, webhooks] = await Promise.all([
    syncUserSettingsFromCloud(userId),
    syncAlertSettingsFromCloud(userId),
    syncWatchlistsFromCloud(userId), // Returns string[]
    syncAlertRulesFromCloud(userId),
    syncWebhooksFromCloud(userId),
  ])

  return {
    userSettings: userSettings || undefined,
    alertSettings: alertSettings || undefined,
    watchlistSymbols,
    alertRules,
    webhooks,
  }
}

/**
 * Push all local data to cloud
 * Called on first sign in (migration) or manual backup
 */
export async function pushAllToCloud(userId: string, state: SyncState) {
  await Promise.all([
    state.userSettings ? syncUserSettingsToCloud(userId, state.userSettings) : Promise.resolve(),
    state.alertSettings ? syncAlertSettingsToCloud(userId, state.alertSettings as AlertSettings) : Promise.resolve(),
    // Watchlist sync disabled for simplified watchlist
    syncAlertRulesToCloud(userId, state.alertRules),
    syncWebhooksToCloud(userId, state.webhooks),
  ])
}

/**
 * Setup real-time subscriptions for user data
 * Updates local state when data changes in cloud
 */
export function setupRealtimeSync(
  userId: string,
  callbacks: {
    onWatchlistChange?: (watchlistSymbols: string[]) => void
    onAlertRuleChange?: (rules: AlertRule[]) => void
    onWebhookChange?: (webhooks: WebhookConfig[]) => void
  }
) {
  const channels: ReturnType<typeof supabase.channel>[] = []

  // TODO: Implement watchlist sync for simplified single-watchlist system
  // Subscribe to watchlist changes
  if (callbacks.onWatchlistChange) {
    // Watchlist sync disabled - needs schema update for simplified watchlist
    debug.log('⚠️ Watchlist real-time sync not yet implemented for simplified watchlist')
  }

  // Subscribe to alert rules changes
  if (callbacks.onAlertRuleChange) {
    const rulesChannel = supabase
      .channel('alert_rules_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'alert_rules',
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          const rules = await syncAlertRulesFromCloud(userId)
          callbacks.onAlertRuleChange?.(rules)
        }
      )
      .subscribe()

    channels.push(rulesChannel)
  }

  // Subscribe to webhooks changes
  if (callbacks.onWebhookChange) {
    const webhooksChannel = supabase
      .channel('webhooks_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'webhooks',
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          const webhooks = await syncWebhooksFromCloud(userId)
          callbacks.onWebhookChange?.(webhooks)
        }
      )
      .subscribe()

    channels.push(webhooksChannel)
  }

  // Return cleanup function
  return () => {
    debug.log('🧹 Unsubscribing from', channels.length, 'realtime channels')
    
    channels.forEach((channel) => {
      // Only unsubscribe channels that successfully connected
      if (channel.state === 'joined') {
        channel.unsubscribe()
      }
      // Remove from Supabase client regardless of state
      supabase.removeChannel(channel)
    })
  }
}
