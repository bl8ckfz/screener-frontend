import { useMemo } from 'react'
import type { Coin, CoinSort } from '@/types/coin'
import { useStore } from '@/hooks/useStore'
import { usePriceFlash } from '@/hooks'
import { sortCoins } from '@/utils/sort'
import { TableRowSkeleton } from '@/components/ui'
import { CoinTableRow } from './CoinTableRow'
import { WatchlistStar } from './WatchlistStar'
import { FEATURE_FLAGS } from '@/config'
import { formatPercent, formatPrice, formatVolume } from '@/utils/format'

interface CoinTableProps {
  coins: Coin[]
  onCoinClick?: (coin: Coin) => void
  isLoading?: boolean
  /** Symbol of the coin on the chart, highlighted in the list. */
  selectedSymbol?: string
}
 
interface CoinCardProps {
  coin: Coin
  onClick?: (coin: Coin) => void
  selected?: boolean
}

const CoinCard = ({ coin, onClick, selected = false }: CoinCardProps) => {
  const changeColor = coin.priceChangePercent > 0 ? 'text-green-400' : coin.priceChangePercent < 0 ? 'text-red-400' : 'text-gray-300'
  const flash = usePriceFlash(coin.lastPrice)

  return (
    <button
      onClick={() => onClick?.(coin)}
      className={`w-full rounded-lg border ${selected ? 'border-accent' : 'border-gray-700'} bg-gray-800 px-4 py-3 text-left shadow-sm transition hover:border-accent/60 hover:shadow-lg ${flash}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <WatchlistStar symbol={coin.symbol} />
          <div>
            <div className="font-mono text-sm font-semibold text-white">{coin.symbol}</div>
            <div className="text-xs text-gray-400">P/WA {coin.indicators.priceToWeightedAvg.toFixed(4)}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm text-gray-100">{formatPrice(coin.lastPrice)}</div>
          <div className={`font-mono text-xs font-semibold ${changeColor}`}>{formatPercent(coin.priceChangePercent)}</div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
        <span>Vol {formatVolume(coin.quoteVolume)}</span>
        <span className="text-gray-400">Tap for chart</span>
      </div>
    </button>
  )
}

/**
 * Sort choices for the card layout. The table sorts by clicking its headers,
 * and the cards have none — so phones used to get whatever order was last
 * chosen on a desktop, with no way to change it.
 */
const CARD_SORTS: Array<{ id: string; label: string; sort: CoinSort }> = [
  { id: 'volume', label: 'Highest volume', sort: { field: 'quoteVolume', direction: 'desc' } },
  { id: 'gainers', label: 'Top gainers', sort: { field: 'priceChangePercent', direction: 'desc' } },
  { id: 'losers', label: 'Top losers', sort: { field: 'priceChangePercent', direction: 'asc' } },
  { id: 'pwa', label: 'Highest P/WA', sort: { field: 'priceToWeightedAvg', direction: 'desc' } },
  { id: 'symbol', label: 'Symbol A–Z', sort: { field: 'symbol', direction: 'asc' } },
]

const CardSkeleton = () => (
  <div className="h-20 w-full animate-pulse rounded-lg border border-gray-800 bg-gray-900" />
)

export function CoinTable({ coins, onCoinClick, isLoading = false, selectedSymbol }: CoinTableProps) {
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

  const showCards = FEATURE_FLAGS.mobileCardView

  const tableContent = (
    <div className={showCards ? 'hidden overflow-x-auto md:block' : 'overflow-x-auto'}>
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
            Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} />)
          ) : (
            <>
              {watchlistCoins.map((coin, index) => (
                <CoinTableRow
                  key={coin.id}
                  coin={coin}
                  index={index}
                  onClick={onCoinClick}
                  selected={coin.symbol === selectedSymbol}
                />
              ))}

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

              {otherCoins.map((coin, index) => (
                <CoinTableRow
                  key={coin.id}
                  coin={coin}
                  index={watchlistCoins.length + index}
                  onClick={onCoinClick}
                  selected={coin.symbol === selectedSymbol}
                />
              ))}
            </>
          )}
        </tbody>
      </table>

      {watchlistCoins.length === 0 && otherCoins.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          No coins found for this pair
        </div>
      )}
    </div>
  )

  const cardSortId =
    CARD_SORTS.find((o) => o.sort.field === sort.field && o.sort.direction === sort.direction)?.id ?? ''

  const cardContent = showCards ? (
    <div className="space-y-2 md:hidden">
      <div className="flex items-center justify-end gap-2 px-1 pt-1">
        <label htmlFor="coin-card-sort" className="text-xs text-gray-400">Sort</label>
        <select
          id="coin-card-sort"
          value={cardSortId}
          onChange={(e) => {
            const opt = CARD_SORTS.find((o) => o.id === e.target.value)
            if (opt) setSort(opt.sort)
          }}
          className="h-9 rounded border border-gray-600 bg-gray-800 px-2 text-sm text-gray-200"
        >
          {!cardSortId && <option value="">Custom</option>}
          {CARD_SORTS.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </div>
      {isLoading ? (
        Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
      ) : (
        <>
          {watchlistCoins.map((coin) => (
            <CoinCard key={coin.id} coin={coin} onClick={onCoinClick} selected={coin.symbol === selectedSymbol} />
          ))}

          {watchlistCoins.length > 0 && otherCoins.length > 0 && (
            <div className="flex items-center gap-2 px-1 py-1 text-xs text-accent/70">
              <span className="h-px flex-1 bg-accent/30" />
              <span>Other Coins</span>
              <span className="h-px flex-1 bg-accent/30" />
            </div>
          )}

          {otherCoins.map((coin) => (
            <CoinCard key={coin.id} coin={coin} onClick={onCoinClick} selected={coin.symbol === selectedSymbol} />
          ))}

          {watchlistCoins.length === 0 && otherCoins.length === 0 && (
            <div className="py-10 text-center text-gray-400">No coins found for this pair</div>
          )}
        </>
      )}
    </div>
  ) : null

  return (
    <>
      {cardContent}
      {tableContent}
    </>
  )
}
