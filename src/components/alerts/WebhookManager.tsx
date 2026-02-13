import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useStore } from '@/hooks/useStore'
import { webhookService } from '@/services/webhookService'
import type { Webhook, WebhookType, WebhookScope, CreateWebhookRequest, UpdateWebhookRequest } from '@/services/webhookService'
import { authService } from '@/services/authService'

/**
 * WebhookManager Component
 * 
 * Manages user webhooks with backend integration.
 * Supports Discord, Telegram, Slack, and generic HTTP webhooks.
 * Single checkbox for watchlist-only scope (simplified UI).
 * 
 * Phase 5: Frontend Webhook Integration
 */
export function WebhookManager() {
  const webhooks = useStore((state) => state.webhooks)
  const setWebhooks = useStore((state) => state.setWebhooks)
  const addWebhook = useStore((state) => state.addWebhook)
  const updateWebhook = useStore((state) => state.updateWebhook)
  const deleteWebhook = useStore((state) => state.deleteWebhook)
  const toggleWebhook = useStore((state) => state.toggleWebhook)
  
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<{
    name: string
    webhook_type: WebhookType
    webhook_url: string
    scope: WebhookScope
    config: Record<string, any>
  }>({
    name: '',
    webhook_type: 'discord',
    webhook_url: '',
    scope: 'all',
    config: {},
  })
  const [isTesting, setIsTesting] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  // Load webhooks on mount if authenticated
  useEffect(() => {
    if (authService.isAuthenticated()) {
      loadWebhooks()
    }
  }, [])

  const loadWebhooks = async () => {
    try {
      setIsLoading(true)
      const webhooksData = await webhookService.getWebhooks()
      setWebhooks(webhooksData)
    } catch (err) {
      console.error('Failed to load webhooks:', err)
      setError('Failed to load webhooks')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAdd = () => {
    setIsAdding(true)
    setEditingId(null)
    setFormData({
      name: '',
      webhook_type: 'discord',
      webhook_url: '',
      scope: 'all',
      config: {},
    })
    setError('')
  }

  const handleEdit = (webhook: Webhook) => {
    setIsAdding(true)
    setEditingId(webhook.id)
    setFormData({
      name: webhook.name,
      webhook_type: webhook.webhook_type,
      webhook_url: webhook.webhook_url,
      scope: webhook.scope,
      config: webhook.config || {},
    })
    setError('')
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Please enter a name')
      return
    }

    if (!formData.webhook_url.trim()) {
      setError('Please enter a webhook URL')
      return
    }

    // Basic URL validation
    try {
      new URL(formData.webhook_url)
    } catch {
      setError('Please enter a valid URL')
      return
    }

    try {
      setIsLoading(true)
      
      if (editingId) {
        // Update existing webhook
        const request: UpdateWebhookRequest = {
          name: formData.name,
          webhook_type: formData.webhook_type,
          webhook_url: formData.webhook_url,
          scope: formData.scope,
          is_enabled: true,
          config: formData.config,
        }
        const updated = await webhookService.updateWebhook(editingId, request)
        updateWebhook(editingId, updated)
      } else {
        // Create new webhook
        const request: CreateWebhookRequest = {
          name: formData.name,
          webhook_type: formData.webhook_type,
          webhook_url: formData.webhook_url,
          scope: formData.scope,
          config: formData.config,
        }
        const created = await webhookService.createWebhook(request)
        addWebhook(created)
      }

      setIsAdding(false)
      setEditingId(null)
      setError('')
    } catch (err: any) {
      console.error('Failed to save webhook:', err)
      setError(err.message || 'Failed to save webhook')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) {
      return
    }

    try {
      setIsDeleting(id)
      await webhookService.deleteWebhook(id)
      deleteWebhook(id)
    } catch (err: any) {
      console.error('Failed to delete webhook:', err)
      setError(err.message || 'Failed to delete webhook')
    } finally {
      setIsDeleting(null)
    }
  }

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await webhookService.toggleWebhook(id, !enabled)
      toggleWebhook(id, !enabled)
    } catch (err: any) {
      console.error('Failed to toggle webhook:', err)
      setError(err.message || 'Failed to toggle webhook')
    }
  }

  const handleTest = async (webhook: Webhook) => {
    setIsTesting(webhook.id)
    setError('')

    try {
      await webhookService.testWebhook(webhook.id)
      alert(`Test alert sent to ${webhook.name}. Check your ${webhook.webhook_type} channel.`)
    } catch (err: any) {
      console.error('Failed to test webhook:', err)
      setError(err.message || 'Failed to test webhook')
    } finally {
      setIsTesting(null)
    }
  }

  if (!authService.isAuthenticated()) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400 text-sm">Please log in to manage webhooks</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-white">Webhook Configurations</h4>
          <p className="text-xs text-gray-400">
            {webhooks.filter((w) => w.is_enabled).length} of {webhooks.length} webhooks active
            {webhooks.length >= 10 && ' (max 10 reached)'}
          </p>
        </div>
        <Button
          onClick={handleAdd}
          variant="secondary"
          size="sm"
          disabled={isLoading || webhooks.length >= 10}
        >
          + Add Webhook
        </Button>
      </div>

      {/* Add/Edit Form */}
      {isAdding && (
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 space-y-3">
          <h5 className="text-sm font-medium text-white">
            {editingId ? 'Edit Webhook' : 'New Webhook'}
          </h5>

          <div>
            <label className="text-xs text-gray-400">Name</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="My Discord Channel"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="text-xs text-gray-400">Type</label>
            <select
              value={formData.webhook_type}
              onChange={(e) =>
                setFormData({ ...formData, webhook_type: e.target.value as WebhookType })
              }
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
              disabled={isLoading}
            >
              <option value="discord">Discord</option>
              <option value="telegram">Telegram</option>
              <option value="slack">Slack</option>
              <option value="http">HTTP (Generic)</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-400">Webhook URL</label>
            <Input
              type="url"
              value={formData.webhook_url}
              onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
              placeholder={
                formData.webhook_type === 'discord'
                  ? 'https://discord.com/api/webhooks/...'
                  : formData.webhook_type === 'telegram'
                  ? 'https://api.telegram.org/bot<token>/sendMessage?chat_id=<chat_id>'
                  : formData.webhook_type === 'slack'
                  ? 'https://hooks.slack.com/services/...'
                  : 'https://your-api.com/webhook'
              }
              disabled={isLoading}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="watchlist-only"
              checked={formData.scope === 'watchlist'}
              onChange={(e) =>
                setFormData({ ...formData, scope: e.target.checked ? 'watchlist' : 'all' })
              }
              className="rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
              disabled={isLoading}
            />
            <label htmlFor="watchlist-only" className="text-xs text-gray-400">
              Watchlist alerts only
            </label>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2">
            <Button onClick={handleSave} variant="primary" size="sm" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save'}
            </Button>
            <Button
              onClick={() => {
                setIsAdding(false)
                setEditingId(null)
                setError('')
              }}
              variant="secondary"
              size="sm"
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Webhook List */}
      {isLoading && webhooks.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">Loading webhooks...</div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          No webhooks configured. Add one to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {webhooks.map((webhook) => (
            <div
              key={webhook.id}
              className="rounded-lg border border-gray-700 bg-gray-800/50 p-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={webhook.is_enabled}
                      onChange={() => handleToggle(webhook.id, webhook.is_enabled)}
                      className="peer sr-only"
                    />
                    <div className="peer h-5 w-9 rounded-full bg-gray-700 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-600 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                  </label>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{webhook.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300 uppercase">
                        {webhook.webhook_type}
                      </span>
                      {webhook.scope === 'watchlist' && (
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-900/50 text-blue-300">
                          Watchlist Only
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 truncate">
                      {webhook.webhook_url}
                    </div>

                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => handleTest(webhook)}
                    variant="secondary"
                    size="sm"
                    disabled={isTesting === webhook.id || !webhook.is_enabled}
                  >
                    {isTesting === webhook.id ? 'Testing...' : 'Test'}
                  </Button>
                  <Button
                    onClick={() => handleEdit(webhook)}
                    variant="secondary"
                    size="sm"
                    disabled={isLoading}
                  >
                    Edit
                  </Button>
                  <Button
                    onClick={() => handleDelete(webhook.id)}
                    variant="danger"
                    size="sm"
                    disabled={isDeleting === webhook.id}
                  >
                    {isDeleting === webhook.id ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && !isAdding && (
        <div className="rounded-lg border border-red-900 bg-red-900/20 p-3">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
    </div>
  )
}
