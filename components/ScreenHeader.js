import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../ThemeContext';

export default function ScreenHeader({ eyebrow, title, subtitle, action }) {
  const { theme } = useTheme();
  const styles = StyleSheet.create({
    header: { marginBottom: 24, gap: 8 },
    eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 2, color: theme.colors.textMuted },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    title: { ...theme.typography.h1, color: theme.colors.textPrimary, flex: 1 },
    subtitle: { ...theme.typography.body, color: theme.colors.textSecondary },
  });
  return (
    <View style={styles.header}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        {action}
      </View>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}
