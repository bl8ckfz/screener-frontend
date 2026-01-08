import type { Coin } from '@/types/coin'

export interface ExternalLinksProps {
  coin: Coin
}

/**
 * ExternalLinks component provides links to external trading/analysis tools
 */
export function ExternalLinks({ coin }: ExternalLinksProps) {
  const { fullSymbol } = coin

  // External service URLs
  const coinglassUrl = `https://coinglass.com/tv/Binance_${fullSymbol}`
  const aggTradeUrl = `https://aggr.trade/#?q=binance:${fullSymbol.toLowerCase()}`
  const binanceUrl = `https://www.binance.com/en/trade/${fullSymbol}`
  const tradingViewUrl = `https://www.tradingview.com/chart/?symbol=BINANCE:${fullSymbol}`

  const links = [
    {
      name: 'CoinGlass',
      url: coinglassUrl,
      description: 'Liquidation heatmap and data',
      icon: '📊',
    },
    {
      name: 'Aggr.trade',
      url: aggTradeUrl,
      description: 'Real-time order flow',
      icon: '📈',
    },
    {
      name: 'Binance',
      url: binanceUrl,
      description: 'Trade on Binance',
      icon: '💱',
    },
    {
      name: 'TradingView',
      url: tradingViewUrl,
      description: 'Advanced charting',
      icon: '📉',
    },
  ]

  const handleLinkClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        External Tools
      </h3>
      <div className="flex items-center gap-2 flex-wrap">
        {links.map((link) => (
          <button
            key={link.name}
            onClick={() => handleLinkClick(link.url)}
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg px-3 py-2 transition-colors group"
            title={link.description}
          >
            <span className="text-base">{link.icon}</span>
            <span className="text-xs text-white group-hover:text-blue-400 transition-colors">
              {link.name}
            </span>
            <svg
              className="w-3 h-3 text-gray-400 group-hover:text-blue-400 transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}
