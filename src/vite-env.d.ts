/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BINANCE_API_URL: string
  readonly VITE_REFRESH_INTERVAL: string
  readonly VITE_DEFAULT_PAIR: string
  readonly VITE_DEFAULT_LIST: string
  readonly VITE_MARKETINOUT_URL: string
  readonly VITE_COINGLASS_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
