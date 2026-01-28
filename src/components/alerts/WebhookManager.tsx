import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useStore } from '@/hooks/useStore'
import { isValidDiscordWebhookUrl } from '@/services/backendApi'
import type { WebhookConfig } from '@/types/alert'

type WebhookSource = 'main' | 'watchlist'

export function WebhookManager() {
  const alertSettings = useStore((state) => state.alertSettings)
  const updateAlertSettings = useStore((state) => state.updateAlertSettings)
  
  const [activeTab, setActiveTab] = useState<WebhookSource>('main')
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    type: 'discord' as 'discord' | 'telegram',
    url: '',
    botToken: '',
    chatId: '',
  })
  const [isTesting, setIsTesting] = useState<string | null>(null)
  const [error, setError] = useState<string>('')

  const currentWebhooks = activeTab === 'main' 
    ? (alertSettings.webhooks || [])
    : (alertSettings.watchlistWebhooks || [])

  const handleAdd = () => {
    setIsAdding(true)
    setEditingId(null)
    setFormData({ name: '', type: 'discord', url: '', botToken: '', chatId: '' })
    setError('')
  }

  const handleEdit = (webhook: WebhookConfig) => {
    setIsAdding(true)
    setEditingId(webhook.id)
    
    if (webhook.type === 'telegram') {
      const match = webhook.url.match(/^telegram:\/\/([^:]+):(.+)$/)
      if (match) {
        const [, botToken, chatId] = match
        setFormData({ name: webhook.name, type: 'telegram', url: '', botToken, chatId })
      }
    } else {
      setFormData({ name: webhook.name, type: webhook.type, url: webhook.url, botToken: '', chatId: '' })
    }
    setError('')
  }

  const handleSave = () => {
    if (!formData.name.trim()) {
      setError('Please enter a name')
      return
    }

    if (formData.type === 'discord') {
      if (!formData.url || !isValidDiscordWebhookUrl(formData.url)) {
        setError('Please enter a valid Discord webhook URL')
        return
      }
    } else if (formData.type === 'telegram') {
      if (!formData.botToken || !formData.chatId) {
        setError('Please enter both bot token and chat ID')
        return
      }
    }

    const webhookKey = activeTab === 'main' ? 'webhooks' : 'watchlistWebhooks'
    const webhooks = [...(activeTab === 'main' 
      ? (alertSettings.webhooks || [])
      : (alertSettings.watchlistWebhooks || [])
    )]
    
    if (editingId) {
      const index = webhooks.findIndex(w => w.id === editingId)
      if (index >= 0) {
        webhooks[index] = {
          ...webhooks[index],
          name: formData.name,
          type: formData.type,
          url: formData.type === 'telegram' 
            ? `telegram://${formData.botToken}:${formData.chatId}`
            : formData.url,
        }
      }
    } else {
      const newWebhook: WebhookConfig = {
        id: `webhook_${Date.now()}`,
        name: formData.name,
        type: formData.type,
        url: formData.type === 'telegram' 
          ? `telegram://${formData.botToken}:${formData.chatId}`
          : formData.url,
        enabled: true,
        createdAt: Date.now(),
      }
      webhooks.push(newWebhook)
    }

    updateAlertSettings({ [webhookKey]: webhooks })
    setIsAdding(false)
    setEditingId(null)
    setError('')
  }

  const handleDelete = (id: string) => {
    const webhookKey = activeTab === 'main' ? 'webhooks' : 'watchlistWebhooks'
    const webhooks = currentWebhooks.filter(w => w.id !== id)
    updateAlertSettings({ [webhookKey]: webhooks })
  }

  const handleToggle = (id: string) => {
    const webhookKey = activeTab === 'main' ? 'webhooks' : 'watchlistWebhooks'
    const webhooks = currentWebhooks.map(w =>
      w.id === id ? { ...w, enabled: !w.enabled } : w
    )
    updateAlertSettings({ [webhookKey]: webhooks })
  }

  const handleTest = async (webhook: WebhookConfig) => {
    setIsTesting(webhook.id)
    setError('')

    // TODO: Implement webhook testing via backend API when endpoint is ready
    console.warn('Webhook testing not yet implemented - backend endpoint needed')
    alert('Webhook testing will be available once backend webhook endpoints are implemented')
    
    setIsTesting(null)
  }

  return (
    <div className="space-y-4">
      {/* Global Webhook Toggle */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-white">Webhook Notifications</h4>
            <p className="text-xs text-gray-400 mt-0.5">
              Send alerts to Discord, Telegram, and other services
            </p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={alertSettings.webhookEnabled}
              onChange={(e) => updateAlertSettings({ webhookEnabled: e.target.checked })}
              className="peer sr-only"
            />
            <div className="peer h-5 w-9 rounded-full bg-gray-700 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-600 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800"></div>
          </label>
        </div>
      </div>

      {/* Webhook Source Tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('main')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'main'
              ? 'border-b-2 border-blue-500 text-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Main Alerts
        </button>
        <button
          onClick={() => setActiveTab('watchlist')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'watchlist'
              ? 'border-b-2 border-blue-500 text-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Watchlist Alerts
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-white">
            {activeTab === 'main' ? 'Main' : 'Watchlist'} Webhook Configurations
          </h4>
          <p className="text-xs text-gray-400">
            {currentWebhooks.filter(w => w.enabled).length} of {currentWebhooks.length} webhooks active
          </p>
        </div>
        <Button onClick={handleAdd} variant="secondary" size="sm">
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
            />
          </div>

          <div>
            <label className="text-xs text-gray-400">Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
            >
              <option value="discord">Discord</option>
              <option value="telegram">Telegram</option>
            </select>
          </div>

          {formData.type === 'discord' ? (
            <div>
              <label className="text-xs text-gray-400">Webhook URL</label>
              <Input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://discord.com/api/webhooks/..."
              />
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs text-gray-400">Bot Token</label>
                <Input
                  type="password"
                  value={formData.botToken}
                  onChange={(e) => setFormData({ ...formData, botToken: e.target.value })}
                  placeholder="123456:ABC-DEF..."
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Chat ID</label>
                <Input
                  value={formData.chatId}
                  onChange={(e) => setFormData({ ...formData, chatId: e.target.value })}
                  placeholder="-1001234567890"
                />
              </div>
            </>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2">
            <Button onClick={handleSave} variant="primary" size="sm">
              Save
            </Button>
            <Button
              onClick={() => {
                setIsAdding(false)
                setEditingId(null)
                setError('')
              }}
              variant="secondary"
              size="sm"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Webhook List */}
      {currentWebhooks.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          No {activeTab} webhooks configured. Add one to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {currentWebhooks.map((webhook) => (
            <div
              key={webhook.id}
              className="rounded-lg border border-gray-700 bg-gray-800/50 p-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={webhook.enabled}
                      onChange={() => handleToggle(webhook.id)}
                      className="peer sr-only"
                    />
                    <div className="peer h-5 w-9 rounded-full bg-gray-700 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-600 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                  </label>
                  
                  <div>
                    <div className="text-sm font-medium text-white">{webhook.name}</div>
                    <div className="text-xs text-gray-400">
                      {webhook.type === 'discord' ? '🔵 Discord' : '✈️ Telegram'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => handleTest(webhook)}
                    variant="secondary"
                    size="sm"
                    disabled={isTesting === webhook.id}
                  >
                    {isTesting === webhook.id ? 'Testing...' : 'Test'}
                  </Button>
                  <Button
                    onClick={() => handleEdit(webhook)}
                    variant="secondary"
                    size="sm"
                  >
                    Edit
                  </Button>
                  <Button
                    onClick={() => handleDelete(webhook.id)}
                    variant="secondary"
                    size="sm"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
