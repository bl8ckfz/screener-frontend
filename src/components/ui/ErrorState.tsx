/**
 * ErrorState Component
 * 
 * Reusable error state display with icon, message, and optional retry button.
 * Used for API errors, chart failures, and data fetch errors.
 */

import { Button } from './Button'

export interface ErrorStateProps {
  /** Error message to display */
  message?: string
  /** Optional detailed error description */
  description?: string
  /** Callback when retry button is clicked */
  onRetry?: () => void
  /** Custom icon (defaults to ⚠️) */
  icon?: string
  /** Whether to show the retry button */
  showRetry?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * ErrorState component for displaying error messages with optional retry
 * 
 * @example
 * ```tsx
 * <ErrorState
 *   message="Failed to load data"
 *   description="Could not connect to API"
 *   onRetry={() => refetch()}
 * />
 * ```
 */
export function ErrorState({
  message = 'Something went wrong',
  description,
  onRetry,
  icon = '⚠️',
  showRetry = true,
  className = '',
}: ErrorStateProps) {
  return (
    <div className={`flex items-center justify-center min-h-[200px] ${className}`}>
      <div className="text-center max-w-md px-4">
        {/* Icon */}
        <div className="text-6xl mb-4" role="img" aria-label="Error">
          {icon}
        </div>

        {/* Message */}
        <h3 className="text-lg font-semibold text-danger mb-2">
          {message}
        </h3>

        {/* Description */}
        {description && (
          <p className="text-sm text-text-secondary mb-4">
            {description}
          </p>
        )}

        {/* Retry Button */}
        {showRetry && onRetry && (
          <Button
            onClick={onRetry}
            variant="secondary"
            size="md"
          >
            Try Again
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * Pre-configured error states for common scenarios
 */
export const ErrorStates = {
  /** Network error */
  Network: (onRetry?: () => void) => (
    <ErrorState
      icon="🌐"
      message="Network Error"
      description="Unable to connect to the server. Please check your internet connection."
      onRetry={onRetry}
    />
  ),

  /** API error */
  API: (onRetry?: () => void) => (
    <ErrorState
      icon="⚠️"
      message="API Error"
      description="Failed to fetch data from the server. Please try again later."
      onRetry={onRetry}
    />
  ),

  /** Chart data error */
  Chart: (onRetry?: () => void) => (
    <ErrorState
      icon="📉"
      message="Chart Data Error"
      description="Unable to load chart data. Please try again."
      onRetry={onRetry}
    />
  ),

  /** Generic error */
  Generic: (message?: string, onRetry?: () => void) => (
    <ErrorState
      message={message || 'Something went wrong'}
      description="An unexpected error occurred. Please try again."
      onRetry={onRetry}
    />
  ),

  /** Permission error */
  Permission: () => (
    <ErrorState
      icon="🔒"
      message="Access Denied"
      description="You don't have permission to access this resource."
      showRetry={false}
    />
  ),

  /** Rate limit error */
  RateLimit: (onRetry?: () => void) => (
    <ErrorState
      icon="⏱️"
      message="Rate Limit Exceeded"
      description="Too many requests. Please wait a moment and try again."
      onRetry={onRetry}
    />
  ),
}
