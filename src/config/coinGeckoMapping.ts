/**
 * Mapping from Binance futures symbol to CoinGecko coin ID
 * 
 * This mapping is required because:
 * - Binance uses symbols like 'BTCUSDT', 'ETHUSDT'
 * - CoinGecko uses IDs like 'bitcoin', 'ethereum'
 * 
 * Update this mapping as new coins are listed or symbols change.
 * Source: https://api.coingecko.com/api/v3/coins/list
 */

export const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  // Major cryptocurrencies
  BTC: 'bitcoin',
  ETH: 'ethereum',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  SOL: 'solana',
  TRX: 'tron',
  DOT: 'polkadot',
  MATIC: 'matic-network',
  
  // DeFi tokens
  UNI: 'uniswap',
  LINK: 'chainlink',
  AAVE: 'aave',
  MKR: 'maker',
  COMP: 'compound-governance-token',
  SUSHI: 'sushi',
  CRV: 'curve-dao-token',
  SNX: 'havven',
  YFI: 'yearn-finance',
  
  // Layer 1 & Layer 2
  AVAX: 'avalanche-2',
  ATOM: 'cosmos',
  NEAR: 'near',
  FTM: 'fantom',
  ALGO: 'algorand',
  VET: 'vechain',
  ICP: 'internet-computer',
  FIL: 'filecoin',
  XLM: 'stellar',
  EOS: 'eos',
  
  // Meme coins
  SHIB: 'shiba-inu',
  PEPE: 'pepe',
  FLOKI: 'floki',
  BONK: 'bonk',
  
  // Exchange tokens
  CRO: 'crypto-com-chain',
  FTT: 'ftx-token',
  OKB: 'okb',
  LEO: 'leo-token',
  HT: 'huobi-token',
  
  // Stablecoins (for reference, usually not needed for market cap)
  USDT: 'tether',
  USDC: 'usd-coin',
  BUSD: 'binance-usd',
  DAI: 'dai',
  TUSD: 'true-usd',
  
  // Popular altcoins
  LTC: 'litecoin',
  BCH: 'bitcoin-cash',
  ETC: 'ethereum-classic',
  XMR: 'monero',
  DASH: 'dash',
  ZEC: 'zcash',
  
  // New generation
  APT: 'aptos',
  ARB: 'arbitrum',
  OP: 'optimism',
  SUI: 'sui',
  SEI: 'sei-network',
  INJ: 'injective-protocol',
  TIA: 'celestia',
  
  // Gaming & Metaverse
  SAND: 'the-sandbox',
  MANA: 'decentraland',
  AXS: 'axie-infinity',
  GALA: 'gala',
  IMX: 'immutable-x',
  
  // Oracle & Data
  GRT: 'the-graph',
  BAND: 'band-protocol',
  
  // Infrastructure
  CHZ: 'chiliz',
  ENJ: 'enjincoin',
  BAT: 'basic-attention-token',
  ZRX: '0x',
  
  // Additional popular tokens
  XTZ: 'tezos',
  THETA: 'theta-token',
  HBAR: 'hedera-hashgraph',
  EGLD: 'elrond-erd-2',
  KAVA: 'kava',
  RUNE: 'thorchain',
  LUNA: 'terra-luna-2',
  LUNC: 'terra-luna',
  ONE: 'harmony',
  FLOW: 'flow',
  ROSE: 'oasis-network',
  
  // AI & Data coins
  FET: 'fetch-ai',
  AGIX: 'singularitynet',
  OCEAN: 'ocean-protocol',
  RNDR: 'render-token',
  
  // Privacy coins
  SCRT: 'secret',
  
  // Additional Layer 1s
  TON: 'the-open-network',
  LDO: 'lido-dao',
  BLUR: 'blur',
  
  // Other notable tokens
  GMT: 'stepn',
  APE: 'apecoin',
  STX: 'blockstack',
  KLAY: 'klay-token',
  CELO: 'celo',
  QNT: 'quant-network',
  MINA: 'mina-protocol',
}

/**
 * Get CoinGecko ID for a Binance symbol
 * 
 * @param symbol - Full Binance symbol (e.g., 'BTCUSDT')
 * @returns CoinGecko ID or null if not found
 * 
 * @example
 * getCoinGeckoId('BTCUSDT') // 'bitcoin'
 * getCoinGeckoId('ETHUSDT') // 'ethereum'
 */
export function getCoinGeckoId(symbol: string): string | null {
  // Remove USDT suffix to get base symbol
  const baseSymbol = symbol.replace(/USDT$/, '')
  return SYMBOL_TO_COINGECKO_ID[baseSymbol] || null
}

/**
 * Check if a symbol has a CoinGecko mapping
 * 
 * @param symbol - Full Binance symbol (e.g., 'BTCUSDT')
 * @returns true if mapping exists
 */
export function hasCoinGeckoMapping(symbol: string): boolean {
  const baseSymbol = symbol.replace(/USDT$/, '')
  return baseSymbol in SYMBOL_TO_COINGECKO_ID
}

/**
 * Get all supported symbols
 * 
 * @returns Array of base symbols with CoinGecko mappings
 */
export function getSupportedSymbols(): string[] {
  return Object.keys(SYMBOL_TO_COINGECKO_ID)
}
