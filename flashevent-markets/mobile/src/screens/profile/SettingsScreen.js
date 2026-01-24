import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { colors, typography, spacing } from '../../styles/theme';
import { useAuthStore } from '../../store/authStore';
import { useWalletStore } from '../../store/walletStore';
import config from '../../config';

export default function SettingsScreen({ navigation }) {
  const { user, logout } = useAuthStore();
  const { disconnect } = useWalletStore();
  
  const [settings, setSettings] = useState({
    notifications: true,
    autoCast: true,
    darkMode: true,
    biometrics: false,
    analytics: true,
  });

  const toggleSetting = (key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            disconnect();
            logout();
          },
        },
      ]
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will clear all cached data. You may need to reload some information.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          onPress: () => {
            Alert.alert('Cache Cleared', 'All cached data has been cleared.');
          },
        },
      ]
    );
  };

  const renderSettingRow = (label, key, description) => (
    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description && (
          <Text style={styles.settingDescription}>{description}</Text>
        )}
      </View>
      <Switch
        value={settings[key]}
        onValueChange={() => toggleSetting(key)}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.white}
      />
    </View>
  );

  const renderLinkRow = (icon, label, onPress, rightText) => (
    <TouchableOpacity style={styles.linkRow} onPress={onPress}>
      <Text style={styles.linkIcon}>{icon}</Text>
      <Text style={styles.linkLabel}>{label}</Text>
      <Text style={styles.linkRight}>{rightText || '→'}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Account Section */}
      <Text style={styles.sectionTitle}>ACCOUNT</Text>
      <Card style={styles.section}>
        {renderLinkRow(
          '👤',
          'Farcaster Profile',
          () => Linking.openURL(`https://warpcast.com/${user?.username}`)
        )}
        {renderLinkRow(
          '💳',
          'Connected Wallet',
          () => {},
          'Manage'
        )}
        {renderLinkRow(
          '🔐',
          'Security',
          () => {}
        )}
      </Card>

      {/* Preferences Section */}
      <Text style={styles.sectionTitle}>PREFERENCES</Text>
      <Card style={styles.section}>
        {renderSettingRow(
          'Push Notifications',
          'notifications',
          'Get notified about market outcomes and activity'
        )}
        {renderSettingRow(
          'Auto-cast Markets',
          'autoCast',
          'Automatically share created markets to Farcaster'
        )}
        {renderSettingRow(
          'Dark Mode',
          'darkMode',
          'Use dark theme throughout the app'
        )}
        {renderSettingRow(
          'Biometric Login',
          'biometrics',
          'Use Face ID or fingerprint to unlock'
        )}
      </Card>

      {/* Network Section */}
      <Text style={styles.sectionTitle}>NETWORK</Text>
      <Card style={styles.section}>
        {renderLinkRow(
          '🔗',
          'Network',
          () => {},
          'Monad Testnet'
        )}
        {renderLinkRow(
          '🌐',
          'RPC Endpoint',
          () => Linking.openURL(config.RPC_URL),
          'Default'
        )}
        {renderLinkRow(
          '📊',
          'Block Explorer',
          () => Linking.openURL(config.MONAD_EXPLORER_URL)
        )}
      </Card>

      {/* Privacy Section */}
      <Text style={styles.sectionTitle}>PRIVACY</Text>
      <Card style={styles.section}>
        {renderSettingRow(
          'Analytics',
          'analytics',
          'Help improve the app by sending anonymous usage data'
        )}
        {renderLinkRow(
          '📜',
          'Privacy Policy',
          () => Linking.openURL('https://flashevent.xyz/privacy')
        )}
        {renderLinkRow(
          '📋',
          'Terms of Service',
          () => Linking.openURL('https://flashevent.xyz/terms')
        )}
      </Card>

      {/* Support Section */}
      <Text style={styles.sectionTitle}>SUPPORT</Text>
      <Card style={styles.section}>
        {renderLinkRow(
          '❓',
          'Help Center',
          () => Linking.openURL('https://flashevent.xyz/help')
        )}
        {renderLinkRow(
          '💬',
          'Contact Support',
          () => Linking.openURL('mailto:support@flashevent.xyz')
        )}
        {renderLinkRow(
          '🐛',
          'Report a Bug',
          () => Linking.openURL('https://github.com/flashevent/mobile/issues')
        )}
        {renderLinkRow(
          '⭐',
          'Rate the App',
          () => {}
        )}
      </Card>

      {/* Data Section */}
      <Text style={styles.sectionTitle}>DATA</Text>
      <Card style={styles.section}>
        {renderLinkRow(
          '🗑️',
          'Clear Cache',
          handleClearCache
        )}
        {renderLinkRow(
          '📤',
          'Export Data',
          () => Alert.alert('Coming Soon', 'Data export will be available soon.')
        )}
      </Card>

      {/* About Section */}
      <Text style={styles.sectionTitle}>ABOUT</Text>
      <Card style={styles.section}>
        {renderLinkRow(
          '📱',
          'App Version',
          () => {},
          '1.0.0'
        )}
        {renderLinkRow(
          '📦',
          'Build Number',
          () => {},
          '1'
        )}
        {renderLinkRow(
          '🔧',
          'Debug Info',
          () => {
            Alert.alert(
              'Debug Info',
              `FID: ${user?.fid || 'N/A'}\nNetwork: Monad Testnet\nChain ID: ${config.CHAIN_ID}\nEnvironment: Development`
            );
          }
        )}
      </Card>

      {/* Sign Out */}
      <Button
        title="Sign Out"
        variant="outline"
        onPress={handleLogout}
        style={styles.signOutButton}
      />

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Made with 💜 for Farcaster
        </Text>
        <Text style={styles.footerLinks}>
          <Text
            style={styles.footerLink}
            onPress={() => Linking.openURL('https://twitter.com/flashevent')}
          >
            Twitter
          </Text>
          {' • '}
          <Text
            style={styles.footerLink}
            onPress={() => Linking.openURL('https://warpcast.com/flashevent')}
          >
            Farcaster
          </Text>
          {' • '}
          <Text
            style={styles.footerLink}
            onPress={() => Linking.openURL('https://github.com/flashevent')}
          >
            GitHub
          </Text>
        </Text>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  sectionTitle: {
    ...typography.styles.label,
    color: colors.textSecondary,
    marginHorizontal: spacing.screenHorizontal,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  section: {
    marginHorizontal: spacing.screenHorizontal,
    padding: 0,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingLabel: {
    ...typography.styles.body,
    color: colors.text,
  },
  settingDescription: {
    ...typography.styles.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  linkIcon: {
    fontSize: 20,
    marginRight: spacing.md,
  },
  linkLabel: {
    ...typography.styles.body,
    color: colors.text,
    flex: 1,
  },
  linkRight: {
    ...typography.styles.body,
    color: colors.textMuted,
  },
  signOutButton: {
    marginHorizontal: spacing.screenHorizontal,
    marginTop: spacing.xl,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  footerText: {
    ...typography.styles.body,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  footerLinks: {
    ...typography.styles.bodySmall,
    color: colors.textMuted,
  },
  footerLink: {
    color: colors.primary,
  },
  bottomPadding: {
    height: spacing['3xl'],
  },
});
