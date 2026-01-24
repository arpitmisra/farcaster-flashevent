import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';

// Screens
import HomeScreen from '../screens/home/HomeScreen';
import CreateMarketScreen from '../screens/create/CreateMarketScreen';
import TemplateSelectScreen from '../screens/create/TemplateSelectScreen';
import ConfirmMarketScreen from '../screens/create/ConfirmMarketScreen';
import MyBetsScreen from '../screens/bets/MyBetsScreen';
import BetDetailScreen from '../screens/bets/BetDetailScreen';
import SocialFeedScreen from '../screens/social/SocialFeedScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import MetaMaskWalletScreen from '../screens/wallet/MetaMaskWalletScreen';
import PriceFeedScreen from '../screens/prices/PriceFeedScreen';

import { colors, spacing } from '../styles/theme';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Tab icons component
const TabIcon = ({ name, focused }) => {
  const icons = {
    Home: '🏠',
    Create: '➕',
    MyBets: '📋',
    Wallet: '💳',
    Prices: '📈',
    Social: '👥',
    Profile: '👤',
  };

  return (
    <View style={[styles.iconContainer, focused && styles.iconFocused]}>
      <Text style={[styles.iconEmoji, focused && styles.iconEmojiActive]}>
        {icons[name]}
      </Text>
    </View>
  );
};

// Create Market Stack
function CreateStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen
        name="CreateMarketMain"
        component={CreateMarketScreen}
        options={{ title: 'Create Market' }}
      />
      <Stack.Screen
        name="TemplateSelect"
        component={TemplateSelectScreen}
        options={{ title: 'Select Template' }}
      />
      <Stack.Screen
        name="ConfirmMarket"
        component={ConfirmMarketScreen}
        options={{ title: 'Confirm Market' }}
      />
    </Stack.Navigator>
  );
}

// My Bets Stack
function MyBetsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen
        name="MyBetsMain"
        component={MyBetsScreen}
        options={{ title: 'My Bets' }}
      />
      <Stack.Screen
        name="BetDetail"
        component={BetDetailScreen}
        options={{ title: 'Bet Details' }}
      />
    </Stack.Navigator>
  );
}

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
        headerStyle: {
          backgroundColor: colors.background,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: colors.text,
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: '⚡ FlashEvent',
          tabBarLabel: 'Home',
        }}
      />
      <Tab.Screen
        name="Create"
        component={CreateStack}
        options={{
          headerShown: false,
          tabBarLabel: 'Create',
        }}
      />
      <Tab.Screen
        name="MyBets"
        component={MyBetsStack}
        options={{
          headerShown: false,
          tabBarLabel: 'My Bets',
        }}
      />
      <Tab.Screen
        name="Wallet"
        component={MetaMaskWalletScreen}
        options={{
          title: '💳 Wallet',
          tabBarLabel: 'Wallet',
        }}
      />
      <Tab.Screen
        name="Prices"
        component={PriceFeedScreen}
        options={{
          title: '📈 Prices',
          tabBarLabel: 'Prices',
        }}
      />
      <Tab.Screen
        name="Social"
        component={SocialFeedScreen}
        options={{
          title: '🔮 Social Feed',
          tabBarLabel: 'Social',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.backgroundCard,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 90 : 70,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 8,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  tabBarItem: {
    paddingVertical: 4,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  iconContainer: {
    width: 40,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFocused: {
    transform: [{ scale: 1.1 }],
  },
  iconEmoji: {
    fontSize: 22,
    opacity: 0.7,
  },
  iconEmojiActive: {
    opacity: 1,
    fontSize: 24,
  },
  icon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 20,
  },
});
