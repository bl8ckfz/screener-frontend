/**
 * CoinTableRow Component
 * 
 * Memoized table row for individual coin display in the table.
 * Prevents unnecessary re-renders when other rows update.
 */

import { memo } from 'react'
import type { Coin } from '@/types/coin'
import { formatPrice, formatPercent, formatVolume } from '@/utils/format'
// Watchlist stars removed from table per new plan

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
      <td className="px-2 py-2 font-medium whitespace-nowrap">{coin.symbol}</td>
      <td className="px-2 py-2 text-right mono-number whitespace-nowrap">
        {formatPrice(coin.lastPrice)}
      </td>
      <td
        className={`px-2 py-2 text-right mono-number font-medium whitespace-nowrap ${getChangeColor(coin.priceChangePercent)}`}
      >
        {formatPercent(coin.priceChangePercent)}
      </td>
      <td className="px-1.5 py-1.5 text-right mono-number text-gray-400 whitespace-nowrap">
        {formatVolume(coin.volume)}
      </td>
      <td className="px-1.5 py-1.5 text-right mono-number text-gray-400 whitespace-nowrap">
        {formatVolume(coin.quoteVolume)}
      </td>
      <td
        className={`px-1.5 py-1.5 text-right mono-number whitespace-nowrap ${getChangeColor(coin.indicators.vcp)}`}
      >
        {coin.indicators.vcp.toFixed(3)}
      </td>
      <td className="px-1.5 py-1.5 text-right mono-number whitespace-nowrap min-w-[72px]">
        {coin.indicators.priceToWeightedAvg.toFixed(3)}
      </td>
      {/* Watchlist badge column removed */}
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
    prevProps.coin.volume === nextProps.coin.volume &&
    prevProps.coin.quoteVolume === nextProps.coin.quoteVolume &&
    prevProps.coin.indicators.vcp === nextProps.coin.indicators.vcp &&
    prevProps.coin.indicators.priceToWeightedAvg === nextProps.coin.indicators.priceToWeightedAvg &&
    prevProps.index === nextProps.index
  )
})

CoinTableRow.displayName = 'CoinTableRow'
