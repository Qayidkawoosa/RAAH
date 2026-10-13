import { useColorScheme } from 'react-native';
import { lightColors, darkColors, ThemeColors, spacing, roundness, shadows } from '../theme/theme';

interface AppTheme {
  colors: ThemeColors;
  isDark: boolean;
  spacing: typeof spacing;
  roundness: typeof roundness;
  shadows: typeof shadows;
}

export const useAppTheme = (): AppTheme => {
  const systemScheme = useColorScheme();
  const isDark = systemScheme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  return {
    colors,
    isDark,
    spacing,
    roundness,
    shadows,
  };
};
