export const fonts = {
  regular: 'SourceSans3_400Regular',
  italic: 'SourceSans3_400Regular_Italic',
  medium: 'SourceSans3_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
};

export const typography = {
  h1: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 38, letterSpacing: -0.5 },
  h2: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 34, letterSpacing: -0.4 },
  h3: { fontFamily: fonts.semibold, fontSize: 21, lineHeight: 29, letterSpacing: -0.2 },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 25, letterSpacing: -0.1 },
  body: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 26 },
  bodySmall: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  label: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  bodyLarge: { fontFamily: fonts.regular, fontSize: 19, lineHeight: 28 },
  button: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 24 },
  caption: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21 },
};

const common = {
  fonts,
  typography,
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  borderRadius: { sm: 8, md: 14, lg: 20, xl: 24, round: 50 },
};

export const lightTheme = {
  ...common,
  mode: 'light',
  colors: {
    accent: '#FFFFFF', onPrimary: '#FFFFFF', primary: '#28669B', primaryDark: '#20547F', primaryLight: '#FFFFFF',
    background: '#171717', surface: 'rgba(255, 255, 255, 0.22)', surfaceRaised: '#F7F7F7',
    panel: '#303030', homeSurface: 'rgba(20, 20, 20, 0.84)', input: '#E8E8E8', orderSurface: '#E8E8E8', inputDisabled: '#E9E9E9', overlay: 'rgba(0, 0, 0, 0.72)', homeOverlay: 'rgba(0, 0, 0, 0.350784)', homeCenterOverlay: 'rgba(0, 0, 0, 0.20)',
    controlText: '#202020', controlSecondary: '#505050', controlIcon: '#505050',
    controlBorder: '#A9A9A9', controlSelected: '#E8E8E8', inputPlaceholder: '#555555',
    textPrimary: '#FFFFFF', textSecondary: '#F7F7F7', textLight: '#FFFFFF', textMuted: '#F7F7F7',
    glass: 'rgba(255, 255, 255, 0.22)', glassBorder: 'rgba(255,255,255,0.28)',
    success: '#F0FFF7', warning: '#FFF8EC', error: '#FFF1F1', info: '#F7F7F7',
    buttonActive: '#20547F', buttonHover: '#E8E8E8', buttonDisabled: '#777777',
    border: 'rgba(255,255,255,0.30)', borderLight: 'rgba(255,255,255,0.24)',
    navigationBackground: '#F8F8F8', navigationActive: '#202020', navigationInactive: '#555555', navigationBorder: '#D8D8D8',
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
    accent: '#FFFFFF', onPrimary: '#FFFFFF', primary: '#28669B', primaryDark: '#20547F', primaryLight: '#FFFFFF',
    background: '#111111', surface: 'rgba(46, 46, 46, 0.82)', surfaceRaised: '#E2E2E2',
    panel: '#292929', homeSurface: 'rgba(20, 20, 20, 0.84)', input: '#EEEEEE', orderSurface: '#C8C8C8', inputDisabled: '#CCCCCC', overlay: 'rgba(0, 0, 0, 0.68)', homeOverlay: 'rgba(0, 0, 0, 0.55)', homeCenterOverlay: 'rgba(0, 0, 0, 0.25)',
    controlText: '#202020', controlSecondary: '#454545', controlIcon: '#454545',
    controlBorder: '#A0A0A0', controlSelected: '#C8C8C8', inputPlaceholder: '#505050',
    textPrimary: '#FFFFFF', textSecondary: '#F0F0F0', textLight: '#FFFFFF', textMuted: '#E4E4E4',
    glass: 'rgba(46, 46, 46, 0.82)', glassBorder: 'rgba(255,255,255,0.20)',
    success: '#A0ECC6', warning: '#F4DBAC', error: '#FFB7B7', info: '#E4E4E4',
    buttonActive: '#20547F', buttonHover: '#D1D1D1', buttonDisabled: '#777777',
    border: 'rgba(255,255,255,0.24)', borderLight: 'rgba(255,255,255,0.16)',
    navigationBackground: '#262626', navigationActive: '#FFFFFF', navigationInactive: '#D0D0D0', navigationBorder: 'rgba(255,255,255,0.20)',
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
  ...(variant !== 'primary' && { borderWidth: 1, borderColor: colors.controlBorder }),
});
export const createCardStyle = (currentTheme = theme) => ({
  backgroundColor: currentTheme.colors.surface, borderRadius: currentTheme.borderRadius.lg,
  padding: 20, borderWidth: 1, borderColor: currentTheme.colors.borderLight,
  ...currentTheme.shadows.sm,
});
export default theme;
