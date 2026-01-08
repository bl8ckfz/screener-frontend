import { useMemo } from 'react'
import type { Coin } from '@/types/coin'
import { useStore } from '@/hooks/useStore'
import { sortCoins } from '@/utils/sort'
import { TableRowSkeleton } from '@/components/ui'
import { CoinTableRow } from './CoinTableRow'

interface CoinTableProps {
  coins: Coin[]
  onCoinClick?: (coin: Coin) => void
  isLoading?: boolean
}

export function CoinTable({ coins, onCoinClick, isLoading = false }: CoinTableProps) {
  const { sort, setSort } = useStore()
  const watchlistSymbols = useStore((state) => state.watchlistSymbols)

  const { watchlistCoins, otherCoins } = useMemo(() => {
    // Separate coins into watchlist and non-watchlist
    const watchlist: Coin[] = []
    const other: Coin[] = []

    coins.forEach((coin) => {
      if (watchlistSymbols.includes(coin.symbol)) {
        watchlist.push(coin)
      } else {
        other.push(coin)
      }
    })

    // Sort each group independently
    return {
      watchlistCoins: sortCoins(watchlist, sort),
      otherCoins: sortCoins(other, sort),
    }
  }, [coins, sort, watchlistSymbols])

  const handleSort = (field: typeof sort.field) => {
    setSort({
      field,
      direction:
        sort.field === field && sort.direction === 'desc' ? 'asc' : 'desc',
    })
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-900 sticky top-0 z-10">
          <tr className="border-b border-gray-700">
            <th className="px-3 py-3 text-center text-sm font-semibold text-gray-400 whitespace-nowrap w-16 bg-gray-900">
              ⭐
            </th>
            <th
              className="px-3 py-3 text-left text-sm font-semibold text-gray-400 cursor-pointer hover:text-gray-200 transition-colors select-none whitespace-nowrap bg-gray-900"
              onClick={() => handleSort('symbol')}
            >
              <div className="flex items-center gap-1">
                Symbol
                {sort.field === 'symbol' && (
                  <span className="text-accent">{sort.direction === 'asc' ? '↑' : '↓'}</span>
                )}
              </div>
            </th>
            <th
              className="px-3 py-3 text-right text-sm font-semibold text-gray-400 cursor-pointer hover:text-gray-200 transition-colors select-none whitespace-nowrap bg-gray-900"
              onClick={() => handleSort('lastPrice')}
            >
              <div className="flex items-center justify-end gap-1">
                Price
                {sort.field === 'lastPrice' && (
                  <span className="text-accent">{sort.direction === 'asc' ? '↑' : '↓'}</span>
                )}
              </div>
            </th>
            <th
              className="px-3 py-3 text-right text-sm font-semibold text-gray-400 cursor-pointer hover:text-gray-200 transition-colors select-none whitespace-nowrap bg-gray-900"
              onClick={() => handleSort('priceChangePercent')}
            >
              <div className="flex items-center justify-end gap-1">
                Change %
                {sort.field === 'priceChangePercent' && (
                  <span className="text-accent">{sort.direction === 'asc' ? '↑' : '↓'}</span>
                )}
              </div>
            </th>
            <th
              className="px-3 py-3 text-right text-sm font-semibold text-gray-400 cursor-pointer hover:text-gray-200 transition-colors select-none whitespace-nowrap bg-gray-900"
              onClick={() => handleSort('priceToWeightedAvg')}
            >
              <div className="flex items-center justify-end gap-1">
                P/WA
                {sort.field === 'priceToWeightedAvg' && (
                  <span className="text-accent">{sort.direction === 'asc' ? '↑' : '↓'}</span>
                )}
              </div>
            </th>
            <th
              className="px-3 py-3 text-right text-sm font-semibold text-gray-400 cursor-pointer hover:text-gray-200 transition-colors select-none whitespace-nowrap bg-gray-900"
              onClick={() => handleSort('quoteVolume')}
            >
              <div className="flex items-center justify-end gap-1">
                24h Vol
                {sort.field === 'quoteVolume' && (
                  <span className="text-accent">{sort.direction === 'asc' ? '↑' : '↓'}</span>
                )}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            // Show skeleton rows while loading
            Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} />)
          ) : (
            <>
              {/* Watchlist coins - always on top */}
              {watchlistCoins.map((coin, index) => (
                <CoinTableRow
                  key={coin.id}
                  coin={coin}
                  index={index}
                  onClick={onCoinClick}
                />
              ))}
              
              {/* Visual separator between watchlist and other coins */}
              {watchlistCoins.length > 0 && otherCoins.length > 0 && (
                <tr>
                  <td colSpan={6} className="px-0 py-0">
                    <div className="border-t-2 border-accent/30 relative">
                      <div className="absolute left-0 right-0 top-0 flex items-center justify-center">
                        <span className="bg-gray-800 px-3 py-0.5 text-xs text-accent/60 -mt-2.5 rounded-full border border-accent/30">
                          Other Coins
                        </span>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              
              {/* Other coins */}
              {otherCoins.map((coin, index) => (
                <CoinTableRow
                  key={coin.id}
                  coin={coin}
                  index={watchlistCoins.length + index}
                  onClick={onCoinClick}
                />
              ))}
            </>
          )}
        </tbody>
      </table>

      {watchlistCoins.length === 0 && otherCoins.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No coins found for this pair
        </div>
      )}
    </div>
  )
}
