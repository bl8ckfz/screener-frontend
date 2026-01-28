# Crypto Screener Frontend

> **Status**: Week 2 Cleanup Complete (Jan 27, 2026) - Backend Integration Phase  
> **Bundle Size**: 71.84KB gzipped | **TypeScript Errors**: 0 | **Files Deleted**: 31 legacy files

A modern, real-time cryptocurrency market screener powered by a Go backend. Displays backend-processed technical indicators for 43 Binance Futures pairs.

## 🏗️ Architecture

**Dual-Source Data Strategy**:
- **Backend API** (Railway): Real-time metrics (VCP, RSI, MACD, Fibonacci) for 43 symbols, polled every 5 seconds
- **Binance Futures API**: Historical candlestick data for charts (on-demand, max 1500 candles)

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for complete architecture documentation.

## ✨ Features

- **Backend-Processed Metrics**: VCP, RSI, MACD, Fibonacci pivots calculated server-side
- **Real-time Updates**: 5-second polling from production Go backend on Railway
- **Multi-Timeframe Tracking**: 5m, 15m, 1h, 4h, 8h, 1d intervals
- **Advanced Charts**: Interactive candlestick charts with volume (via Binance Futures API)
- **Smart Alerts**: WebSocket-based alert notifications (backend-evaluated)
- **Export Capabilities**: CSV/JSON export for further analysis
- **Modern UI**: Dark mode, responsive design, optimized for 43 simultaneous data streams

## 🛠️ Tech Stack

- **Framework**: React 18 with TypeScript 5.6
- **Build Tool**: Vite 5.4
- **State Management**: Zustand 5.0 (global state) + TanStack Query 5.62 (server state)
- **Backend Integration**: HTTP polling (5s) + WebSocket (alerts)
- **Styling**: Tailwind CSS 3.4
- **Charts**: TradingView Lightweight Charts 4.2
- **Storage**: LocalStorage (Zustand persistence) + IndexedDB (large datasets)
- **Testing**: Vitest + React Testing Library

**Backend**: Go microservices on Railway (see [screener-backend](../screener-backend))

## 📋 Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0 (or pnpm/yarn)

## 🚀 Getting Started

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd screener-frontend
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment (optional - uses production backend by default):
```bash
# Copy example environment file
cp .env.example .env.local

# Edit .env.local with your settings
VITE_BACKEND_API_URL=https://api-gateway-production-f4ba.up.railway.app
VITE_BACKEND_WS_URL=wss://api-gateway-production-f4ba.up.railway.app
```

4. Start the development server:
```bash
npm run dev
```

The application will open at `http://localhost:3000`

### Verifying Backend Connection

```bash
# Check backend health
curl https://api-gateway-production-f4ba.up.railway.app/api/health

# Expected: {"status":"ok","timestamp":"...","uptime":"..."}
```

## 📜 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint to check code quality
- `npm run lint:fix` - Fix auto-fixable ESLint issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check if code is formatted
- `npm run type-check` - Run TypeScript type checking
- `npm run test` - Run tests in watch mode
- `npm run test:ui` - Run tests with UI
- `npm run test:coverage` - Generate test coverage report

## 📁 Project Structure

```
screener-frontend/
├── src/
│   ├── components/      # React components (presentation layer)
│   │   ├── coin/        # Coin table, modal, charts
│   │   ├── controls/    # Filters, sorting, timeframe selectors
│   │   ├── market/      # Market summary, statistics
│   │   ├── alerts/      # Alert history, webhook management (stubs)
│   │   └── ui/          # Reusable UI components (Button, Badge, etc.)
│   ├── hooks/           # Custom React hooks
│   │   ├── useBackendData.ts    # Primary data source (120 lines)
│   │   ├── useBackendAlerts.ts  # WebSocket alert listener
│   │   ├── useMarketStats.ts    # Market aggregation utility
│   │   └── useStore.ts          # Global state (Zustand)
│   ├── services/        # External service integrations
│   │   ├── backendApi.ts        # Backend HTTP client
│   │   ├── chartData.ts         # Binance chart data (172 lines)
│   │   ├── storage.ts           # LocalStorage wrapper
│   │   └── syncService.ts       # Supabase integration
│   ├── utils/           # Utility functions
│   │   ├── format.ts            # Number/date formatting
│   │   ├── sort.ts              # Client-side sorting
│   │   └── export.ts            # CSV/JSON export
│   ├── types/           # TypeScript definitions
│   │   ├── coin.ts              # Core data model
│   │   ├── alert.ts             # Alert types
│   │   └── config.ts            # User preferences
│   └── App.tsx          # Root component (~450 lines)
├── docs/                # Documentation
│   ├── ARCHITECTURE.md         # Architecture overview (NEW)
│   ├── WEEK2_CLEANUP_COMPLETE.md  # Cleanup summary
│   ├── ROADMAP.md              # Development roadmap
│   └── STATE.md                # Project state tracking
├── fast.html            # Legacy monolithic version (DO NOT MODIFY)
└── tests/              # Test files (Vitest + RTL)
```

**See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for detailed architecture documentation.**

## 📚 Key Documentation

- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - System architecture, data flow, components
- **[WEEK2_CLEANUP_COMPLETE.md](./docs/WEEK2_CLEANUP_COMPLETE.md)** - Details of 31-file cleanup
- **[ROADMAP.md](./docs/ROADMAP.md)** - Development phases and progress
- **[STATE.md](./docs/STATE.md)** - Current project state and pending tasks

## 🧑‍💻 Development Guidelines

### Code Style

- **TypeScript**: Strict mode enabled, all files must type-check
- **React Patterns**: Functional components, custom hooks for logic extraction
- **State Management**: TanStack Query for server state, Zustand for global UI state
- **Component Structure**: Keep components small (<300 lines), extract logic to hooks
- **Imports**: Use path alias `@/` for all imports (configured in vite.config.ts)

### Before Committing

```bash
npm run type-check   # Must pass with 0 errors
npm run lint:fix     # Auto-fix linting issues
npm run format       # Format code with Prettier
npm test             # Run test suite
```

- Use TypeScript interfaces for props
- Implement proper error boundaries
- Add loading and error states
- Make components accessible (WCAG 2.1 AA)
- Use semantic HTML
- Optimize for performance (memoization, virtualization)

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
## 🌐 API Integration

### Backend API (Primary Data Source)

- **Endpoint**: `https://api-gateway-production-f4ba.up.railway.app/api/metrics/`
- **Method**: HTTP GET (polled every 5 seconds)
- **Response**: Array of 43 symbols with 6 timeframes (5m, 15m, 1h, 4h, 8h, 1d)
- **Metrics**: VCP, RSI, MACD, Fibonacci pivots, volume, price changes
- **Authentication**: None (public endpoint)

### Binance Futures API (Chart Data)

- **Endpoint**: `https://fapi.binance.com/fapi/v1/klines`
- **Method**: HTTP GET (on-demand, when user opens chart)
- **Response**: Candlestick data (OHLCV)
- **Rate Limit**: 1200 requests per minute (IP-based)
- **Authentication**: None (public endpoint)
- **CORS**: Proxied in development via `allorigins.win`

### WebSocket (Alerts)

- **Endpoint**: `wss://api-gateway-production-f4ba.up.railway.app/ws/alerts`
- **Protocol**: WebSocket
- **Messages**: JSON alert events from backend

## 📊 Performance

- **Bundle Size**: 71.84KB gzipped (target: <100KB) ✅
- **Initial Load**: ~1.5s (3G connection)
- **Time to Interactive**: <2s
- **TypeScript Errors**: 0 ✅
- **Lighthouse Score**: >90 (performance, accessibility, best practices)

## 🌍 Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

## 🔧 Troubleshooting

### Backend Connection Issues

```bash
# Check backend health
curl https://api-gateway-production-f4ba.up.railway.app/api/health

# Expected: {"status":"ok", ...}
```

If backend is down, the frontend will show "No data available" message.

### Build Issues

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Verify TypeScript
npm run type-check  # Should show 0 errors
```

### TypeScript Errors

```bash
# Run type checking
npm run type-check

# Common issues:
# - Missing types: npm install --save-dev @types/<package>
# - Path alias issues: Check vite.config.ts tsconfig paths
```

### Port Already in Use

```bash
# Change port in vite.config.ts or use:
PORT=3001 npm run dev
```

### Charts Not Loading

- **Development**: CORS proxy may be slow - wait 5-10 seconds
- **Production**: Check browser console for API errors
- **Fallback**: Charts fetch from Binance directly (no backend involvement)

## 🚢 Deployment

**Current**: Vercel (automatic deployment from `main` branch)

```bash
# Build for production
npm run build

# Preview build
npm run preview

# Deploy to Vercel
vercel --prod
```

**Environment Variables** (set in Vercel dashboard):
```bash
VITE_BACKEND_API_URL=https://api-gateway-production-f4ba.up.railway.app
VITE_BACKEND_WS_URL=wss://api-gateway-production-f4ba.up.railway.app
```

## 📝 Migration Notes

### From Legacy (`fast.html`)

The original 3,029-line monolithic HTML file has been completely refactored:

**What Changed**:
- All data processing moved to backend (Go microservices)
- Client-side indicator calculations removed (VCP, RSI, MACD now from backend)
- Binance WebSocket replaced with HTTP polling from backend
- Alert evaluation moved server-side
- 31 legacy files deleted (11,300+ lines)

**What Stayed**:
- Chart functionality (now via chartData.ts → Binance API)
- UI components (table, modal, controls)
- Export features (CSV/JSON)
- LocalStorage persistence

**Breaking Changes**: None for end users - UI/UX remains the same

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

**Contribution Guidelines**:
- All PRs must pass TypeScript type checking (`npm run type-check`)
- Add tests for new features
- Update documentation as needed
- Follow existing code style (enforced by ESLint/Prettier)

## 📞 Support

For issues and feature requests, please use the [GitHub Issues](../../issues) page.

## 🔗 Related Repositories

- **Backend**: [screener-backend](../screener-backend) - Go microservices for metrics processing

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request

## License

[License information here]

## Acknowledgments

- Binance API for market data
- TradingView for charting library
- React and TypeScript communities

## Contact

For questions or support, please open an issue on GitHub.

---

**Version**: 2.0.0
**Status**: In Development
**Last Updated**: 2025-11-28
