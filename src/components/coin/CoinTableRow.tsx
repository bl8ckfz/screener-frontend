/**
 * CoinTableRow Component
 * 
 * Memoized table row for individual coin display in the table.
 * Prevents unnecessary re-renders when other rows update.
 */

import { memo } from 'react'
import type { Coin } from '@/types/coin'
import { formatPrice, formatPercent, formatVolume } from '@/utils/format'
import { WatchlistStar } from './WatchlistStar'
import { usePriceFlash } from '@/hooks'

interface CoinTableRowProps {
  coin: Coin
  index: number
  onClick?: (coin: Coin) => void
  /** The coin on the chart, so the row it came from stays findable. */
  selected?: boolean
}

const getChangeColor = (value: number) => {
  if (value > 0) return 'text-bullish'
  if (value < 0) return 'text-bearish'
  return 'text-neutral'
}

function CoinTableRowComponent({ coin, index, onClick, selected = false }: CoinTableRowProps) {
  const flash = usePriceFlash(coin.lastPrice)
  
  return (
    <tr
      onClick={() => onClick?.(coin)}
      aria-selected={selected}
      className={`border-b border-gray-800 cursor-pointer ${
        selected ? 'bg-accent-bg shadow-[inset_3px_0_0_0_#2B95FF]' : 'hover:bg-gray-900'
      } transition-all duration-150 hover:shadow-lg motion-reduce:transform-none hover:scale-[1.01] animate-in fade-in slide-in-from-left-2 ${flash}`}
      style={{ animationDelay: `${index * 20}ms` }}
    >
      <td className="px-3 py-2.5 w-16">
        <div className="flex items-center justify-center">
          <WatchlistStar symbol={coin.symbol} />
        </div>
      </td>
      <td className="px-4 py-2.5 font-medium whitespace-nowrap text-base w-28">{coin.symbol}</td>
      <td className="px-4 py-2.5 text-right mono-number whitespace-nowrap text-base w-36">
        {formatPrice(coin.lastPrice)}
      </td>
      <td
        className={`px-4 py-2.5 text-right mono-number font-medium whitespace-nowrap text-base w-32 ${getChangeColor(coin.priceChangePercent)}`}
      >
        {formatPercent(coin.priceChangePercent)}
      </td>
      <td className="px-4 py-2.5 text-right mono-number whitespace-nowrap text-base w-32">
        {coin.indicators.priceToWeightedAvg.toFixed(4)}
      </td>
      <td className="px-4 py-2.5 text-right mono-number text-gray-400 whitespace-nowrap text-base w-36">
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
    prevProps.index === nextProps.index &&
    // Without these the highlight never moved: selecting another coin
    // changes no coin data, so the memo kept the old row.
    prevProps.selected === nextProps.selected
  )
})

CoinTableRow.displayName = 'CoinTableRow'
