import { useState, useEffect, forwardRef } from 'react'

export interface SearchBarProps {
  onSearch: (query: string) => void
  placeholder?: string
  className?: string
}

/**
 * SearchBar component for filtering coins by symbol or name
 */
export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  ({ onSearch, placeholder = 'Search coins...', className = '' }, ref) => {
    const [query, setQuery] = useState('')

    // Debounce search to avoid too many updates
    useEffect(() => {
      const timer = setTimeout(() => {
        onSearch(query)
      }, 300)

      return () => clearTimeout(timer)
    }, [query, onSearch])

    const handleClear = () => {
      setQuery('')
    }

    return (
      <div className={`relative ${className}`}>
        <div className="relative">
          <input
            ref={ref}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full px-4 py-2 pl-10 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        {/* Search icon */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        {/* Clear button */}
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
            aria-label="Clear search"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
      {/* Search hint */}
      {query && (
        <div className="mt-1 text-xs text-gray-400">
          Searching for "{query}"
        </div>
      )}
    </div>
  )
})

SearchBar.displayName = 'SearchBar'
