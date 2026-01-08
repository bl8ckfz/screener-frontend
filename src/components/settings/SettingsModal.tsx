import { useEffect, useState } from 'react'
import { AlertConfig } from '@/components/alerts/AlertConfig'
import { WebhookManager } from '@/components/alerts/WebhookManager'
import { GeneralSettings } from './GeneralSettings'
import { useStore } from '@/hooks/useStore'
import { Button } from '@/components/ui'

export interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: 'alerts' | 'webhooks' | 'general'
}

type SettingsTab = 'alerts' | 'webhooks' | 'general'

/**
 * SettingsModal Component
 * 
 * Modal dialog with tabbed interface for application settings.
 * Houses Alert Config, Webhook Manager, and General Settings.
 * 
 * Phase 8.1.4: Create Settings Modal
 */
export function SettingsModal({ isOpen, onClose, initialTab = 'alerts' }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab)
  
  const alertRules = useStore((state) => state.alertRules)
  const toggleAlertRule = useStore((state) => state.toggleAlertRule)
  const addAlertRule = useStore((state) => state.addAlertRule)
  const deleteAlertRule = useStore((state) => state.deleteAlertRule)

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  // Reset to initial tab when opened
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab)
    }
  }, [isOpen, initialTab])

  if (!isOpen) return null

  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: 'alerts', label: 'Alert Rules', icon: '🔔' },
    { id: 'webhooks', label: 'Webhooks', icon: '🔗' },
    { id: 'general', label: 'General', icon: '⚙️' },
  ]

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-gray-900 rounded-lg shadow-2xl w-full max-w-6xl border border-gray-700 animate-in slide-in-from-bottom-8 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <h2 className="text-2xl font-bold text-white">Settings</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Close settings"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-700">
            <div className="flex space-x-1 px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? 'border-accent text-accent'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[calc(100vh-250px)] overflow-y-auto">
            {activeTab === 'alerts' && (
              <AlertConfig
                rules={alertRules}
                onRuleToggle={toggleAlertRule}
                onRuleCreate={addAlertRule}
                onRuleDelete={deleteAlertRule}
              />
            )}

            {activeTab === 'webhooks' && <WebhookManager />}

            {activeTab === 'general' && <GeneralSettings />}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700">
            <Button onClick={onClose} variant="primary">
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
