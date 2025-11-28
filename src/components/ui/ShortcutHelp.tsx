/**
 * ShortcutHelp Component
 * 
 * Modal displaying all available keyboard shortcuts
 * Triggered by ? key
 */

import { useEffect } from 'react'
import { formatShortcut, type ShortcutConfig } from '@/hooks/useKeyboardShortcuts'

export interface ShortcutHelpProps {
  isOpen: boolean
  onClose: () => void
  shortcuts: ShortcutConfig[]
}

/**
 * ShortcutHelp modal component
 * 
 * Displays all keyboard shortcuts in a categorized, easy-to-scan format
 */
export function ShortcutHelp({ isOpen, onClose, shortcuts }: ShortcutHelpProps) {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Group shortcuts by category (inferred from description)
  const categorized = shortcuts.reduce<Record<string, ShortcutConfig[]>>(
    (acc, shortcut) => {
      let category = 'General'
      
      if (shortcut.description.toLowerCase().includes('search')) {
        category = 'Search'
      } else if (
        shortcut.description.toLowerCase().includes('navigate') ||
        shortcut.description.toLowerCase().includes('arrow') ||
        shortcut.description.toLowerCase().includes('next') ||
        shortcut.description.toLowerCase().includes('previous')
      ) {
        category = 'Navigation'
      } else if (
        shortcut.description.toLowerCase().includes('modal') ||
        shortcut.description.toLowerCase().includes('close') ||
        shortcut.description.toLowerCase().includes('open')
      ) {
        category = 'Modals'
      }

      if (!acc[category]) acc[category] = []
      acc[category].push(shortcut)
      return acc
    },
    {}
  )

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto animate-fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-gray-900 rounded-lg shadow-2xl w-full max-w-2xl border border-gray-700 animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <div>
              <h2 className="text-2xl font-bold text-white">Keyboard Shortcuts</h2>
              <p className="text-sm text-gray-400 mt-1">
                Quick actions to boost your productivity
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors text-2xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[70vh] overflow-y-auto">
            {Object.entries(categorized).map(([category, categoryShortcuts]) => (
              <div key={category} className="mb-6 last:mb-0">
                <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">
                  {category}
                </h3>
                <div className="space-y-2">
                  {categoryShortcuts.map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-2 px-3 bg-gray-800/50 rounded hover:bg-gray-800 transition-colors"
                    >
                      <span className="text-gray-300">{shortcut.description}</span>
                      <kbd className="px-3 py-1 text-sm font-mono bg-gray-700 text-white rounded border border-gray-600 shadow-sm">
                        {formatShortcut(shortcut)}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-700 bg-gray-800/50 text-center">
            <p className="text-xs text-gray-400">
              Press <kbd className="px-2 py-0.5 text-xs font-mono bg-gray-700 rounded">?</kbd> or{' '}
              <kbd className="px-2 py-0.5 text-xs font-mono bg-gray-700 rounded">Esc</kbd> to close
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
