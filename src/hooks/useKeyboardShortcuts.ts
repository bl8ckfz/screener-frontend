/**
 * Keyboard Shortcuts Hook
 * 
 * Centralized keyboard shortcut management with event handling and cleanup.
 * Supports global shortcuts and context-specific shortcuts.
 */

import { useEffect, useCallback } from 'react'

export interface ShortcutConfig {
  /** Keyboard key (e.g., 'Escape', 'k', 'ArrowUp') */
  key: string
  /** Whether Ctrl/Cmd key must be pressed */
  ctrl?: boolean
  /** Whether Shift key must be pressed */
  shift?: boolean
  /** Whether Alt/Option key must be pressed */
  alt?: boolean
  /** Callback when shortcut is triggered */
  callback: (event: KeyboardEvent) => void
  /** Description for help modal */
  description: string
  /** Whether shortcut is currently enabled */
  enabled?: boolean
  /** Prevent default browser behavior */
  preventDefault?: boolean
}

/**
 * useKeyboardShortcuts hook
 * 
 * Registers keyboard shortcuts and handles cleanup
 * 
 * @example
 * ```tsx
 * useKeyboardShortcuts([
 *   { key: 'Escape', callback: closeModal, description: 'Close modal' },
 *   { key: 'k', ctrl: true, callback: focusSearch, description: 'Focus search' },
 * ])
 * ```
 */
export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        // Skip if disabled
        if (shortcut.enabled === false) continue

        // Check if key matches
        if (event.key !== shortcut.key) continue

        // Check modifiers
        const ctrlPressed = event.ctrlKey || event.metaKey // Support both Ctrl and Cmd
        const shiftPressed = event.shiftKey
        const altPressed = event.altKey

        if (
          (shortcut.ctrl && !ctrlPressed) ||
          (!shortcut.ctrl && ctrlPressed)
        )
          continue
        if (
          (shortcut.shift && !shiftPressed) ||
          (!shortcut.shift && shiftPressed)
        )
          continue
        if ((shortcut.alt && !altPressed) || (!shortcut.alt && altPressed))
          continue

        // Prevent default if specified
        if (shortcut.preventDefault !== false) {
          event.preventDefault()
        }

        // Execute callback
        shortcut.callback(event)
        break // Only trigger first matching shortcut
      }
    },
    [shortcuts]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

/**
 * Format shortcut for display
 * 
 * @example
 * ```tsx
 * formatShortcut({ key: 'k', ctrl: true }) // "Ctrl+K" or "⌘K"
 * ```
 */
export function formatShortcut(shortcut: ShortcutConfig): string {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const parts: string[] = []

  if (shortcut.ctrl) parts.push(isMac ? '⌘' : 'Ctrl')
  if (shortcut.shift) parts.push('⇧')
  if (shortcut.alt) parts.push(isMac ? '⌥' : 'Alt')

  // Format key name
  const keyName = shortcut.key.length === 1 
    ? shortcut.key.toUpperCase() 
    : shortcut.key

  parts.push(keyName)

  return parts.join(isMac ? '' : '+')
}

/**
 * Common keyboard shortcuts used across the app
 */
export const COMMON_SHORTCUTS = {
  ESCAPE: 'Escape',
  ENTER: 'Enter',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  SPACE: ' ',
  TAB: 'Tab',
} as const
