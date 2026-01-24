import colors from './colors';
import typographyConfig from './typography';
import spacing from './spacing';

// Flatten typography styles for easy access
// This allows using typography.h1, typography.bold, etc. directly
const typography = {
  ...typographyConfig,
  // Direct access to styles
  h1: typographyConfig.styles?.h1 || { fontSize: 36, fontWeight: '700', lineHeight: 40 },
  h2: typographyConfig.styles?.h2 || { fontSize: 30, fontWeight: '700', lineHeight: 36 },
  h3: typographyConfig.styles?.h3 || { fontSize: 24, fontWeight: '600', lineHeight: 30 },
  h4: typographyConfig.styles?.h4 || { fontSize: 20, fontWeight: '600', lineHeight: 26 },
  h5: typographyConfig.styles?.h5 || { fontSize: 18, fontWeight: '600', lineHeight: 24 },
  h6: typographyConfig.styles?.h6 || { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  body: typographyConfig.styles?.body || { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  bodyLarge: typographyConfig.styles?.bodyLarge || { fontSize: 18, fontWeight: '400', lineHeight: 27 },
  bodySmall: typographyConfig.styles?.bodySmall || { fontSize: 14, fontWeight: '400', lineHeight: 21 },
  caption: typographyConfig.styles?.caption || { fontSize: 12, fontWeight: '400', lineHeight: 17 },
  label: typographyConfig.styles?.label || { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  button: typographyConfig.styles?.button || { fontSize: 16, fontWeight: '600', lineHeight: 20 },
  // Font weight shortcuts
  bold: { fontWeight: '700' },
  semiBold: { fontWeight: '600' },
  medium: { fontWeight: '500' },
  regular: { fontWeight: '400' },
};

// Complete theme object
const theme = {
  colors,
  typography,
  spacing,
  
  // Shadows
  shadows: {
    none: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    sm: {
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 4,
    },
    lg: {
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    xl: {
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 16,
    },
    glow: {
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 16,
      elevation: 8,
    },
  },
  
  // Border radius
  borderRadius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    '2xl': 24,
    '3xl': 32,
    full: 9999,
  },
  
  // Animation durations
  animation: {
    fast: 150,
    normal: 300,
    slow: 500,
  },
  
  // Z-index scale
  zIndex: {
    base: 0,
    dropdown: 1000,
    sticky: 1100,
    fixed: 1200,
    modalBackdrop: 1300,
    modal: 1400,
    popover: 1500,
    tooltip: 1600,
    toast: 1700,
  },
};

export default theme;
export { colors, typography, spacing };
