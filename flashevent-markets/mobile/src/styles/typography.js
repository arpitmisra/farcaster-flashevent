// Typography configuration
import { Platform } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

const typography = {
  // Font families
  fontFamily: {
    regular: fontFamily,
    medium: fontFamily,
    semiBold: fontFamily,
    bold: fontFamily,
  },
  
  // Font sizes
  fontSize: {
    xs: 10,
    sm: 12,
    base: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
  },
  
  // Line heights
  lineHeight: {
    tight: 1.1,
    snug: 1.25,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },
  
  // Font weights
  fontWeight: {
    regular: '400',
    medium: '500',
    semiBold: '600',
    bold: '700',
    extraBold: '800',
  },
  
  // Letter spacing
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 1,
  },
  
  // Pre-defined text styles
  styles: {
    // Headings
    h1: {
      fontSize: 36,
      fontWeight: '700',
      lineHeight: 40,
      letterSpacing: -0.5,
    },
    h2: {
      fontSize: 30,
      fontWeight: '700',
      lineHeight: 36,
      letterSpacing: -0.5,
    },
    h3: {
      fontSize: 24,
      fontWeight: '600',
      lineHeight: 30,
    },
    h4: {
      fontSize: 20,
      fontWeight: '600',
      lineHeight: 26,
    },
    h5: {
      fontSize: 18,
      fontWeight: '600',
      lineHeight: 24,
    },
    h6: {
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 22,
    },
    
    // Body text
    bodyLarge: {
      fontSize: 18,
      fontWeight: '400',
      lineHeight: 27,
    },
    body: {
      fontSize: 16,
      fontWeight: '400',
      lineHeight: 24,
    },
    bodySmall: {
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 21,
    },
    
    // Captions
    caption: {
      fontSize: 12,
      fontWeight: '400',
      lineHeight: 17,
    },
    captionSmall: {
      fontSize: 10,
      fontWeight: '400',
      lineHeight: 14,
    },
    
    // Labels
    label: {
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 20,
      letterSpacing: 0.5,
    },
    labelSmall: {
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 17,
      letterSpacing: 0.5,
    },
    
    // Buttons
    button: {
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 20,
      letterSpacing: 0.5,
    },
    buttonSmall: {
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 17,
      letterSpacing: 0.5,
    },
    
    // Numbers (for odds, amounts, etc.)
    number: {
      fontSize: 24,
      fontWeight: '700',
      lineHeight: 29,
    },
    numberLarge: {
      fontSize: 36,
      fontWeight: '700',
      lineHeight: 40,
    },
    numberSmall: {
      fontSize: 18,
      fontWeight: '600',
      lineHeight: 22,
    },
  },
};

export default typography;
