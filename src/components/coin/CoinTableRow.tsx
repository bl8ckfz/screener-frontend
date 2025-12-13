/**
 * CoinTableRow Component
 * 
 * Memoized table row for individual coin display in the table.
 * Prevents unnecessary re-renders when other rows update.
 */

import { memo } from 'react'
import type { Coin } from '@/types/coin'
import { formatPrice, formatPercent, formatVolume } from '@/utils/format'
import { WatchlistBadge } from '@/components/watchlist/WatchlistBadge'

interface CoinTableRowProps {
  coin: Coin
  index: number
  onClick?: (coin: Coin) => void
}

const getChangeColor = (value: number) => {
  if (value > 0) return 'text-bullish'
  if (value < 0) return 'text-bearish'
  return 'text-neutral'
}

function CoinTableRowComponent({ coin, index, onClick }: CoinTableRowProps) {
  return (
    <tr
      onClick={() => onClick?.(coin)}
      className="border-b border-gray-800 hover:bg-gray-900 cursor-pointer transition-all duration-150 hover:scale-[1.01] hover:shadow-lg animate-in fade-in slide-in-from-left-2"
      style={{ animationDelay: `${index * 20}ms` }}
    >
      <td className="px-3 py-2.5 font-medium whitespace-nowrap text-base">{coin.symbol}</td>
      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
        <WatchlistBadge symbol={coin.symbol} />
      </td>
      <td className="px-3 py-2.5 text-right mono-number whitespace-nowrap text-base">
        {formatPrice(coin.lastPrice)}
      </td>
      <td
        className={`px-3 py-2.5 text-right mono-number font-medium whitespace-nowrap text-base ${getChangeColor(coin.priceChangePercent)}`}
      >
        {formatPercent(coin.priceChangePercent)}
      </td>
      <td className="px-3 py-2.5 text-right mono-number whitespace-nowrap text-base">
        {coin.indicators.priceToWeightedAvg.toFixed(4)}
      </td>
      <td className="px-3 py-2.5 text-right mono-number text-gray-400 whitespace-nowrap text-base">
        {formatVolume(coin.quoteVolume)}
      </td>
    </tr>
  )
}

/**
 * Memoized coin table row
 * Only re-renders when coin data or index changes
 */
export const CoinTableRow = memo(CoinTableRowComponent, (prevProps, nextProps) => {
  // Custom comparison - only re-render if coin data actually changed
  return (
    prevProps.coin.id === nextProps.coin.id &&
    prevProps.coin.lastPrice === nextProps.coin.lastPrice &&
    prevProps.coin.priceChangePercent === nextProps.coin.priceChangePercent &&
    prevProps.coin.quoteVolume === nextProps.coin.quoteVolume &&
    prevProps.coin.indicators.priceToWeightedAvg === nextProps.coin.indicators.priceToWeightedAvg &&
    prevProps.index === nextProps.index
  )
})

CoinTableRow.displayName = 'CoinTableRow'
