import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SourceSans3_400Regular } from '@expo-google-fonts/source-sans-3/400Regular';
import { SourceSans3_400Regular_Italic } from '@expo-google-fonts/source-sans-3/400Regular_Italic';
import { SourceSans3_500Medium } from '@expo-google-fonts/source-sans-3/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { Geist_700Bold } from '@expo-google-fonts/geist/700Bold';
import AppNavigator from './Navigation/AppNavigator';
import { ThemeProvider } from './ThemeContext';

function ThemedApp() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    SourceSans3_400Regular,
    SourceSans3_400Regular_Italic,
    SourceSans3_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
  });

  useEffect(() => {
    if (fontError) console.error('Unable to load app fonts:', fontError);
  }, [fontError]);

  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: '#171717', justifyContent: 'center' }}><ActivityIndicator color="#FFFFFF" /></View>;
  }

  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
}