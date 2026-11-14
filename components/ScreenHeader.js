import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../ThemeContext';

export const SCREEN_TOP_SPACING = 24;
export const screenLayout = StyleSheet.create({
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 20 },
});

export default function ScreenHeader({ title, subtitle, action }) {
  const { theme } = useTheme();
  const styles = StyleSheet.create({
    header: { marginBottom: 24, gap: 8 },
    titleRow: { flexDirection: 'row', alignItems: 'center' },
    title: { ...theme.typography.h2, color: theme.colors.textPrimary, flex: 1 },
    titleWithAction: { paddingRight: 60 },
    action: { position: 'absolute', right: 0, top: 0, bottom: 0, justifyContent: 'center' },
    subtitle: { ...theme.typography.body, color: theme.colors.textPrimary },
  });
  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text accessibilityRole="header" style={[styles.title, action && styles.titleWithAction]}>{title}</Text>
        {action && <View style={styles.action}>{action}</View>}
      </View>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}
