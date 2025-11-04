// Global theme configuration for elder-friendly blue design
export const theme = {
  // Primary colors - Blue palette
  colors: {
    primary: '#4c84af',          // Main blue from tab bar
    primaryDark: '#2c5282',      // Darker blue for contrast
    primaryLight: '#6bb6ff',     // Lighter blue for accents
    
    // Neutral colors for optimal elder accessibility
    background: '#f8fafc',       // Very light gray background
    surface: '#ffffff',          // Pure white for cards/surfaces
    overlay: 'rgba(0, 0, 0, 0.6)', // Dark overlay for text readability
    
    // Text colors with high contrast
    textPrimary: '#1a202c',      // Very dark gray for primary text
    textSecondary: '#4a5568',    // Medium gray for secondary text
    textLight: '#ffffff',        // White text for dark backgrounds
    textMuted: '#718096',        // Muted text for less important info
    
    // Glass effect colors
    glass: 'rgba(255, 255, 255, 0.15)',
    glassBorder: 'rgba(255, 255, 255, 0.2)',
    
    // Status colors (blue variations only)
    success: '#4c84af',          // Use primary blue for success
    warning: '#2c5282',          // Use dark blue for warnings  
    error: '#1e3a8a',            // Use darkest blue for errors
    info: '#6bb6ff',             // Use light blue for info
    
    // Interactive states
    buttonActive: '#4c84af',
    buttonHover: '#2c5282',
    buttonDisabled: '#a0aec0',
    
    // Border colors
    border: 'rgba(0, 0, 0, 0.1)',
    borderLight: 'rgba(0, 0, 0, 0.05)',
  },
  
  // Typography optimized for elder users
  typography: {
    // Larger font sizes for better readability
    h1: {
      fontSize: 32,
      fontWeight: 'bold',
      lineHeight: 40,
    },
    h2: {
      fontSize: 28,
      fontWeight: 'bold', 
      lineHeight: 36,
    },
    h3: {
      fontSize: 24,
      fontWeight: '600',
      lineHeight: 32,
    },
    body: {
      fontSize: 18,
      fontWeight: '400',
      lineHeight: 26,
    },
    bodyLarge: {
      fontSize: 20,
      fontWeight: '400',
      lineHeight: 28,
    },
    button: {
      fontSize: 18,
      fontWeight: '600',
      lineHeight: 24,
    },
    caption: {
      fontSize: 16,
      fontWeight: '400',
      lineHeight: 22,
    },
  },
  
  // Spacing system
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  
  // Border radius
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    round: 50,
  },
  
  // Shadows for depth
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 8,
    },
  },
};

// Helper functions for consistent styling
export const createGlassStyle = (backgroundColor = theme.colors.glass) => ({
  backgroundColor,
  borderWidth: 1,
  borderColor: theme.colors.glassBorder,
  backdropFilter: 'blur(10px)',
});

export const createButtonStyle = (variant = 'primary') => {
  const baseStyle = {
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56, // Larger touch targets for elder users
    ...theme.shadows.sm,
  };
  
  switch (variant) {
    case 'primary':
      return {
        ...baseStyle,
        backgroundColor: theme.colors.primary,
      };
    case 'secondary':
      return {
        ...baseStyle,
        backgroundColor: theme.colors.surface,
        borderWidth: 2,
        borderColor: theme.colors.primary,
      };
    case 'ghost':
      return {
        ...baseStyle,
        backgroundColor: 'transparent',
        ...createGlassStyle(),
      };
    default:
      return baseStyle;
  }
};

export const createCardStyle = () => ({
  backgroundColor: theme.colors.surface,
  borderRadius: theme.borderRadius.lg,
  padding: theme.spacing.lg,
  ...theme.shadows.md,
  borderWidth: 1,
  borderColor: theme.colors.borderLight,
});

export default theme;