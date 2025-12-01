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

  const getSortIndicator = (field: typeof sort.field) => {
    if (sort.field !== field) return ''
    return sort.direction === 'desc' ? ' ↓' : ' ↑'
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-900 sticky top-0">
          <tr>
            <th
              className="px-2 py-2 text-left cursor-pointer hover:bg-gray-800 whitespace-nowrap"
              onClick={() => handleSort('symbol')}
            >
              Symbol{getSortIndicator('symbol')}
            </th>
            <th
              className="px-2 py-2 text-right cursor-pointer hover:bg-gray-800 whitespace-nowrap"
              onClick={() => handleSort('lastPrice')}
            >
              Price{getSortIndicator('lastPrice')}
            </th>
            <th
              className="px-2 py-2 text-right cursor-pointer hover:bg-gray-800 whitespace-nowrap"
              onClick={() => handleSort('priceChangePercent')}
            >
              Change %{getSortIndicator('priceChangePercent')}
            </th>
            <th
              className="px-2 py-2 text-right cursor-pointer hover:bg-gray-800 whitespace-nowrap"
              onClick={() => handleSort('volume')}
            >
              Volume{getSortIndicator('volume')}
            </th>
            <th
              className="px-2 py-2 text-right cursor-pointer hover:bg-gray-800 whitespace-nowrap"
              onClick={() => handleSort('quoteVolume')}
            >
              Quote Vol{getSortIndicator('quoteVolume')}
            </th>
            <th
              className="px-2 py-2 text-right cursor-pointer hover:bg-gray-800 whitespace-nowrap"
              onClick={() => handleSort('vcp')}
            >
              VCP{getSortIndicator('vcp')}
            </th>
            <th
              className="px-2 py-2 text-right cursor-pointer hover:bg-gray-800 whitespace-nowrap min-w-[80px]"
              onClick={() => handleSort('priceToWeightedAvg')}
            >
              P/WA{getSortIndicator('priceToWeightedAvg')}
            </th>
            <th className="px-2 py-2 text-center whitespace-nowrap min-w-[100px]">
              ⭐ Watchlist
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
