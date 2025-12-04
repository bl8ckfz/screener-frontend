# Binance Futures API Service Implementation Plan

## Overview
Implement a service to retrieve price-change and volume metrics for USDT-M futures symbols from Binance FAPI, with market cap filtering from CoinGecko.

### Supported Intervals
**5 timeframes:** 5m, 15m, 1h, 8h, 1d

This provides data for multiple alert types:
- **60 Big Bull**: Uses 15m, 1h, 8h, 1d for sustained momentum detection
- **Bottom Hunter**: Uses 5m, 15m, 1h for reversal detection with volume acceleration

---

## Architecture Components

### 1. New API Clients

#### 1.1 Binance Futures API Client (`src/services/binanceFuturesApi.ts`)
```typescript
class BinanceFuturesApiClient {
  baseUrl: 'https://fapi.binance.com/fapi/v1'
  
  // Core methods:
  fetchKlines(symbol, interval, limit)
  fetchMultipleKlines(symbol, intervals)
  fetchAllFuturesSymbols() // Get USDT-M futures list
}
```

**Endpoints to use:**
- `GET /fapi/v1/klines` - Historical candlestick data
- `GET /fapi/v1/exchangeInfo` - Available futures symbols

#### 1.2 CoinGecko API Client (`src/services/coinGeckoApi.ts`)
```typescript
class CoinGeckoApiClient {
  baseUrl: 'https://api.coingecko.com/api/v3'
  
  // Core methods:
  fetchCoinData(coinId)
  fetchMarketCap(coinId)
  mapSymbolToCoinGeckoId(symbol) // BTC -> bitcoin
}
```

**Endpoints to use:**
- `GET /coins/{id}` - Detailed coin data including market cap
- `GET /coins/list` - Symbol to CoinGecko ID mapping

---

## 2. Type Definitions

### 2.1 Add to `src/types/api.ts`

```typescript
/**
 * Binance Futures Kline (Candlestick) Data
 * https://binance-docs.github.io/apidocs/futures/en/#kline-candlestick-data
 */
export interface BinanceFuturesKline {
  openTime: number        // [0] Kline open time
  open: string           // [1] Open price
  high: string           // [2] High price
  low: string            // [3] Low price
  close: string          // [4] Close price
  volume: string         // [5] Volume (base asset)
  closeTime: number      // [6] Kline close time
  quoteVolume: string    // [7] Quote asset volume (USDT volume)
  trades: number         // [8] Number of trades
  takerBuyBaseVolume: string   // [9] Taker buy base asset volume
  takerBuyQuoteVolume: string  // [10] Taker buy quote asset volume
  ignore: string         // [11] Unused field
}

/**
 * Processed kline data with previous and current candles
 */
export interface ProcessedKlineData {
  interval: '5m' | '15m' | '1h' | '8h' | '1d'
  previous: {
    open: number
    high: number
    low: number
    close: number
    volume: number
    quoteVolume: number
    openTime: number
    closeTime: number
  }
  current: {
    open: number
    high: number
    low: number
    close: number
    volume: number
    quoteVolume: number
    openTime: number
    closeTime: number
  }
}

/**
 * CoinGecko coin data response
 */
export interface CoinGeckoMarketData {
  id: string
  symbol: string
  name: string
  market_data: {
    market_cap: {
      usd: number
    }
    current_price: {
      usd: number
    }
    total_volume: {
      usd: number
    }
    circulating_supply: number
  }
}

/**
 * Futures metrics with all calculated values
 */
export interface FuturesMetrics {
  symbol: string
  timestamp: number
  
  // Price changes (%)
  change_5m: number
  change_15m: number
  change_1h: number
  change_8h: number
  change_1d: number
  
  // Volumes (quote asset - USDT)
  volume_5m: number
  volume_15m: number
  volume_1h: number
  volume_8h: number
  
  // Market cap from CoinGecko
  marketCap: number | null
  coinGeckoId: string | null
  
  // Filter results
  passes_filters: boolean
  filter_details: {
    price_checks: {
      change_15m_gt_1: boolean       // change_15m > 1
      change_1d_lt_15: boolean       // change_1d < 15
      change_1h_gt_change_15m: boolean // change_1h > change_15m
      change_8h_gt_change_1h: boolean  // change_8h > change_1h
    }
    volume_checks: {
      volume_15m_gt_400k: boolean          // volume_15m > 400000
      volume_1h_gt_1m: boolean             // volume_1h > 1000000
      three_vol15m_gt_vol1h: boolean       // 3 * volume_15m > volume_1h
      twentysix_vol15m_gt_vol8h: boolean   // 26 * volume_15m > volume_8h
    }
    marketcap_checks: {
      marketcap_gt_23m: boolean        // marketcap > 23000000
      marketcap_lt_2500m: boolean      // marketcap < 2500000000
    }
  }
}
```

---

## 3. Core Service Implementation

### 3.1 Main Service (`src/services/futuresMetricsService.ts`)

```typescript
export class FuturesMetricsService {
  private futuresClient: BinanceFuturesApiClient
  private coinGeckoClient: CoinGeckoApiClient
  private symbolToCoinGeckoMap: Map<string, string>
  
  constructor() {
    this.futuresClient = new BinanceFuturesApiClient()
    this.coinGeckoClient = new CoinGeckoApiClient()
    this.symbolToCoinGeckoMap = new Map()
  }
  
  /**
   * Fetch metrics for a single symbol
   */
  async fetchSymbolMetrics(symbol: string): Promise<FuturesMetrics>
  
  /**
   * Fetch metrics for multiple symbols in parallel
   */
  async fetchMultipleSymbolMetrics(symbols: string[]): Promise<FuturesMetrics[]>
  
  /**
   * Scan all USDT-M futures and return those passing filters
   */
  async scanAllFutures(): Promise<FuturesMetrics[]>
  
  // Private helper methods:
  private async fetchKlineData(symbol: string): Promise<Map<string, ProcessedKlineData>>
  private calculatePriceChanges(klineData: Map<string, ProcessedKlineData>): object
  private extractVolumes(klineData: Map<string, ProcessedKlineData>): object
  private async fetchMarketCap(symbol: string): Promise<number | null>
  private evaluateFilters(metrics: Partial<FuturesMetrics>): boolean
}
```

**Implementation flow:**
1. Fetch klines for all 4 intervals (15m, 1h, 8h, 1d) in parallel
2. Parse and process kline data
3. Calculate price changes for each timeframe
4. Extract quote volumes for each timeframe
5. Fetch market cap from CoinGecko (cached)
6. Apply all filter rules
7. Return structured metrics object

---

## 4. Data Fetching Strategy

### 4.1 Kline Fetching (Parallel)

```typescript
async function fetchAllKlines(symbol: string) {
  const intervals = ['5m', '15m', '1h', '8h', '1d']
  
  const promises = intervals.map(interval => 
    this.futuresClient.fetchKlines(symbol, interval, 2)
  )
  
  const results = await Promise.all(promises)
  
  return new Map(intervals.map((interval, i) => 
    [interval, this.processKlineResponse(results[i])]
  ))
}
```

**Kline processing:**
```typescript
function processKlineResponse(klines: BinanceFuturesKline[]): ProcessedKlineData {
  const [prev, curr] = klines
  
  return {
    previous: {
      close: parseFloat(prev[4]),
      quoteVolume: parseFloat(prev[7]),
      // ... other fields
    },
    current: {
      close: parseFloat(curr[4]),
      quoteVolume: parseFloat(curr[7]),
      // ... other fields
    }
  }
}
```

### 4.2 Price Change Calculation

```typescript
function calculatePriceChange(prevClose: number, currClose: number): number {
  return ((currClose / prevClose) - 1) * 100
}
```

### 4.3 Market Cap Fetching (with caching)

```typescript
class CoinGeckoCache {
  private cache: Map<string, { marketCap: number, timestamp: number }>
  private CACHE_TTL = 3600000 // 1 hour
  
  async getMarketCap(coinId: string): Promise<number | null> {
    const cached = this.cache.get(coinId)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.marketCap
    }
    
    const data = await this.coinGeckoClient.fetchCoinData(coinId)
    const marketCap = data.market_data.market_cap.usd
    
    this.cache.set(coinId, { marketCap, timestamp: Date.now() })
    return marketCap
  }
}
```

---

## 5. Symbol to CoinGecko ID Mapping

### 5.1 Mapping Strategy

Create a static mapping file with common symbols:

```typescript
// src/config/coinGeckoMapping.ts
export const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'BNB': 'binancecoin',
  'SOL': 'solana',
  'XRP': 'ripple',
  'ADA': 'cardano',
  'AVAX': 'avalanche-2',
  'DOGE': 'dogecoin',
  'DOT': 'polkadot',
  'MATIC': 'matic-network',
  // ... add more as needed
}
```

**Fallback strategy:**
1. Check static mapping
2. Try CoinGecko search API
3. Return null if not found (exclude from market cap filter)

---

## 6. Filter Evaluation Logic

```typescript
function evaluateFilters(metrics: Partial<FuturesMetrics>): FilterResults {
  // Price checks
  const priceChecks = {
    change_15m_gt_1: metrics.change_15m > 1,
    change_1d_lt_15: metrics.change_1d < 15,
    change_1h_gt_change_15m: metrics.change_1h > metrics.change_15m,
    change_8h_gt_change_1h: metrics.change_8h > metrics.change_1h,
  }
  
  // Volume checks
  const volumeChecks = {
    volume_15m_gt_400k: metrics.volume_15m > 400000,
    volume_1h_gt_1m: metrics.volume_1h > 1000000,
    three_vol15m_gt_vol1h: 3 * metrics.volume_15m > metrics.volume_1h,
    twentysix_vol15m_gt_vol8h: 26 * metrics.volume_15m > metrics.volume_8h,
  }
  
  // Market cap checks (skip if null)
  const marketcapChecks = metrics.marketCap ? {
    marketcap_gt_23m: metrics.marketCap > 23000000,
    marketcap_lt_2500m: metrics.marketCap < 2500000000,
  } : {
    marketcap_gt_23m: true, // Pass if no market cap data
    marketcap_lt_2500m: true,
  }
  
  // All checks must pass
  const allPriceChecks = Object.values(priceChecks).every(v => v)
  const allVolumeChecks = Object.values(volumeChecks).every(v => v)
  const allMarketCapChecks = Object.values(marketcapChecks).every(v => v)
  
  return {
    passes_filters: allPriceChecks && allVolumeChecks && allMarketCapChecks,
    price_checks: priceChecks,
    volume_checks: volumeChecks,
    marketcap_checks: marketcapChecks,
  }
}
```

---

## 7. Error Handling & Rate Limiting

### 7.1 Binance FAPI Rate Limits
- **Weight limit**: 2400 per minute
- **Kline endpoint weight**: 1-5 depending on limit
- Strategy: Use exponential backoff on 429 errors

### 7.2 CoinGecko Rate Limits
- **Free tier**: 10-50 calls/minute
- Strategy: Aggressive caching (1 hour TTL), batch requests

### 7.3 Error Handling
```typescript
class FuturesMetricsError extends Error {
  constructor(
    message: string,
    public code: 'BINANCE_ERROR' | 'COINGECKO_ERROR' | 'NETWORK_ERROR',
    public details?: unknown
  ) {
    super(message)
  }
}
```

---

## 8. Integration with Existing Alert System

### 8.1 New Alert Type

Add to `src/types/alert.ts`:
```typescript
export type AlertType =
  | ... // existing types
  | 'futures_big_bull_60' // Futures-based 60 Big Bull
```

### 8.2 Alert Evaluator

Add to `src/services/alertEngine.ts`:
```typescript
async function evaluateFuturesBigBull60(symbol: string): Promise<boolean> {
  const metrics = await futuresMetricsService.fetchSymbolMetrics(symbol + 'USDT')
  return metrics.passes_filters
}
```

---

## 9. Testing Strategy

### 9.1 Unit Tests
- Test kline parsing
- Test price change calculations
- Test volume extraction
- Test filter evaluation logic

### 9.2 Integration Tests
- Mock Binance FAPI responses
- Mock CoinGecko responses
- Test full metrics flow

### 9.3 Manual Testing
```bash
# Test single symbol
curl "http://localhost:3000/api/futures-metrics?symbol=BTCUSDT"

# Test scanner
curl "http://localhost:3000/api/futures-scan"
```

---

## 10. Configuration

### 10.1 Environment Variables

Add to `.env`:
```bash
# Binance Futures API
VITE_BINANCE_FUTURES_API_URL=https://fapi.binance.com/fapi/v1

# CoinGecko API
VITE_COINGECKO_API_URL=https://api.coingecko.com/api/v3
VITE_COINGECKO_API_KEY= # Optional, for pro plan

# Feature flags
VITE_ENABLE_FUTURES_ALERTS=true
VITE_FUTURES_SCAN_INTERVAL=300000 # 5 minutes
```

### 10.2 API Config

Update `src/config/api.ts`:
```typescript
export const BINANCE_FUTURES_CONFIG = {
  baseUrl: import.meta.env.VITE_BINANCE_FUTURES_API_URL,
  timeout: 10000,
  retries: 3,
}

export const COINGECKO_CONFIG = {
  baseUrl: import.meta.env.VITE_COINGECKO_API_URL,
  apiKey: import.meta.env.VITE_COINGECKO_API_KEY,
  timeout: 5000,
  retries: 2,
  cacheTTL: 3600000, // 1 hour
}
```

---

## 11. Implementation Phases

### Phase 1: Core API Clients (Week 1)
- ✅ Create `BinanceFuturesApiClient`
- ✅ Create `CoinGeckoApiClient`
- ✅ Add type definitions
- ✅ Implement kline fetching
- ✅ Unit tests for API clients

### Phase 2: Metrics Service (Week 1-2)
- ✅ Create `FuturesMetricsService`
- ✅ Implement price change calculations
- ✅ Implement volume extraction
- ✅ Integrate CoinGecko market cap
- ✅ Implement filter evaluation
- ✅ Unit tests for calculations

### Phase 3: Caching & Optimization (Week 2)
- ✅ Implement CoinGecko cache
- ✅ Implement parallel kline fetching
- ✅ Add retry logic with exponential backoff
- ✅ Rate limit handling

### Phase 4: Alert Integration (Week 2-3)
- ✅ Add futures alert type
- ✅ Integrate with alert engine
- ✅ Add UI for futures alerts
- ✅ Testing with real data

### Phase 5: Scanner & Monitoring (Week 3)
- ✅ Implement futures scanner
- ✅ Add background scanning job
- ✅ Add metrics dashboard
- ✅ Performance monitoring

---

## 12. File Structure

```
src/
├── config/
│   ├── api.ts                    # Update with futures & CoinGecko config
│   └── coinGeckoMapping.ts       # New: Symbol to CoinGecko ID mapping
├── services/
│   ├── binanceFuturesApi.ts      # New: Binance Futures API client
│   ├── coinGeckoApi.ts           # New: CoinGecko API client
│   ├── futuresMetricsService.ts  # New: Main metrics service
│   └── alertEngine.ts            # Update: Add futures alert evaluator
├── types/
│   ├── api.ts                    # Update: Add futures types
│   └── alert.ts                  # Update: Add futures alert type
└── utils/
    └── futuresCalculations.ts    # New: Pure calculation functions
```

---

## 13. Performance Considerations

### 13.1 Parallel Processing
- Fetch all 5 kline intervals in parallel (5 concurrent requests)
- Batch symbol processing with Promise.all
- Target: <500ms per symbol

### 13.2 Caching Strategy
- CoinGecko market cap: 1 hour cache
- Futures symbols list: 1 hour cache
- Kline data: No cache (real-time)

### 13.3 Rate Limiting
- Binance: Max 50 symbols/minute (conservative)
- CoinGecko: Max 30 calls/minute
- Implement queue system for bulk operations

---

## 14. Monitoring & Logging

```typescript
class MetricsLogger {
  logKlineFetch(symbol: string, duration: number)
  logMarketCapFetch(coinId: string, duration: number, cached: boolean)
  logFilterEvaluation(symbol: string, passed: boolean, details: object)
  logError(error: FuturesMetricsError)
  
  // Metrics aggregation
  getAverageResponseTime(): number
  getCacheHitRate(): number
  getErrorRate(): number
}
```

---

## 15. Security Considerations

1. **API Keys**: Store CoinGecko API key securely in environment variables
2. **Rate Limiting**: Implement client-side rate limiting to avoid IP bans
3. **CORS**: Binance Futures API has CORS restrictions - need proxy for browser
4. **Data Validation**: Validate all API responses before processing

---

## Next Steps

1. Review and approve this plan
2. Set up environment variables
3. Begin Phase 1 implementation
4. Create mock data for testing
5. Implement monitoring from day 1
