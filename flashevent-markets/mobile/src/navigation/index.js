import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import RootNavigator from './RootNavigator';
import linking from './linking';
import { colors } from '../styles/theme';

// React Navigation theme with proper fonts configuration
const navigationTheme = {
  dark: true,
  colors: {
    primary: colors.primary,
    background: colors.background,
    card: colors.backgroundCard,
    text: colors.text,
    border: colors.border,
    notification: colors.primary,
  },
  fonts: {
    regular: {
      fontFamily: 'System',
      fontWeight: '400',
    },
    medium: {
      fontFamily: 'System',
      fontWeight: '500',
    },
    bold: {
      fontFamily: 'System',
      fontWeight: '700',
    },
    heavy: {
      fontFamily: 'System',
      fontWeight: '900',
    },
  },
};

export default function Navigation() {
  const isLoading = useAuthStore((state) => state.isLoading);

  if (isLoading) {
    // You could show a loading screen here
    return null;
  }

  return (
    <NavigationContainer
      linking={linking}
      theme={navigationTheme}
    >
      <RootNavigator />
    </NavigationContainer>
  );
}
