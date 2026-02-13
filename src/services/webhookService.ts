/**
 * Webhook Service
 * 
 * Handles webhook operations with backend API
 */

import axios from 'axios'
import { authService } from './authService'

const API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:8080'

export type WebhookType = 'discord' | 'telegram' | 'slack' | 'http'
export type WebhookScope = 'all' | 'watchlist'

export interface Webhook {
  id: string
  user_id: string
  name: string
  webhook_type: WebhookType
  webhook_url: string
  scope: WebhookScope
  is_enabled: boolean
  max_alerts_per_minute: number
  config?: Record<string, any>
  created_at: string
  updated_at: string
}

export interface CreateWebhookRequest {
  name: string
  webhook_type: WebhookType
  webhook_url: string
  scope?: WebhookScope
  is_enabled?: boolean
  config?: Record<string, any>
}

export interface UpdateWebhookRequest {
  name: string
  webhook_type: WebhookType
  webhook_url: string
  scope: WebhookScope
  is_enabled: boolean
  config?: Record<string, any>
}

export interface WebhooksResponse {
  webhooks: Webhook[]
  count: number
  limit: number
}

/**
 * Webhook service for managing user's webhooks
 */
export const webhookService = {
  /**
   * Get all webhooks for the current user
   */
  async getWebhooks(): Promise<Webhook[]> {
    const token = authService.getToken()
    if (!token) {
      throw new Error('Not authenticated')
    }

    try {
      const response = await axios.get<WebhooksResponse>(`${API_URL}/api/webhooks`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      return response.data.webhooks || []
    } catch (error: any) {
      if (error.response?.status === 401) {
        authService.logout()
      }
      throw new Error(error.response?.data?.error || 'Failed to get webhooks')
    }
  },

  /**
   * Get a specific webhook by ID
   */
  async getWebhook(webhookId: string): Promise<Webhook> {
    const token = authService.getToken()
    if (!token) {
      throw new Error('Not authenticated')
    }

    try {
      const response = await axios.get<Webhook>(`${API_URL}/api/webhooks/${webhookId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      return response.data
    } catch (error: any) {
      if (error.response?.status === 401) {
        authService.logout()
      }
      throw new Error(error.response?.data?.error || 'Failed to get webhook')
    }
  },

  /**
   * Create a new webhook
   */
  async createWebhook(webhook: CreateWebhookRequest): Promise<Webhook> {
    const token = authService.getToken()
    if (!token) {
      throw new Error('Not authenticated')
    }

    try {
      const response = await axios.post<Webhook>(
        `${API_URL}/api/webhooks`,
        {
          ...webhook,
          scope: webhook.scope || 'all',
          is_enabled: webhook.is_enabled !== undefined ? webhook.is_enabled : true,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      return response.data
    } catch (error: any) {
      if (error.response?.status === 401) {
        authService.logout()
      }
      throw new Error(error.response?.data?.error || 'Failed to create webhook')
    }
  },

  /**
   * Update an existing webhook
   */
  async updateWebhook(webhookId: string, webhook: UpdateWebhookRequest): Promise<Webhook> {
    const token = authService.getToken()
    if (!token) {
      throw new Error('Not authenticated')
    }

    try {
      const response = await axios.put<Webhook>(
        `${API_URL}/api/webhooks/${webhookId}`,
        webhook,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      return response.data
    } catch (error: any) {
      if (error.response?.status === 401) {
        authService.logout()
      }
      throw new Error(error.response?.data?.error || 'Failed to update webhook')
    }
  },

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    const token = authService.getToken()
    if (!token) {
      throw new Error('Not authenticated')
    }

    try {
      await axios.delete(`${API_URL}/api/webhooks/${webhookId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    } catch (error: any) {
      if (error.response?.status === 401) {
        authService.logout()
      }
      throw new Error(error.response?.data?.error || 'Failed to delete webhook')
    }
  },

  /**
   * Toggle webhook enabled/disabled
   */
  async toggleWebhook(webhookId: string, enabled: boolean): Promise<void> {
    const token = authService.getToken()
    if (!token) {
      throw new Error('Not authenticated')
    }

    try {
      await axios.patch(
        `${API_URL}/api/webhooks/${webhookId}/toggle`,
        { enabled },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
    } catch (error: any) {
      if (error.response?.status === 401) {
        authService.logout()
      }
      throw new Error(error.response?.data?.error || 'Failed to toggle webhook')
    }
  },

  /**
   * Test a webhook by sending a test message
   */
  async testWebhook(webhookId: string): Promise<void> {
    const token = authService.getToken()
    if (!token) {
      throw new Error('Not authenticated')
    }

    try {
      await axios.post(
        `${API_URL}/api/webhooks/${webhookId}/test`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
    } catch (error: any) {
      if (error.response?.status === 401) {
        authService.logout()
      }
      throw new Error(error.response?.data?.error || 'Failed to test webhook')
    }
  },
}
