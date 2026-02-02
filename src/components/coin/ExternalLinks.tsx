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
      name: 'Binance',
      url: binanceUrl,
      description: 'Trade on Binance',
      icon: '🔸', // Binance logo color
    },
    {
      name: 'CoinGlass',
      url: coinglassUrl,
      description: 'Liquidation heatmap and data',
      icon: '🔷', // Glass/crystal
    },
    {
      name: 'Aggr.trade',
      url: aggTradeUrl,
      description: 'Real-time order flow',
      icon: '📊',
    },
    {
      name: 'TradingView',
      url: tradingViewUrl,
      description: 'Advanced charting',
      icon: '📈',
    },
  ]

  const handleLinkClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-safe">
      {links.map((link) => (
        <button
          key={link.name}
          onClick={() => handleLinkClick(link.url)}
          className="flex items-center gap-1 bg-gray-700/50 hover:bg-gray-600 rounded-lg px-2 py-1.5 md:px-3 md:py-2 transition-colors group flex-shrink-0"
          title={link.description}
        >
          <span className="text-sm md:text-base">{link.icon}</span>
          <span className="text-[10px] md:text-xs text-white group-hover:text-blue-400 transition-colors whitespace-nowrap">
            {link.name}
          </span>
          <svg
            className="w-2.5 h-2.5 md:w-3 md:h-3 text-gray-400 group-hover:text-blue-400 transition-colors"
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
  )
}
