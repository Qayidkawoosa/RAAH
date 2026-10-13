export const fontFamilies = {
  thin: 'Poppins-Light',
  regular: 'Poppins-Regular',
  medium: 'Poppins-Medium',
  semibold: 'Poppins-SemiBold',
  bold: 'Poppins-Bold',
};

export const typography = {
  h1: {
    fontFamily: fontFamilies.bold,
    fontSize: 36,
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  h2: {
    fontFamily: fontFamilies.bold,
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  h3: {
    fontFamily: fontFamilies.semibold,
    fontSize: 20,
    lineHeight: 28,
  },
  titleLarge: {
    fontFamily: fontFamilies.semibold,
    fontSize: 18,
    lineHeight: 24,
  },
  titleMedium: {
    fontFamily: fontFamilies.medium,
    fontSize: 16,
    lineHeight: 22,
  },
  bodyLarge: {
    fontFamily: fontFamilies.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  bodyMedium: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  bodySmall: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  buttonLarge: {
    fontFamily: fontFamilies.semibold,
    fontSize: 16,
    lineHeight: 20,
  },
  buttonMedium: {
    fontFamily: fontFamilies.medium,
    fontSize: 14,
    lineHeight: 18,
  },
  caption: {
    fontFamily: fontFamilies.regular,
    fontSize: 10,
    lineHeight: 14,
  },
  /** Oversized stat number — used by StatCard and dashboard heroes */
  statValue: {
    fontFamily: fontFamilies.bold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
};
