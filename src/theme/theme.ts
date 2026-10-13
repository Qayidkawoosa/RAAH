export interface ThemeColors {
  primary: string;
  primaryDark: string;
  aiAccent: string;
  secondaryAccent: string;
  background: string;
  card: string;
  cardElevated: string;
  surface: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  success: string;
  warning: string;
  danger: string;
  gradientStart: string;
  gradientEnd: string;
  tabBar: string;
  tabBarBorder: string;
  inputBackground: string;
  /** RAAH brand watermark color — very faint */
  watermark: string;
}

// ─── Dark palette (primary) ───────────────────────────────────────────
// Deep charcoal surfaces with electric-purple accent. Inspired by the
// Dribbble "Bus Tracker" reference: dark cards, bold purple fills, white text.
export const darkColors: ThemeColors = {
  primary: '#6C5CE7',
  primaryDark: '#5A4BD1',
  aiAccent: '#A78BFA',
  secondaryAccent: '#38BDF8',
  background: '#0D0D14',
  card: '#1A1A28',
  cardElevated: '#22223A',
  surface: '#252538',
  border: '#2E2E48',
  textPrimary: '#F2F2FA',
  textSecondary: '#9090AD',
  textTertiary: '#5E5E7E',
  success: '#4ADE80',
  warning: '#FBBF24',
  danger: '#F87171',
  gradientStart: '#6C5CE7',
  gradientEnd: '#8B7CF7',
  tabBar: '#12121E',
  tabBarBorder: '#1E1E32',
  inputBackground: '#1A1A28',
  watermark: 'rgba(108,92,231,0.08)',
};

// ─── Light palette ────────────────────────────────────────────────────
// Cool-gray surfaces so the purple accent pops cleanly.
export const lightColors: ThemeColors = {
  primary: '#6C5CE7',
  primaryDark: '#5A4BD1',
  aiAccent: '#7C3AED',
  secondaryAccent: '#0EA5E9',
  background: '#F4F5F9',
  card: '#FFFFFF',
  cardElevated: '#F9F9FF',
  surface: '#EEEDF5',
  border: '#DDDCE8',
  textPrimary: '#1A1A2E',
  textSecondary: '#6E6E8A',
  textTertiary: '#9D9DB8',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  gradientStart: '#6C5CE7',
  gradientEnd: '#8B7CF7',
  tabBar: '#FFFFFF',
  tabBarBorder: '#E8E8F0',
  inputBackground: '#F4F5F9',
  watermark: 'rgba(108,92,231,0.05)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const roundness = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  full: 9999,
};

// Elevated, modern shadows — slightly stronger to lift cards off the
// dark background, matching the reference's layered depth.
export const shadows = {
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  /** Coloured glow for buttons / featured cards */
  glow: {
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
};
