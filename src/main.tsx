import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Analytics } from '@vercel/analytics/react'
import { AuthProvider } from '@/hooks/useAuth'
import { captureAttribution } from '@/services/attribution'
import App from './App'
import './styles/index.css'

// Before the router mounts: the catch-all route redirects without the query
// string, so an ad link's tags must be read while they are still in the URL.
captureAttribution()

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000, // 5 seconds
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
      <Analytics />
    </QueryClientProvider>
  </React.StrictMode>
)
