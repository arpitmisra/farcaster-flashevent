import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { colors, typography, spacing } from '../../styles/theme';

export default function Toast({
  visible,
  message,
  type = 'info', // 'success' | 'error' | 'warning' | 'info'
  duration = 3000,
  onHide,
  position = 'bottom', // 'top' | 'bottom'
}) {
  const translateY = useRef(new Animated.Value(position === 'top' ? -100 : 100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Show toast
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-hide after duration
      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: position === 'top' ? -100 : 100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide && onHide();
    });
  };

  const getTypeStyle = () => {
    switch (type) {
      case 'success':
        return { backgroundColor: colors.success, icon: '✓' };
      case 'error':
        return { backgroundColor: colors.error, icon: '✕' };
      case 'warning':
        return { backgroundColor: colors.warning, icon: '⚠' };
      default:
        return { backgroundColor: colors.info, icon: 'ℹ' };
    }
  };

  const typeStyle = getTypeStyle();

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        position === 'top' ? styles.top : styles.bottom,
        { backgroundColor: typeStyle.backgroundColor },
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <Text style={styles.icon}>{typeStyle.icon}</Text>
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.screenHorizontal,
    right: spacing.screenHorizontal,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: spacing.cardBorderRadius,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  top: {
    top: 50,
  },
  bottom: {
    bottom: 100,
  },
  icon: {
    fontSize: 18,
    color: colors.white,
    marginRight: spacing.sm,
  },
  message: {
    ...typography.styles.body,
    color: colors.white,
    flex: 1,
  },
});
