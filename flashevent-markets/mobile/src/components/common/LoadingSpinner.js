import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../../styles/theme';

export default function LoadingSpinner({
  size = 'medium', // 'small' | 'medium' | 'large'
  color = colors.primary,
  text,
  fullScreen = false,
  style,
}) {
  const getSize = () => {
    switch (size) {
      case 'small':
        return 'small';
      case 'large':
        return 'large';
      default:
        return 'large';
    }
  };

  const content = (
    <View style={[styles.container, style]}>
      <ActivityIndicator size={getSize()} color={color} />
      {text && <Text style={styles.text}>{text}</Text>}
    </View>
  );

  if (fullScreen) {
    return <View style={styles.fullScreen}>{content}</View>;
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  fullScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  text: {
    ...typography.styles.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
});
