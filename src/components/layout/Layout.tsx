import { ReactNode } from 'react'
import { Header } from './Header'
import { Footer } from './Footer'
import { useAutoHideHeader } from '@/hooks'

interface LayoutProps {
  children: ReactNode
  title?: string
  subtitle?: string
  onOpenSettings?: () => void
  /** Enable auto-hide header behavior (default: true) */
  autoHideHeader?: boolean
}

export function Layout({ 
  children, 
  title, 
  subtitle, 
  onOpenSettings,
  autoHideHeader = true,
}: LayoutProps) {
  const { isVisible, onMouseEnter, onMouseLeave } = useAutoHideHeader({
    enabled: autoHideHeader,
    threshold: 5,
    hideDelay: 150,
    showAtTop: true,
    topOffset: 50,
  })

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Header 
        title={title} 
        subtitle={subtitle} 
        onOpenSettings={onOpenSettings}
        isVisible={isVisible}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
      {/* Add padding-top to account for fixed header */}
      <main className="flex-1 w-full max-w-[1920px] mx-auto px-4 py-4 sm:px-6 sm:py-6 animate-fade-in pt-[60px] sm:pt-[80px]">
        {children}
      </main>
      <Footer />
    </div>
  )
}
