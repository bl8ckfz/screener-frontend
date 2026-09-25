/**
 * Coin-Sniffer logo: the "Snout C" mark (a C that is also a dog's head, nose
 * in bullish green), optionally followed by the wordmark.
 *
 * The mark is inlined rather than loaded from /favicon.svg so it paints with
 * the page and needs no extra request. Source files for other apps live in
 * brand/ at the repo root; keep the geometry here in sync with them.
 */
interface LogoProps {
  /** Mark height in px; the wordmark follows the surrounding font size */
  size?: number
  /** Show the "Coin-Sniffer" text next to the mark */
  withText?: boolean
  className?: string
}

export function LogoMark({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`flex-shrink-0 ${className}`}
      aria-hidden="true"
    >
      <path
        d="M67.2 75.2 A30 30 0 1 1 46 24 L72 24"
        fill="none"
        stroke="#2B95FF"
        strokeWidth={12}
        strokeLinecap="round"
      />
      <path d="M30 32 L26 9 L46 26 Z" fill="#2B95FF" stroke="#2B95FF" strokeWidth={5} strokeLinejoin="round" />
      <circle cx={58} cy={39} r={3.8} fill="#2B95FF" />
      <circle cx={80} cy={25} r={7.5} fill="#34d399" />
    </svg>
  )
}

export function Logo({ size = 24, withText = true, className = '' }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={size} />
      {withText && <span>Coin-Sniffer</span>}
    </span>
  )
}
