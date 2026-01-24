import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, spacing } from '../../styles/theme';

export default function Card({
  children,
  variant = 'default', // 'default' | 'elevated' | 'outlined'
  padding = 'md', // 'none' | 'sm' | 'md' | 'lg'
  style,
  ...props
}) {
  const getPaddingValue = () => {
    switch (padding) {
      case 'none':
        return 0;
      case 'sm':
        return spacing.sm;
      case 'lg':
        return spacing.lg;
      default:
        return spacing.cardPadding;
    }
  };

  const getVariantStyle = () => {
    switch (variant) {
      case 'elevated':
        return styles.elevated;
      case 'outlined':
        return styles.outlined;
      default:
        return styles.default;
    }
  };

  return (
    <View
      style={[
        styles.container,
        getVariantStyle(),
        { padding: getPaddingValue() },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: spacing.cardBorderRadius,
  },
  default: {
    backgroundColor: colors.backgroundCard,
  },
  elevated: {
    backgroundColor: colors.backgroundElevated,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  outlined: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
});
