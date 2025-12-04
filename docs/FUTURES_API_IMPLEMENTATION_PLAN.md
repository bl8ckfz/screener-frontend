# Binance Futures API Service Implementation Plan

## Overview
Implement a service to retrieve price-change and volume metrics for USDT-M futures symbols from Binance FAPI, with market cap filtering from CoinGecko.

### Supported Intervals
**5 timeframes:** 5m, 15m, 1h, 8h, 1d

This provides data for multiple alert types:
- **60 Big Bull**: Uses 1h, 8h, 1d for sustained momentum detection (includes 1d volume)
- **Pioneer Bull**: Uses 5m, 15m for early trend detection
- **5 Big Bull**: Uses 5m, 15m, 1h, 8h, 1d for explosive moves
- **15 Big Bull**: Uses 15m, 1h, 8h, 1d for strong trending moves
- **Bottom Hunter**: Uses 5m, 15m, 1h for reversal detection

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
  volume_1d: number
  
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
1. Fetch klines for all 5 intervals (5m, 15m, 1h, 8h, 1d) in parallel
2. Parse and process kline data
3. Calculate price changes for each timeframe
4. Extract quote volumes for each timeframe (5m, 15m, 1h, 8h, 1d)
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

---

## 12. Alert Rules to Implement

### 12.1 60 Big Bull
**Type:** `futures_big_bull_60`  
**Purpose:** Detect coins with sustained momentum over multiple timeframes

**Criteria:**
1. `change_1h > 1.6%` - Significant 1-hour momentum
2. `change_1d < 15%` - Not overextended on daily
3. `change_8h > change_1h` - 8h trend stronger than 1h (progressive validation)
4. `change_1d > change_8h` - Daily trend continuing (progressive validation)
5. `volume_1h > 500,000` - Minimum 1h volume (absolute threshold)
6. `volume_8h > 5,000,000` - Minimum 8h volume (absolute threshold)
7. `volume_1h > volume_8h / 6` - 1h volume acceleration (6x ratio)
8. `volume_1h > volume_1d / 16` - 1h vs daily volume (16x ratio)
9. `marketCap > $23M` - Minimum liquidity
10. `marketCap < $2.5B` - Maximum cap (avoid mega-caps)

**Timeframes:** 1h, 8h, 1d  
**Volume Intervals:** 1h, 8h, 1d

---

### 12.2 60 Big Bear
**Type:** `futures_big_bear_60`  
**Purpose:** Detect coins with sustained downward momentum over multiple timeframes

**Criteria:**
1. `change_1h < -1.6%` - Significant 1-hour downward momentum
2. `change_1d > -15%` - Not overextended on daily (not in freefall)
3. `change_8h < change_1h` - 8h trend weaker than 1h (progressive validation)
4. `change_1d < change_8h` - Daily trend continuing downward (progressive validation)
5. `volume_1h > 500,000` - Minimum 1h volume (absolute threshold)
6. `volume_8h > 5,000,000` - Minimum 8h volume (absolute threshold)
7. `volume_1h > volume_8h / 6` - 1h volume acceleration (6x ratio)
8. `volume_1h > volume_1d / 16` - 1h vs daily volume (16x ratio)
9. `marketCap > $23M` - Minimum liquidity
10. `marketCap < $2.5B` - Maximum cap (avoid mega-caps)

**Timeframes:** 1h, 8h, 1d  
**Volume Intervals:** 1h, 8h, 1d

---

### 12.3 Pioneer Bull
**Type:** `futures_pioneer_bull`  
**Purpose:** Early detection of emerging trends with accelerating momentum

**Criteria:**
1. `change_5m > 1%` - Strong immediate momentum
2. `change_15m > 1%` - Confirming short-term trend
3. `3 * change_5m > change_15m` - 5m accelerating faster than 15m (momentum acceleration)
4. `2 * volume_5m > volume_15m` - Volume acceleration (2x ratio)
5. `marketCap > $23M` - Minimum liquidity
6. `marketCap < $2.5B` - Maximum cap (avoid mega-caps)

**Timeframes:** 5m, 15m  
**Volume Intervals:** 5m, 15m

---

### 12.4 Pioneer Bear
**Type:** `futures_pioneer_bear`  
**Purpose:** Early detection of emerging downtrends with accelerating downward momentum

**Criteria:**
1. `change_5m < -1%` - Strong immediate downward momentum
2. `change_15m < -1%` - Confirming short-term downtrend
3. `3 * change_5m < change_15m` - 5m declining faster than 15m (downward acceleration)
4. `2 * volume_5m > volume_15m` - Volume acceleration (2x ratio)
5. `marketCap > $23M` - Minimum liquidity
6. `marketCap < $2.5B` - Maximum cap (avoid mega-caps)

**Timeframes:** 5m, 15m  
**Volume Intervals:** 5m, 15m

---

### 12.5 5 Big Bull
**Type:** `futures_5_big_bull`  
**Purpose:** Catch explosive moves with progressive momentum acceleration

**Criteria:**
1. `change_5m > 0.6%` - Initial momentum
2. `change_1d < 15%` - Not overextended on daily
3. `change_15m > change_5m` - 15m stronger than 5m (progressive validation)
4. `change_1h > change_15m` - 1h stronger than 15m (progressive validation)
5. `volume_5m > 100,000` - Minimum 5m volume (absolute threshold)
6. `volume_1h > 1,000,000` - Minimum 1h volume (absolute threshold)
7. `volume_5m > volume_15m / 3` - 5m volume acceleration (3x ratio)
8. `volume_5m > volume_1h / 6` - 5m vs 1h volume (6x ratio)
9. `volume_5m > volume_8h / 66` - 5m vs 8h volume (66x ratio)
10. `marketCap > $23M` - Minimum liquidity
11. `marketCap < $2.5B` - Maximum cap (avoid mega-caps)

**Timeframes:** 5m, 15m, 1h, 1d (checks 8h volume only)  
**Volume Intervals:** 5m, 15m, 1h, 8h

---

### 12.6 5 Big Bear
**Type:** `futures_5_big_bear`  
**Purpose:** Catch explosive downward moves with progressive momentum acceleration

**Criteria:**
1. `change_5m < -0.6%` - Initial downward momentum
2. `change_1d > -15%` - Not overextended on daily (not in freefall)
3. `change_15m < change_5m` - 15m weaker than 5m (progressive downward validation)
4. `change_1h < change_15m` - 1h weaker than 15m (progressive downward validation)
5. `volume_5m > 100,000` - Minimum 5m volume (absolute threshold)
6. `volume_1h > 1,000,000` - Minimum 1h volume (absolute threshold)
7. `volume_5m > volume_15m / 3` - 5m volume acceleration (3x ratio)
8. `volume_5m > volume_1h / 6` - 5m vs 1h volume (6x ratio)
9. `volume_5m > volume_8h / 66` - 5m vs 8h volume (66x ratio)
10. `marketCap > $23M` - Minimum liquidity
11. `marketCap < $2.5B` - Maximum cap (avoid mega-caps)

**Timeframes:** 5m, 15m, 1h, 1d (checks 8h volume only)  
**Volume Intervals:** 5m, 15m, 1h, 8h

---

### 12.7 15 Big Bull
**Type:** `futures_15_big_bull`  
**Purpose:** Identify strong trending moves with progressive momentum acceleration

**Criteria:**
1. `change_15m > 1%` - Initial momentum
2. `change_1d < 15%` - Not overextended on daily
3. `change_1h > change_15m` - 1h stronger than 15m (progressive validation)
4. `change_8h > change_1h` - 8h stronger than 1h (progressive validation)
5. `volume_15m > 400,000` - Minimum 15m volume (absolute threshold)
6. `volume_1h > 1,000,000` - Minimum 1h volume (absolute threshold)
7. `volume_15m > volume_1h / 3` - 15m volume acceleration (3x ratio)
8. `volume_15m > volume_8h / 26` - 15m vs 8h volume (26x ratio)
9. `marketCap > $23M` - Minimum liquidity
10. `marketCap < $2.5B` - Maximum cap (avoid mega-caps)

**Timeframes:** 15m, 1h, 8h, 1d  
**Volume Intervals:** 15m, 1h, 8h

---

### 12.8 15 Big Bear
**Type:** `futures_15_big_bear`  
**Purpose:** Identify strong downward trending moves with progressive momentum acceleration

**Criteria:**
1. `change_15m < -1%` - Initial downward momentum
2. `change_1d > -15%` - Not overextended on daily (not in freefall)
3. `change_1h < change_15m` - 1h weaker than 15m (progressive downward validation)
4. `change_8h < change_1h` - 8h weaker than 1h (progressive downward validation)
5. `volume_15m > 400,000` - Minimum 15m volume (absolute threshold)
6. `volume_1h > 1,000,000` - Minimum 1h volume (absolute threshold)
7. `volume_15m > volume_1h / 3` - 15m volume acceleration (3x ratio)
8. `volume_15m > volume_8h / 26` - 15m vs 8h volume (26x ratio)
9. `marketCap > $23M` - Minimum liquidity
10. `marketCap < $2.5B` - Maximum cap (avoid mega-caps)

**Timeframes:** 15m, 1h, 8h, 1d  
**Volume Intervals:** 15m, 1h, 8h

---

### 12.9 Bottom Hunter
**Type:** `futures_bottom_hunter`  
**Purpose:** Detect reversal from bottom with volume confirmation

**Criteria:**
1. `change_1h < -0.7%` - Hourly in decline (establishing bottom)
2. `change_15m < -0.6%` - 15m also in decline (confirming bottom)
3. `change_5m > 0.5%` - BUT 5m showing recovery (reversal signal!)
4. `volume_5m > volume_15m / 2` - 5m volume acceleration (2x ratio)
5. `volume_5m > volume_1h / 8` - 5m vs 1h volume (8x ratio)
6. `marketCap > $23M` - Minimum liquidity
7. `marketCap < $2.5B` - Maximum cap (avoid mega-caps)

**Timeframes:** 5m, 15m, 1h  
**Volume Intervals:** 5m, 15m, 1h

---

### 12.10 Top Hunter
**Type:** `futures_top_hunter`  
**Purpose:** Detect reversal from top with volume confirmation

**Criteria:**
1. `change_1h > 0.7%` - Hourly in rally (establishing top)
2. `change_15m > 0.6%` - 15m also in rally (confirming top)
3. `change_5m < -0.5%` - BUT 5m showing decline (reversal signal!)
4. `volume_5m > volume_15m / 2` - 5m volume acceleration (2x ratio)
5. `volume_5m > volume_1h / 8` - 5m vs 1h volume (8x ratio)
6. `marketCap > $23M` - Minimum liquidity
7. `marketCap < $2.5B` - Maximum cap (avoid mega-caps)

**Timeframes:** 5m, 15m, 1h  
**Volume Intervals:** 5m, 15m, 1h

---

### 12.11 Implementation Notes

#### Alert Evaluator Structure
```typescript
// In src/services/alertEngine.ts

function evaluateFuturesBigBull60(metrics: FuturesMetrics): boolean {
  if (!metrics.marketCap) return false;
  
  return (
    metrics.change_1h > 1.6 &&
    metrics.change_1d < 15 &&
    metrics.change_8h > metrics.change_1h &&
    metrics.change_1d > metrics.change_8h &&
    metrics.volume_1h > 500_000 &&
    metrics.volume_8h > 5_000_000 &&
    6 * metrics.volume_1h > metrics.volume_8h &&
    16 * metrics.volume_1h > metrics.volume_1d &&
    metrics.marketCap > 23_000_000 &&
    metrics.marketCap < 2_500_000_000
  );
}

function evaluateFuturesBigBear60(metrics: FuturesMetrics): boolean {
  if (!metrics.marketCap) return false;
  
  return (
    metrics.change_1h < -1.6 &&
    metrics.change_1d > -15 &&
    metrics.change_8h < metrics.change_1h &&
    metrics.change_1d < metrics.change_8h &&
    metrics.volume_1h > 500_000 &&
    metrics.volume_8h > 5_000_000 &&
    6 * metrics.volume_1h > metrics.volume_8h &&
    16 * metrics.volume_1h > metrics.volume_1d &&
    metrics.marketCap > 23_000_000 &&
    metrics.marketCap < 2_500_000_000
  );
}

function evaluateFuturesPioneerBull(metrics: FuturesMetrics): boolean {
  if (!metrics.marketCap) return false;
  
  return (
    metrics.change_5m > 1 &&
    metrics.change_15m > 1 &&
    3 * metrics.change_5m > metrics.change_15m &&
    2 * metrics.volume_5m > metrics.volume_15m &&
    metrics.marketCap > 23_000_000 &&
    metrics.marketCap < 2_500_000_000
  );
}

function evaluateFuturesPioneerBear(metrics: FuturesMetrics): boolean {
  if (!metrics.marketCap) return false;
  
  return (
    metrics.change_5m < -1 &&
    metrics.change_15m < -1 &&
    3 * metrics.change_5m < metrics.change_15m &&
    2 * metrics.volume_5m > metrics.volume_15m &&
    metrics.marketCap > 23_000_000 &&
    metrics.marketCap < 2_500_000_000
  );
}

function evaluateFutures5BigBull(metrics: FuturesMetrics): boolean {
  if (!metrics.marketCap) return false;
  
  return (
    metrics.change_5m > 0.6 &&
    metrics.change_1d < 15 &&
    metrics.change_15m > metrics.change_5m &&
    metrics.change_1h > metrics.change_15m &&
    metrics.volume_5m > 100_000 &&
    metrics.volume_1h > 1_000_000 &&
    3 * metrics.volume_5m > metrics.volume_15m &&
    6 * metrics.volume_5m > metrics.volume_1h &&
    66 * metrics.volume_5m > metrics.volume_8h &&
    metrics.marketCap > 23_000_000 &&
    metrics.marketCap < 2_500_000_000
  );
}

function evaluateFutures5BigBear(metrics: FuturesMetrics): boolean {
  if (!metrics.marketCap) return false;
  
  return (
    metrics.change_5m < -0.6 &&
    metrics.change_1d > -15 &&
    metrics.change_15m < metrics.change_5m &&
    metrics.change_1h < metrics.change_15m &&
    metrics.volume_5m > 100_000 &&
    metrics.volume_1h > 1_000_000 &&
    3 * metrics.volume_5m > metrics.volume_15m &&
    6 * metrics.volume_5m > metrics.volume_1h &&
    66 * metrics.volume_5m > metrics.volume_8h &&
    metrics.marketCap > 23_000_000 &&
    metrics.marketCap < 2_500_000_000
  );
}

function evaluateFutures15BigBull(metrics: FuturesMetrics): boolean {
  if (!metrics.marketCap) return false;
  
  return (
    metrics.change_15m > 1 &&
    metrics.change_1d < 15 &&
    metrics.change_1h > metrics.change_15m &&
    metrics.change_8h > metrics.change_1h &&
    metrics.volume_15m > 400_000 &&
    metrics.volume_1h > 1_000_000 &&
    3 * metrics.volume_15m > metrics.volume_1h &&
    26 * metrics.volume_15m > metrics.volume_8h &&
    metrics.marketCap > 23_000_000 &&
    metrics.marketCap < 2_500_000_000
  );
}

function evaluateFutures15BigBear(metrics: FuturesMetrics): boolean {
  if (!metrics.marketCap) return false;
  
  return (
    metrics.change_15m < -1 &&
    metrics.change_1d > -15 &&
    metrics.change_1h < metrics.change_15m &&
    metrics.change_8h < metrics.change_1h &&
    metrics.volume_15m > 400_000 &&
    metrics.volume_1h > 1_000_000 &&
    3 * metrics.volume_15m > metrics.volume_1h &&
    26 * metrics.volume_15m > metrics.volume_8h &&
    metrics.marketCap > 23_000_000 &&
    metrics.marketCap < 2_500_000_000
  );
}

function evaluateFuturesBottomHunter(metrics: FuturesMetrics): boolean {
  if (!metrics.marketCap) return false;
  
  return (
    metrics.change_1h < -0.7 &&
    metrics.change_15m < -0.6 &&
    metrics.change_5m > 0.5 &&
    2 * metrics.volume_5m > metrics.volume_15m &&
    8 * metrics.volume_5m > metrics.volume_1h &&
    metrics.marketCap > 23_000_000 &&
    metrics.marketCap < 2_500_000_000
  );
}

function evaluateFuturesTopHunter(metrics: FuturesMetrics): boolean {
  if (!metrics.marketCap) return false;
  
  return (
    metrics.change_1h > 0.7 &&
    metrics.change_15m > 0.6 &&
    metrics.change_5m < -0.5 &&
    2 * metrics.volume_5m > metrics.volume_15m &&
    8 * metrics.volume_5m > metrics.volume_1h &&
    metrics.marketCap > 23_000_000 &&
    metrics.marketCap < 2_500_000_000
  );
}

// ... similar functions for other alerts
```

#### Alert Type Definitions
```typescript
// In src/types/alert.ts

export type FuturesAlertType = 
  | 'futures_big_bull_60'
  | 'futures_big_bear_60'
  | 'futures_pioneer_bull'
  | 'futures_pioneer_bear'
  | 'futures_5_big_bull'
  | 'futures_5_big_bear'
  | 'futures_15_big_bull'
  | 'futures_15_big_bear'
  | 'futures_bottom_hunter'
  | 'futures_top_hunter';

export interface FuturesAlertConfig extends BaseAlertConfig {
  type: FuturesAlertType;
  enabled: boolean;
}
```

#### UI Labels
```typescript
// In src/components/alerts/AlertBadges.tsx

const FUTURES_ALERT_LABELS: Record<FuturesAlertType, string> = {
  futures_big_bull_60: '60 Big Bull',
  futures_big_bear_60: '60 Big Bear',
  futures_pioneer_bull: 'Pioneer Bull',
  futures_pioneer_bear: 'Pioneer Bear',
  futures_5_big_bull: '5 Big Bull',
  futures_5_big_bear: '5 Big Bear',
  futures_15_big_bull: '15 Big Bull',
  futures_15_big_bear: '15 Big Bear',
  futures_bottom_hunter: 'Bottom Hunter',
  futures_top_hunter: 'Top Hunter',
};
```

---

### Phase 5: Scanner & Monitoring (Week 3)
- ✅ Implement futures scanner
- ✅ Add background scanning job
- ✅ Add metrics dashboard
- ✅ Performance monitoring

---

## 13. File Structure

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

## 14. Performance Considerations

### 14.1 Parallel Processing
- Fetch all 5 kline intervals in parallel (5 concurrent requests)
- Batch symbol processing with Promise.all
- Target: <500ms per symbol

### 14.2 Caching Strategy
- CoinGecko market cap: 1 hour cache
- Futures symbols list: 1 hour cache
- Kline data: No cache (real-time)

### 14.3 Rate Limiting
- Binance: Max 50 symbols/minute (conservative)
- CoinGecko: Max 30 calls/minute
- Implement queue system for bulk operations

---

## 15. Monitoring & Logging

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

## 16. Security Considerations

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
