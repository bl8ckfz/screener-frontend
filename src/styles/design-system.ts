/**
 * Pulsaryx Design System
 * 
 * Centralized design tokens for consistent styling across the application.
 * All tokens are consumed via Tailwind CSS utility classes.
 */

/**
 * Color Palette
 * 
 * Dark Mode (Primary): Optimized for extended screen time, reduces eye strain
 * Light Mode (Future): High contrast alternative for bright environments
 */
export const colors = {
  // Dark Mode Theme (Current)
  dark: {
    // Backgrounds
    bg: {
      primary: '#0a0a0a',      // Main background
      secondary: '#141414',     // Cards, panels
      tertiary: '#1a1a1a',      // Elevated surfaces
      hover: '#242424',         // Hover states
      active: '#2a2a2a',        // Active/pressed states
    },
    
    // Surfaces
    surface: {
      dark: '#0f172a',          // Deep surfaces (slate-900)
      DEFAULT: '#1e293b',       // Default surface (slate-800)
      light: '#334155',         // Light surface (slate-700)
      lighter: '#475569',       // Lighter surface (slate-600)
    },
    
    // Text
    text: {
      primary: '#f8fafc',       // Primary text (slate-50)
      secondary: '#cbd5e1',     // Secondary text (slate-300)
      tertiary: '#94a3b8',      // Tertiary text (slate-400)
      disabled: '#64748b',      // Disabled text (slate-500)
      inverse: '#0f172a',       // Text on light backgrounds
    },
    
    // Borders
    border: {
      DEFAULT: '#334155',       // Default borders (slate-700)
      light: '#475569',         // Light borders (slate-600)
      dark: '#1e293b',          // Dark borders (slate-800)
      hover: '#64748b',         // Hover state borders (slate-500)
      focus: '#2B95FF',         // Focus ring color
    },
  },
  
  // Light Mode Theme (Future Implementation)
  light: {
    bg: {
      primary: '#ffffff',
      secondary: '#f8fafc',
      tertiary: '#f1f5f9',
      hover: '#e2e8f0',
      active: '#cbd5e1',
    },
    surface: {
      dark: '#e2e8f0',
      DEFAULT: '#f1f5f9',
      light: '#f8fafc',
      lighter: '#ffffff',
    },
    text: {
      primary: '#0f172a',
      secondary: '#334155',
      tertiary: '#64748b',
      disabled: '#94a3b8',
      inverse: '#f8fafc',
    },
    border: {
      DEFAULT: '#e2e8f0',
      light: '#f1f5f9',
      dark: '#cbd5e1',
      hover: '#94a3b8',
      focus: '#2B95FF',
    },
  },
  
  // Semantic Colors (Theme Independent)
  semantic: {
    // Success - Positive actions, gains, bullish indicators
    success: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',   // DEFAULT
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
    },
    
    // Danger - Errors, losses, bearish indicators
    danger: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',   // DEFAULT
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d',
    },
    
    // Warning - Caution, medium priority alerts
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',   // DEFAULT
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
    },
    
    // Info - Informational messages, neutral states
    info: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',   // DEFAULT
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
    },
  },
  
  // Trading Specific Colors
  trading: {
    // Bullish (Green)
    bullish: {
      DEFAULT: '#10b981',       // emerald-500
      light: '#34d399',         // emerald-400
      dark: '#059669',          // emerald-600
      bg: 'rgba(16, 185, 129, 0.1)',
      border: 'rgba(16, 185, 129, 0.3)',
    },
    
    // Bearish (Red)
    bearish: {
      DEFAULT: '#ef4444',       // red-500
      light: '#f87171',         // red-400
      dark: '#dc2626',          // red-600
      bg: 'rgba(239, 68, 68, 0.1)',
      border: 'rgba(239, 68, 68, 0.3)',
    },
    
    // Neutral (Gray)
    neutral: {
      DEFAULT: '#6b7280',       // gray-500
      light: '#9ca3af',         // gray-400
      dark: '#4b5563',          // gray-600
      bg: 'rgba(107, 114, 128, 0.1)',
      border: 'rgba(107, 114, 128, 0.3)',
    },
  },
  
  // Accent Colors
  accent: {
    primary: {
      DEFAULT: '#2B95FF',       // Primary brand color (blue)
      light: '#60a5fa',         // blue-400
      dark: '#1d4ed8',          // blue-700
      bg: 'rgba(43, 149, 255, 0.1)',
      border: 'rgba(43, 149, 255, 0.3)',
    },
    secondary: {
      DEFAULT: '#8b5cf6',       // violet-500
      light: '#a78bfa',         // violet-400
      dark: '#7c3aed',          // violet-600
      bg: 'rgba(139, 92, 246, 0.1)',
      border: 'rgba(139, 92, 246, 0.3)',
    },
  },
}

/**
 * Typography Scale
 * 
 * Based on modular scale (1.25 ratio) for harmonious sizing
 * Font sizes follow Material Design principles
 */
export const typography = {
  // Font Families
  fontFamily: {
    sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
    mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
  },
  
  // Font Sizes (with line heights)
  fontSize: {
    // Extra small - Captions, labels
    xs: { size: '0.75rem', lineHeight: '1rem' },      // 12px
    
    // Small - Secondary text, descriptions
    sm: { size: '0.875rem', lineHeight: '1.25rem' },  // 14px
    
    // Base - Body text
    base: { size: '1rem', lineHeight: '1.5rem' },     // 16px
    
    // Large - Emphasized text
    lg: { size: '1.125rem', lineHeight: '1.75rem' },  // 18px
    
    // Extra large - Section headings
    xl: { size: '1.25rem', lineHeight: '1.75rem' },   // 20px
    
    // 2xl - Card titles
    '2xl': { size: '1.5rem', lineHeight: '2rem' },    // 24px
    
    // 3xl - Page headings
    '3xl': { size: '1.875rem', lineHeight: '2.25rem' }, // 30px
    
    // 4xl - Hero text
    '4xl': { size: '2.25rem', lineHeight: '2.5rem' }, // 36px
    
    // 5xl - Large displays
    '5xl': { size: '3rem', lineHeight: '1' },         // 48px
    
    // 6xl - Extra large displays
    '6xl': { size: '3.75rem', lineHeight: '1' },      // 60px
  },
  
  // Font Weights
  fontWeight: {
    thin: '100',
    extralight: '200',
    light: '300',
    normal: '400',      // Body text
    medium: '500',      // Emphasis
    semibold: '600',    // Headings
    bold: '700',        // Strong emphasis
    extrabold: '800',
    black: '900',
  },
  
  // Letter Spacing
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
}

/**
 * Spacing Scale
 * 
 * Based on 4px base unit for consistent vertical rhythm
 * Follows 8-point grid system for predictable layouts
 */
export const spacing = {
  0: '0px',
  0.5: '2px',     // 0.5 × 4
  1: '4px',       // 1 × 4
  1.5: '6px',     // 1.5 × 4
  2: '8px',       // 2 × 4
  2.5: '10px',    // 2.5 × 4
  3: '12px',      // 3 × 4
  3.5: '14px',    // 3.5 × 4
  4: '16px',      // 4 × 4
  5: '20px',      // 5 × 4
  6: '24px',      // 6 × 4
  7: '28px',      // 7 × 4
  8: '32px',      // 8 × 4
  9: '36px',      // 9 × 4
  10: '40px',     // 10 × 4
  11: '44px',     // 11 × 4
  12: '48px',     // 12 × 4
  14: '56px',     // 14 × 4
  16: '64px',     // 16 × 4
  20: '80px',     // 20 × 4
  24: '96px',     // 24 × 4
  28: '112px',    // 28 × 4
  32: '128px',    // 32 × 4
  36: '144px',    // 36 × 4
  40: '160px',    // 40 × 4
  44: '176px',    // 44 × 4
  48: '192px',    // 48 × 4
  52: '208px',    // 52 × 4
  56: '224px',    // 56 × 4
  60: '240px',    // 60 × 4
  64: '256px',    // 64 × 4
  72: '288px',    // 72 × 4
  80: '320px',    // 80 × 4
  96: '384px',    // 96 × 4
}

/**
 * Border Radius
 * 
 * Consistent corner rounding for UI elements
 */
export const borderRadius = {
  none: '0',
  sm: '0.125rem',   // 2px - Small elements (badges, tags)
  DEFAULT: '0.25rem', // 4px - Default (buttons, inputs)
  md: '0.375rem',   // 6px - Medium (cards)
  lg: '0.5rem',     // 8px - Large (panels, modals)
  xl: '0.75rem',    // 12px - Extra large (featured cards)
  '2xl': '1rem',    // 16px - Very large
  '3xl': '1.5rem',  // 24px - Extremely large
  full: '9999px',   // Circular/pill shaped
}

/**
 * Shadows
 * 
 * Elevation system for depth hierarchy (Material Design inspired)
 */
export const shadows = {
  // No shadow
  none: 'none',
  
  // Small shadow - Hovering slightly above surface
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  
  // Default shadow - Raised elements
  DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  
  // Medium shadow - Cards, dropdowns
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  
  // Large shadow - Modals, overlays
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  
  // Extra large shadow - Floating panels
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  
  // 2xl shadow - Major elements
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  
  // Inner shadow - Inset elements
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',
  
  // Colored shadows for emphasis
  glow: {
    bullish: '0 0 20px rgba(16, 185, 129, 0.3)',
    bearish: '0 0 20px rgba(239, 68, 68, 0.3)',
    accent: '0 0 20px rgba(43, 149, 255, 0.3)',
  },
}

/**
 * Transitions & Animations
 * 
 * Consistent timing for UI interactions
 */
export const transitions = {
  // Duration
  duration: {
    fastest: '75ms',    // Instant feedback
    faster: '100ms',    // Quick transitions
    fast: '150ms',      // Standard hover states
    DEFAULT: '200ms',   // Default transitions
    slow: '300ms',      // Smooth animations
    slower: '500ms',    // Gentle animations
    slowest: '700ms',   // Dramatic effects
  },
  
  // Timing Functions (Easing)
  timing: {
    linear: 'linear',
    in: 'cubic-bezier(0.4, 0, 1, 1)',           // Ease in
    out: 'cubic-bezier(0, 0, 0.2, 1)',          // Ease out
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',      // Ease in-out
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)', // Bounce effect
    sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',      // Sharp transition
  },
  
  // Common Transition Properties
  property: {
    all: 'all',
    colors: 'color, background-color, border-color, text-decoration-color, fill, stroke',
    opacity: 'opacity',
    shadow: 'box-shadow',
    transform: 'transform',
  },
}

/**
 * Z-Index Scale
 * 
 * Layering system for stacking contexts
 */
export const zIndex = {
  auto: 'auto',
  0: '0',
  10: '10',       // Dropdowns
  20: '20',       // Sticky elements
  30: '30',       // Fixed headers
  40: '40',       // Modals backdrop
  50: '50',       // Modals content
  60: '60',       // Tooltips
  70: '70',       // Notifications
  80: '80',       // Critical overlays
  90: '90',       // Loading screens
  100: '100',     // Maximum priority
}

/**
 * Breakpoints
 * 
 * Responsive design breakpoints (mobile-first)
 */
export const breakpoints = {
  sm: '640px',    // Small devices (landscape phones)
  md: '768px',    // Medium devices (tablets)
  lg: '1024px',   // Large devices (desktops)
  xl: '1280px',   // Extra large devices (large desktops)
  '2xl': '1536px', // 2X extra large devices (very large screens)
}

/**
 * Design System Export
 * 
 * Centralized export for consumption in Tailwind config
 */
export const designSystem = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  transitions,
  zIndex,
  breakpoints,
}

export default designSystem
