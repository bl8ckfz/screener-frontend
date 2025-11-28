/**
 * EmptyState Component
 * 
 * Reusable empty state display for no data scenarios.
 * Used for "no coins found", "no search results", "no alerts", etc.
 */

import { Button } from './Button'

export interface EmptyStateProps {
  /** Icon to display (emoji or SVG) */
  icon?: string
  /** Title text */
  title?: string
  /** Description text */
  description?: string
  /** Optional action button label */
  actionLabel?: string
  /** Callback when action button is clicked */
  onAction?: () => void
  /** Additional CSS classes */
  className?: string
}

/**
 * EmptyState component for displaying no data scenarios
 * 
 * @example
 * ```tsx
 * <EmptyState
 *   icon="🔍"
 *   title="No results found"
 *   description="Try adjusting your search query"
 *   actionLabel="Clear Search"
 *   onAction={() => setSearch('')}
 * />
 * ```
 */
export function EmptyState({
  icon = '📭',
  title = 'No data found',
  description,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex items-center justify-center min-h-[300px] ${className}`}>
      <div className="text-center max-w-md px-4">
        {/* Icon */}
        <div className="text-6xl mb-4" role="img" aria-label="Empty state">
          {icon}
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-text-primary mb-2">
          {title}
        </h3>

        {/* Description */}
        {description && (
          <p className="text-sm text-text-secondary mb-6">
            {description}
          </p>
        )}

        {/* Action Button */}
        {actionLabel && onAction && (
          <Button
            onClick={onAction}
            variant="primary"
            size="md"
          >
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * Pre-configured empty states for common scenarios
 */
export const EmptyStates = {
  /** No search results */
  NoSearchResults: (query: string, onClear?: () => void) => (
    <EmptyState
      icon="🔍"
      title="No results found"
      description={`No coins match "${query}". Try a different search term.`}
      actionLabel="Clear Search"
      onAction={onClear}
    />
  ),

  /** No coins for pair */
  NoCoins: (pair: string) => (
    <EmptyState
      icon="💱"
      title="No coins found"
      description={`No trading pairs found for ${pair}. Try selecting a different currency.`}
    />
  ),

  /** No alerts */
  NoAlerts: (onCreateAlert?: () => void) => (
    <EmptyState
      icon="🔔"
      title="No alerts set"
      description="You haven't created any price alerts yet. Set up alerts to get notified of important price movements."
      actionLabel="Create Alert"
      onAction={onCreateAlert}
    />
  ),

  /** No favorites */
  NoFavorites: (onBrowse?: () => void) => (
    <EmptyState
      icon="⭐"
      title="No favorites yet"
      description="Star your favorite coins to quickly access them here."
      actionLabel="Browse Coins"
      onAction={onBrowse}
    />
  ),

  /** No watchlist items */
  NoWatchlist: (onAdd?: () => void) => (
    <EmptyState
      icon="👀"
      title="Watchlist is empty"
      description="Add coins to your watchlist to monitor them closely."
      actionLabel="Add Coins"
      onAction={onAdd}
    />
  ),

  /** No data available */
  NoData: () => (
    <EmptyState
      icon="📊"
      title="No data available"
      description="There is no data to display at this time."
    />
  ),

  /** Filtered out all results */
  AllFiltered: (onResetFilters?: () => void) => (
    <EmptyState
      icon="🎯"
      title="No matches"
      description="Your current filters exclude all coins. Try adjusting your filter criteria."
      actionLabel="Reset Filters"
      onAction={onResetFilters}
    />
  ),

  /** Coming soon */
  ComingSoon: (feature: string) => (
    <EmptyState
      icon="🚧"
      title="Coming Soon"
      description={`${feature} feature is currently under development and will be available soon.`}
    />
  ),
}
