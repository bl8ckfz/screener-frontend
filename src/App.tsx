import { useState, useMemo, useRef } from 'react'
import { useMarketData } from '@/hooks/useMarketData'
import { useStore } from '@/hooks/useStore'
import { useKeyboardShortcuts } from '@/hooks'
import { Layout } from '@/components/layout'
import { CoinTable, CoinModal } from '@/components/coin'
import { MarketSummary } from '@/components/market'
import {
  PairSelector,
  RefreshControl,
  SearchBar,
  TimeframeSelector,
  ListSelector,
} from '@/components/controls'
import { ErrorStates, EmptyStates, ShortcutHelp } from '@/components/ui'
import { sortCoinsByList } from '@/utils'
import { getListById } from '@/types'
import type { Coin, Timeframe } from '@/types/coin'

function App() {
  const { data: coins, isLoading, error } = useMarketData()
  const currentPair = useStore((state) => state.currentPair)
  const currentList = useStore((state) => state.currentList)
  const setCurrentList = useStore((state) => state.setCurrentList)

  // Local state for UI interactions
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTimeframe, setSelectedTimeframe] =
    useState<Timeframe>('5s')
  const [selectedCoin, setSelectedCoin] = useState<Coin | null>(null)
  const [showShortcutHelp, setShowShortcutHelp] = useState(false)
  const [selectedRowIndex, setSelectedRowIndex] = useState(0)
  
  // Ref for search input
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Filter and sort coins based on search query and selected list
  const filteredCoins = useMemo(() => {
    if (!coins) return []

    // Apply search filter
    let filtered = coins
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = coins.filter(
        (coin) =>
          coin.symbol.toLowerCase().includes(query) ||
          coin.fullSymbol.toLowerCase().includes(query)
      )
    }

    // Apply list-based sorting
    const list = getListById(currentList)
    if (list) {
      return sortCoinsByList(filtered, currentList, list.sortField, list.isBull)
    }

    return filtered
  }, [coins, searchQuery, currentList])

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'Escape',
      description: 'Close modal or clear search',
      callback: () => {
        if (selectedCoin) {
          setSelectedCoin(null)
        } else if (searchQuery) {
          setSearchQuery('')
        }
      },
    },
    {
      key: 'k',
      ctrl: true,
      description: 'Focus search bar',
      callback: () => {
        searchInputRef.current?.focus()
      },
    },
    {
      key: '?',
      description: 'Show keyboard shortcuts',
      callback: () => {
        setShowShortcutHelp(true)
      },
      preventDefault: true,
    },
    {
      key: 'ArrowDown',
      description: 'Navigate to next coin',
      callback: () => {
        if (!selectedCoin && filteredCoins.length > 0) {
          const nextIndex = (selectedRowIndex + 1) % filteredCoins.length
          setSelectedRowIndex(nextIndex)
        }
      },
      enabled: !selectedCoin,
    },
    {
      key: 'ArrowUp',
      description: 'Navigate to previous coin',
      callback: () => {
        if (!selectedCoin && filteredCoins.length > 0) {
          const prevIndex = selectedRowIndex === 0 ? filteredCoins.length - 1 : selectedRowIndex - 1
          setSelectedRowIndex(prevIndex)
        }
      },
      enabled: !selectedCoin,
    },
    {
      key: 'Enter',
      description: 'Open selected coin details',
      callback: () => {
        if (!selectedCoin && filteredCoins[selectedRowIndex]) {
          setSelectedCoin(filteredCoins[selectedRowIndex])
        }
      },
      enabled: !selectedCoin && filteredCoins.length > 0,
    },
  ])

  return (
    <Layout
      title="Crypto Screener"
      subtitle={`Real-time ${currentPair} market analysis`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar - Controls */}
        <div className="lg:col-span-1 space-y-4">
          <ListSelector 
            selectedListId={currentList} 
            onSelectList={setCurrentList} 
          />
          <PairSelector />
          <RefreshControl />
          <TimeframeSelector
            selectedTimeframe={selectedTimeframe}
            onSelect={setSelectedTimeframe}
          />
          <MarketSummary />
        </div>

        {/* Main Content - Coin Table */}
        <div className="lg:col-span-3 space-y-4">
          {/* Search Bar */}
          <SearchBar ref={searchInputRef} onSearch={setSearchQuery} />

          {/* Coin Table */}
          <div className="bg-gray-900 rounded-lg overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  Market Data{' '}
                  <span className="text-accent">{currentPair}</span>
                </h2>
                {coins && (
                  <span className="text-sm text-gray-400">
                    {filteredCoins.length} of {coins.length} coins
                    {searchQuery && ' (filtered)'}
                  </span>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="min-h-[600px]">
              {error ? (
                ErrorStates.API()
              ) : (
                <>
                  <CoinTable
                    coins={filteredCoins}
                    onCoinClick={setSelectedCoin}
                    isLoading={isLoading}
                  />

                  {!isLoading &&
                    filteredCoins &&
                    filteredCoins.length === 0 &&
                    searchQuery &&
                    EmptyStates.NoSearchResults(searchQuery, () => setSearchQuery(''))}

                  {!isLoading &&
                    filteredCoins &&
                    filteredCoins.length === 0 &&
                    !searchQuery &&
                    coins &&
                    coins.length === 0 &&
                    EmptyStates.NoCoins(currentPair)}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Coin Detail Modal */}
      <CoinModal
        coin={selectedCoin}
        isOpen={!!selectedCoin}
        onClose={() => setSelectedCoin(null)}
      />

      {/* Keyboard Shortcuts Help */}
      <ShortcutHelp
        isOpen={showShortcutHelp}
        onClose={() => setShowShortcutHelp(false)}
        shortcuts={[
          { key: 'Escape', description: 'Close modal or clear search', callback: () => {} },
          { key: 'k', ctrl: true, description: 'Focus search bar', callback: () => {} },
          { key: '?', description: 'Show keyboard shortcuts', callback: () => {} },
          { key: 'ArrowDown', description: 'Navigate to next coin', callback: () => {} },
          { key: 'ArrowUp', description: 'Navigate to previous coin', callback: () => {} },
          { key: 'Enter', description: 'Open selected coin details', callback: () => {} },
        ]}
      />
    </Layout>
  )
}

export default App
