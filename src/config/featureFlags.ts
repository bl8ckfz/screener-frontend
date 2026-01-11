export const FEATURE_FLAGS = {
  // Enable mobile card layout for coin and alert history lists
  mobileCardView: (import.meta.env.VITE_ENABLE_MOBILE_CARDS ?? 'true') !== 'false',
}
