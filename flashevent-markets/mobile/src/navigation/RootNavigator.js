import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuthStore } from '../store/authStore';

// Auth screens
import SplashScreen from '../screens/auth/SplashScreen';
import FarcasterAuthScreen from '../screens/auth/FarcasterAuthScreen';

// Main tab navigator
import MainTabNavigator from './MainTabNavigator';

// Stack screens (accessible from any tab)
import MarketDetailScreen from '../screens/home/MarketDetailScreen';
import UserProfileScreen from '../screens/social/UserProfileScreen';
import SettingsScreen from '../screens/profile/SettingsScreen';
import MetaMaskWalletScreen from '../screens/wallet/MetaMaskWalletScreen';

import { colors } from '../styles/theme';

const Stack = createStackNavigator();

const defaultScreenOptions = {
  headerStyle: {
    backgroundColor: colors.background,
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 0,
  },
  headerTintColor: colors.text,
  headerTitleStyle: {
    fontWeight: '600',
    fontSize: 18,
  },
  headerBackTitleVisible: false,
  cardStyle: {
    backgroundColor: colors.background,
  },
};

export default function RootNavigator() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <Stack.Navigator screenOptions={defaultScreenOptions}>
      {!isAuthenticated ? (
        // Auth flow
        <>
          <Stack.Screen
            name="Splash"
            component={SplashScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="FarcasterAuth"
            component={FarcasterAuthScreen}
            options={{ headerShown: false }}
          />
        </>
      ) : (
        // Main app
        <>
          <Stack.Screen
            name="Main"
            component={MainTabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="MarketDetail"
            component={MarketDetailScreen}
            options={{
              title: 'Market',
              presentation: 'card',
            }}
          />
          <Stack.Screen
            name="UserProfile"
            component={UserProfileScreen}
            options={({ route }) => ({
              title: route.params?.username || 'Profile',
            })}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: 'Settings' }}
          />
          <Stack.Screen
            name="MetaMaskWallet"
            component={MetaMaskWalletScreen}
            options={{ title: '🦊 MetaMask Wallet' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
