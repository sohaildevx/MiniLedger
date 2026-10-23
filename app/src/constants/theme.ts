/**
 * One palette for the whole app, built around #2c6e49 and white.
 *
 * `background` is a barely-there green-grey rather than pure white, so that
 * pure-white cards read as raised surfaces. White-on-white has no depth
 * unless every card carries a shadow, which looks worse on Android.
 *
 * Light-mode only (`userInterfaceStyle: "light"` in app.json) so the app looks
 * identical on a phone set to dark mode.
 */
export const colors = {
  /** The brand green. */
  primary: '#2c6e49',
  primaryDark: '#1F4F35',
  primaryMid: '#3E8B61',
  /** ~10% tint of the brand green - filled chips, selected states. */
  primaryLight: '#E7F0EB',
  /** Even fainter, for large soft areas. */
  primarySurface: '#F1F7F3',

  background: '#F5F7F6',
  surface: '#FFFFFF',
  surfaceMuted: '#FAFBFB',
  border: '#E4E9E7',
  borderStrong: '#D3DCD8',

  text: '#132019',
  textMuted: '#5C6B63',
  textFaint: '#93A099',
  textInverse: '#FFFFFF',

  danger: '#C0392B',
  dangerDark: '#96271B',
  dangerSurface: '#FDF2F0',
  dangerBorder: '#F1C9C2',

  success: '#2c6e49',
  successSurface: '#F1F7F3',
  successBorder: '#C6DED1',
} as const;

/** Gradient used by the summary hero. */
export const heroGradient = ['#2A6A46', '#3E8C61'] as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

/**
 * Shadows. `elevation` is Android-only - without it Android silently drops the
 * shadow entirely, which is why iOS and Android otherwise look different.
 */
export const shadow = {
  card: {
    shadowColor: '#0B2419',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  floating: {
    shadowColor: '#0B2419',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
} as const;
