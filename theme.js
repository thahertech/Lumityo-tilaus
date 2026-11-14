const typography = {
  h1: { fontSize: 30, fontWeight: '700', lineHeight: 38, letterSpacing: -0.6 },
  h2: { fontSize: 26, fontWeight: '700', lineHeight: 34, letterSpacing: -0.4 },
  h3: { fontSize: 21, fontWeight: '600', lineHeight: 29 },
  body: { fontSize: 17, fontWeight: '400', lineHeight: 25 },
  bodyLarge: { fontSize: 19, fontWeight: '400', lineHeight: 28 },
  button: { fontSize: 17, fontWeight: '600', lineHeight: 24 },
  caption: { fontSize: 14, fontWeight: '400', lineHeight: 21 },
};

const common = {
  typography,
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  borderRadius: { sm: 8, md: 14, lg: 20, xl: 24, round: 50 },
};

export const lightTheme = {
  ...common,
  mode: 'light',
  colors: {
    accent: '#4C84AF', onPrimary: '#FFFFFF', primary: '#4C84AF', primaryDark: '#376F9A', primaryLight: '#4C84AF',
    background: '#F3F6F9', surface: '#FFFFFF', surfaceRaised: '#EAF0F5',
    input: '#FFFFFF', inputDisabled: '#F0F3F6', overlay: 'rgba(243, 246, 249, 0.96)',
    textPrimary: '#1C2933', textSecondary: '#52616D', textLight: '#1C2933', textMuted: '#71808C',
    glass: '#FFFFFF', glassBorder: '#D9E1E8',
    success: '#2E7D5B', warning: '#A66B18', error: '#B43C3C', info: '#3F79A6',
    buttonActive: '#376F9A', buttonHover: '#E3EDF4', buttonDisabled: '#C8D1D9',
    border: '#D3DDE5', borderLight: '#E3E9EE',
  },
  shadows: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.10, shadowRadius: 6, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 12, elevation: 3 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 18, elevation: 4 },
  },
};

export const darkTheme = {
  ...lightTheme,
  mode: 'dark',
  colors: {
    accent: '#86AEC7', onPrimary: '#111111', primary: '#EEEEEE', primaryDark: '#D8D8D8', primaryLight: '#D4D4D4',
    background: '#0C0C0C', surface: '#181818', surfaceRaised: '#242424',
    input: '#111111', inputDisabled: '#202020', overlay: 'rgba(12, 12, 12, 0.94)',
    textPrimary: '#F5F5F5', textSecondary: '#C6C6C6', textLight: '#FFFFFF', textMuted: '#A0A0A0',
    glass: '#181818', glassBorder: '#3B3B3B',
    success: '#E0E0E0', warning: '#C6C6C6', error: '#B8B8B8', info: '#D4D4D4',
    buttonActive: '#EEEEEE', buttonHover: '#D8D8D8', buttonDisabled: '#3B3B3B',
    border: '#3B3B3B', borderLight: '#2C2C2C',
  },
};

export const theme = lightTheme;

export const createGlassStyle = (backgroundColor = theme.colors.surface, colors = theme.colors) => ({
  backgroundColor, borderWidth: 1, borderColor: colors.border,
});
export const createButtonStyle = (variant = 'primary', colors = theme.colors) => ({
  borderRadius: theme.borderRadius.md, paddingVertical: 16, paddingHorizontal: 24,
  alignItems: 'center', justifyContent: 'center', minHeight: 56,
  backgroundColor: variant === 'primary' ? colors.primary : colors.surfaceRaised,
  ...(variant !== 'primary' && { borderWidth: 1, borderColor: colors.border }),
});
export const createCardStyle = (currentTheme = theme) => ({
  backgroundColor: currentTheme.colors.surface, borderRadius: currentTheme.borderRadius.lg,
  padding: 20, borderWidth: 1, borderColor: currentTheme.colors.borderLight,
  ...theme.shadows.sm,
});
export default theme;
