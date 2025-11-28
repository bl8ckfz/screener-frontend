import { useStore } from '@/hooks/useStore'
import type { CurrencyPair } from '@/types/coin'

const POPULAR_PAIRS: CurrencyPair[] = [
  'USDT',
  'USDC',
  'USD',
  'BTC',
  'ETH',
  'EUR',
  'GBP',
]

const ALL_PAIRS: CurrencyPair[] = [
  'USDT',
  'USDC',
  'USD',
  'BTC',
  'ETH',
  'BNB',
  'EUR',
  'GBP',
  'JPY',
  'AUD',
  'BRL',
  'RUB',
  'NGN',
  'ARS',
  'COP',
  'CZK',
  'MXN',
  'PLN',
  'RON',
  'UAH',
  'ZAR',
  'IDR',
  'BUSD',
  'TUSD',
  'FDUSD',
  'PAX',
  'DAI',
  'BIDR',
  'EURI',
  'USDP',
  'BKRW',
]

export function PairSelector() {
  const { currentPair, setCurrentPair } = useStore()

  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3 text-gray-400">
        Currency Pair
      </h3>

      {/* Popular Pairs - Quick Access */}
      <div className="flex flex-wrap gap-2 mb-3">
        {POPULAR_PAIRS.map((pair) => (
          <button
            key={pair}
            onClick={() => setCurrentPair(pair)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              currentPair === pair
                ? 'bg-accent text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {pair}
          </button>
        ))}
      </div>

      {/* Dropdown for All Pairs */}
      <select
        value={currentPair}
        onChange={(e) => setCurrentPair(e.target.value as CurrencyPair)}
        className="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-700 focus:border-accent focus:outline-none text-sm"
      >
        {ALL_PAIRS.map((pair) => (
          <option key={pair} value={pair}>
            {pair}
          </option>
        ))}
      </select>
    </div>
  )
}
