import { useCallback } from 'react'
import { ThemeToggle } from '@/components/controls'
import { AuthModal, UserMenu } from '@/components/auth'
import { SettingsButton } from '@/components/settings'
import { useStore } from '@/hooks/useStore'

interface HeaderProps {
  title?: string
  subtitle?: string
  onOpenSettings?: () => void
}

export function Header({ title = 'Crypto Screener', subtitle, onOpenSettings }: HeaderProps) {
  const isAuthModalOpen = useStore((state) => state.isAuthModalOpen)
  const setAuthModalOpen = useStore((state) => state.setAuthModalOpen)

  // Memoize callbacks to prevent AuthModal from re-rendering
  const handleOpenAuth = useCallback(() => setAuthModalOpen(true), [setAuthModalOpen])
  const handleCloseAuth = useCallback(() => setAuthModalOpen(false), [setAuthModalOpen])

  return (
    <>
      <header className="sticky top-0 z-50 bg-gray-900 border-b border-gray-800 backdrop-blur-sm bg-opacity-95">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">{title}</h1>
              {subtitle && (
                <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-400">
                <span className="text-bullish">●</span> Live
              </div>
              <UserMenu onSignIn={handleOpenAuth} />
              {onOpenSettings && <SettingsButton onClick={onOpenSettings} />}
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={handleCloseAuth}
      />
    </>
  )
}
