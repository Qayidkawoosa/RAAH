import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, useColorScheme, Platform, TouchableOpacity } from 'react-native';
import { ActivityIndicator, Provider as PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Poppins_300Light,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { TripProvider } from './src/context/TripContext';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { AppNavigator } from './src/navigation/AppNavigator';
import {
  navigationDarkTheme,
  navigationLightTheme,
  paperDarkTheme,
  paperLightTheme,
} from './src/theme/paperTheme';
import { lightColors, darkColors } from './src/theme/theme';

// Only prevent auto hide on mobile devices where splash is supported
if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

// Error Boundary to prevent white screen crashes
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('AppErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>{this.state.error?.message}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={styles.retryButtonText}>Reload Application</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

function MainNavigator() {
  const { user, loading } = useAuth();
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? darkColors : lightColors;

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer
      documentTitle={{
        formatter: (options, route) => options?.title ?? route?.name ?? 'RAAH - Raasta Kashmir',
      }}
      theme={isDark ? navigationDarkTheme : navigationLightTheme}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {user ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

export default function App() {
  const isDark = useColorScheme() === 'dark';
  const [fontsLoaded, fontError] = useFonts({
    'Poppins-Light': Poppins_300Light,
    'Poppins-Regular': Poppins_400Regular,
    'Poppins-Medium': Poppins_500Medium,
    'Poppins-SemiBold': Poppins_600SemiBold,
    'Poppins-Bold': Poppins_700Bold,
  });

  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      if (Platform.OS !== 'web') {
        SplashScreen.hideAsync().catch(() => {});
      }
      setReady(true);
    }
    // Web safety fallback: immediately render even if Google Fonts CDN is slow or offline
    const timer = setTimeout(() => {
      if (Platform.OS !== 'web') {
        SplashScreen.hideAsync().catch(() => {});
      }
      setReady(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [fontsLoaded, fontError]);

  if (!ready && !fontsLoaded && !fontError && Platform.OS !== 'web') {
    return null;
  }

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <GestureHandlerRootView style={styles.flex}>
        <AppErrorBoundary>
          <AuthProvider>
            <TripProvider>
              <PaperProvider theme={isDark ? paperDarkTheme : paperLightTheme}>
                <MainNavigator />
              </PaperProvider>
            </TripProvider>
          </AuthProvider>
        </AppErrorBoundary>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#0D0D14',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorTitle: {
    color: '#EF4444',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  errorMessage: {
    color: '#CBD5E1',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 500,
  },
  retryButton: {
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
