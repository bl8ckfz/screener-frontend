/**
 * PairSelector - Now displays USDT-only info
 * Simplified component since we only support USDT pairs from Binance exchange info
 */
export function PairSelector() {
  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3 text-gray-400">
        Trading Pair
      </h3>

      {/* Display USDT badge */}
      <div className="flex items-center gap-2">
        <div className="px-4 py-2 rounded bg-accent/20 border border-accent/50">
          <span className="text-accent font-bold text-lg">USDT</span>
        </div>
        <div className="text-sm text-gray-400">
          <div className="font-medium">Tether (USDT)</div>
          <div className="text-xs">All pairs filtered from Binance</div>
        </div>
      </div>

      {/* Info text */}
      <p className="text-xs text-gray-500 mt-3 leading-relaxed">
        Showing all active USDT trading pairs from Binance spot market.
        Pairs are dynamically loaded from exchange info.
      </p>
    </div>
  )
}
