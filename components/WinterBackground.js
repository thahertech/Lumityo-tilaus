import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../ThemeContext';
import mountains from '../assets/Mountains.jpg';

export default function WinterBackground({ overlayColor, centerOverlayColor }) {
  const { theme } = useTheme();
  const edgeColor = overlayColor ?? theme.colors.overlay;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image source={mountains} style={styles.image} resizeMode="cover" />
      {centerOverlayColor
        ? <LinearGradient colors={[edgeColor, centerOverlayColor, edgeColor]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
        : <View style={[StyleSheet.absoluteFill, { backgroundColor: edgeColor }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', height: '100%' },
});
