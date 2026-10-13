import { MD3DarkTheme, MD3LightTheme, configureFonts } from 'react-native-paper';
import type { ThemeProp } from 'react-native-paper/lib/typescript/types';
import { DarkTheme, DefaultTheme, Theme } from '@react-navigation/native';
import { darkColors, lightColors } from './theme';
import { fontFamilies } from './typography';

const fonts = configureFonts({
  config: { fontFamily: fontFamilies.regular },
});

export const paperLightTheme: ThemeProp = {
  ...MD3LightTheme,
  fonts,
  colors: {
    ...MD3LightTheme.colors,
    primary: lightColors.primary,
    secondary: lightColors.secondaryAccent,
    background: lightColors.background,
    surface: lightColors.card,
    error: lightColors.danger,
    outline: lightColors.border,
  },
};

export const paperDarkTheme: ThemeProp = {
  ...MD3DarkTheme,
  fonts,
  colors: {
    ...MD3DarkTheme.colors,
    primary: darkColors.primary,
    secondary: darkColors.secondaryAccent,
    background: darkColors.background,
    surface: darkColors.card,
    error: darkColors.danger,
    outline: darkColors.border,
  },
};

export const navigationLightTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: lightColors.primary,
    background: lightColors.background,
    card: lightColors.card,
    text: lightColors.textPrimary,
    border: lightColors.border,
  },
};

export const navigationDarkTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: darkColors.primary,
    background: darkColors.background,
    card: darkColors.card,
    text: darkColors.textPrimary,
    border: darkColors.border,
  },
};
