import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './Navigation/AppNavigator';
import { ThemeProvider, useTheme } from './ThemeContext';

function ThemedApp() {
  const { mode } = useTheme();
  return (
    <SafeAreaProvider>
      <StatusBar style={mode === 'light' ? 'dark' : 'light'} />
      <AppNavigator />
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
}