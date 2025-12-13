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

  const sortedCoins = useMemo(() => {
    return sortCoins(coins, sort)
  }, [coins, sort])

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
        <thead className="bg-gray-900 sticky top-0">
          <tr className="border-b border-gray-700">
            <th
              className="px-3 py-3 text-left text-sm font-semibold text-gray-400 cursor-pointer hover:text-gray-200 transition-colors select-none whitespace-nowrap"
              onClick={() => handleSort('symbol')}
            >
              <div className="flex items-center gap-1">
                Symbol
                {sort.field === 'symbol' && (
                  <span className="text-accent">{sort.direction === 'asc' ? '↑' : '↓'}</span>
                )}
              </div>
            </th>
            <th className="px-3 py-3 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">
              Watchlist
            </th>
            <th
              className="px-3 py-3 text-right text-sm font-semibold text-gray-400 cursor-pointer hover:text-gray-200 transition-colors select-none whitespace-nowrap"
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
              className="px-3 py-3 text-right text-sm font-semibold text-gray-400 cursor-pointer hover:text-gray-200 transition-colors select-none whitespace-nowrap"
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
              className="px-3 py-3 text-right text-sm font-semibold text-gray-400 cursor-pointer hover:text-gray-200 transition-colors select-none whitespace-nowrap"
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
              className="px-3 py-3 text-right text-sm font-semibold text-gray-400 cursor-pointer hover:text-gray-200 transition-colors select-none whitespace-nowrap"
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
            sortedCoins.map((coin, index) => (
              <CoinTableRow
                key={coin.id}
                coin={coin}
                index={index}
                onClick={onCoinClick}
              />
            ))
          )}
        </tbody>
      </table>

      {sortedCoins.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No coins found for this pair
        </div>
      )}
    </div>
  )
}
