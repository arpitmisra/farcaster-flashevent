/**
 * MetaMask Wallet Screen - Example Implementation
 * Shows how to integrate MetaMask in your mobile app
 * Now with x402 one-time authorization!
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useMetaMask } from '../../hooks/useMetaMask';
import { useX402 } from '../../hooks/useX402';

const MetaMaskWalletScreen = () => {
  const {
    address,
    isConnected,
    isConnecting,
    connect,
    disconnect,
    forceReconnect,
    checkInstallation,
    switchToMonadNetwork,
    getSessionInfo,
  } = useMetaMask();

  // x402 pre-authorization hook
  const {
    isAuthorized,
    isAuthorizing,
    authStatus,
    authorize,
    revokeAuthorization,
    getRemainingLimit,
    getTimeUntilExpiry,
  } = useX402();

  const [isMetaMaskInstalled, setIsMetaMaskInstalled] = useState(null);
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  const [wasConnecting, setWasConnecting] = useState(false);

  // Check MetaMask installation on mount
  useEffect(() => {
    checkMetaMaskStatus();
  }, []);

  // Show success alert only after connection is actually established
  useEffect(() => {
    if (wasConnecting && isConnected && address) {
      Alert.alert('✅ Success', 'MetaMask connected successfully!');
      setWasConnecting(false);
    }
  }, [isConnected, address, wasConnecting]);

  const checkMetaMaskStatus = async () => {
    try {
      const installed = await checkInstallation();
      setIsMetaMaskInstalled(installed);
    } catch (error) {
      console.error('Error checking MetaMask:', error);
      setIsMetaMaskInstalled(false);
    }
  };

  // Handle x402 authorization (one-time signing)
  const handleAuthorizeX402 = async () => {
    await authorize();
  };

  const handleConnect = async () => {
    try {
      setWasConnecting(true);
      await connect();
      // Don't show success here - wait for isConnected to become true
    } catch (error) {
      setWasConnecting(false);
      // Show friendlier message for timeout
      if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
        Alert.alert(
          '⏱️ Connection Timeout',
          'Please open MetaMask app and approve the connection request. Then try connecting again.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('❌ Connection Failed', error.message);
      }
    }
  };

  const handleDisconnect = () => {
    Alert.alert('Disconnect', 'Are you sure you want to disconnect?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        onPress: () => {
          disconnect();
          revokeAuthorization(); // Also revoke x402 when disconnecting
          Alert.alert('✅ Disconnected', 'Wallet disconnected successfully!');
        },
        style: 'destructive',
      },
    ]);
  };

  // Force reconnect for fixing chain mismatch issues
  const handleForceReconnect = async () => {
    try {
      await forceReconnect();
      Alert.alert('✅ Success', 'Wallet reconnected! You can now authorize x402.');
    } catch (error) {
      Alert.alert('❌ Reconnection Failed', error.message);
    }
  };

  // Switch to Monad network
  const handleSwitchToMonad = async () => {
    try {
      setIsSwitchingNetwork(true);
      const success = await switchToMonadNetwork();
      if (success) {
        Alert.alert('✅ Success', 'Switched to Monad Testnet! Future signing requests will show Monad network.');
      } else {
        Alert.alert('ℹ️ Note', 'Could not switch to Monad network. Signatures will still work correctly, but may show "Ethereum" in MetaMask UI.');
      }
    } catch (error) {
      Alert.alert('ℹ️ Note', 'Could not switch to Monad network. This is okay - signatures will still work correctly.');
    } finally {
      setIsSwitchingNetwork(false);
    }
  };

  // Get current network info
  const getNetworkInfo = () => {
    const info = getSessionInfo?.() || {};
    return {
      currentChain: info.chainIdNumber || 'Unknown',
      isMonad: info.isMonadChain || false,
      targetChain: info.targetChainName || 'Monad Testnet',
    };
  };

  const formatAddress = (addr) => {
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  // Not installed state
  if (isMetaMaskInstalled === false) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.title}>MetaMask Not Found</Text>
          <Text style={styles.description}>
            Please install MetaMask mobile app to connect your wallet.
          </Text>

          <TouchableOpacity
            style={[styles.button, styles.installButton]}
            onPress={() => {
              // In a real app, use Linking to open app store
              Alert.alert(
                'Install MetaMask',
                'Download MetaMask from your app store:\n\n' +
                  '📱 iOS: App Store\n' +
                  '🤖 Android: Google Play'
              );
            }}
          >
            <Text style={styles.buttonText}>📱 Install MetaMask</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Loading state
  if (isMetaMaskInstalled === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#f6851b" />
      </View>
    );
  }

  // Disconnected state
  if (!isConnected) {
    return (
      <View style={styles.container}>
        <ScrollView style={styles.content}>
          <View style={styles.headerCard}>
            <Text style={styles.header}>🦊 MetaMask</Text>
            <Text style={styles.subheader}>Wallet Connection</Text>
          </View>

          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>Status</Text>
            <Text style={[styles.statusBadge, styles.disconnected]}>
              Disconnected
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.button, styles.connectButton]}
            onPress={handleConnect}
            disabled={isConnecting}
          >
            <Text style={styles.buttonText}>
              {isConnecting ? 'Connecting...' : '🔗 Connect MetaMask'}
            </Text>
          </TouchableOpacity>

          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>What you can do:</Text>
            <View style={styles.infoItem}>
              <Text style={styles.infoBullet}>✓</Text>
              <Text style={styles.infoText}>Send and receive crypto</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoBullet}>✓</Text>
              <Text style={styles.infoText}>Sign transactions</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoBullet}>✓</Text>
              <Text style={styles.infoText}>Sign messages</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoBullet}>✓</Text>
              <Text style={styles.infoText}>Manage multiple networks</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Connected state
  const networkInfo = getNetworkInfo();
  
  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.header}>🦊 MetaMask</Text>
          <Text style={styles.subheader}>Connected</Text>
        </View>

        {/* Status */}
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Status</Text>
          <Text style={[styles.statusBadge, styles.connected]}>✓ Connected</Text>
        </View>

        {/* Wallet Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Address:</Text>
            <Text style={styles.infoValue}>{formatAddress(address)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Network:</Text>
            <Text style={[styles.infoValue, !networkInfo.isMonad && { color: '#f5a623' }]}>
              {networkInfo.isMonad ? '✓ Monad Testnet' : `Chain ${networkInfo.currentChain}`}
            </Text>
          </View>
        </View>

        {/* Network Switch Section - show if not on Monad */}
        {!networkInfo.isMonad && (
          <View style={styles.networkCard}>
            <Text style={styles.networkWarning}>⚠️ Not on Monad Network</Text>
            <Text style={styles.networkDescription}>
              MetaMask shows "Ethereum" but signatures work correctly.
              Switch to Monad to see the correct network in MetaMask.
            </Text>
            <TouchableOpacity
              style={[styles.button, styles.switchNetworkButton]}
              onPress={handleSwitchToMonad}
              disabled={isSwitchingNetwork}
            >
              <Text style={styles.buttonText}>
                {isSwitchingNetwork ? '🔄 Switching...' : '🔄 Switch to Monad'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* x402 Pre-Authorization Section */}
        <View style={styles.x402Card}>
          <Text style={styles.x402Title}>⚡ x402 Micropayments</Text>
          
          {isAuthorized ? (
            <>
              <View style={styles.x402StatusRow}>
                <Text style={[styles.statusBadge, styles.authorized]}>
                  ✓ Authorized
                </Text>
              </View>
              <View style={styles.x402Info}>
                <Text style={styles.x402InfoText}>
                  💰 Remaining: {getRemainingLimit()} MON
                </Text>
                <Text style={styles.x402InfoText}>
                  ⏰ Expires in: {getTimeUntilExpiry()}
                </Text>
              </View>
              <Text style={styles.x402Hint}>
                All transactions are now automatic! No more approval popups.
              </Text>
              <TouchableOpacity
                style={[styles.button, styles.revokeButton]}
                onPress={revokeAuthorization}
              >
                <Text style={styles.revokeButtonText}>
                  🗑️ Revoke Authorization
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.x402Description}>
                Sign once to enable automatic micropayments for 24 hours.
                No more approving each transaction!
              </Text>
              <TouchableOpacity
                style={[styles.button, styles.x402Button]}
                onPress={handleAuthorizeX402}
                disabled={isAuthorizing || isConnecting}
              >
                <Text style={styles.buttonText}>
                  {isAuthorizing ? '🔐 Signing in MetaMask...' : '🔐 Authorize x402 Payments'}
                </Text>
              </TouchableOpacity>
              {isAuthorizing && (
                <Text style={styles.x402Hint}>
                  Please approve the signature request in MetaMask app
                </Text>
              )}
              
              {/* Force reconnect button for chain mismatch issues */}
              <TouchableOpacity
                style={[styles.button, styles.reconnectButton]}
                onPress={handleForceReconnect}
                disabled={isConnecting}
              >
                <Text style={styles.reconnectButtonText}>
                  {isConnecting ? '🔄 Reconnecting...' : '🔄 Fix Connection Issues'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.reconnectHint}>
                Use this if you get "chainId mismatch" errors
              </Text>
            </>
          )}
        </View>

        {/* Disconnect Button */}
        <TouchableOpacity
          style={[styles.button, styles.disconnectButton]}
          onPress={handleDisconnect}
        >
          <Text style={[styles.buttonText, styles.disconnectText]}>
            🔓 Disconnect
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  headerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    color: '#333',
  },
  subheader: {
    fontSize: 14,
    color: '#666',
  },
  statusCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    fontSize: 13,
    fontWeight: '600',
  },
  connected: {
    backgroundColor: '#d4edda',
    color: '#155724',
  },
  disconnected: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    fontFamily: 'Courier New',
    color: '#333',
  },
  networkCard: {
    backgroundColor: '#fff8e1',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f5a623',
  },
  networkWarning: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f5a623',
    marginBottom: 8,
  },
  networkDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
    lineHeight: 18,
  },
  switchNetworkButton: {
    backgroundColor: '#f5a623',
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 8,
  },
  connectButton: {
    backgroundColor: '#f6851b',
    marginTop: 16,
  },
  actionButton: {
    backgroundColor: '#0066ff',
    flex: 1,
  },
  installButton: {
    backgroundColor: '#f6851b',
    paddingVertical: 16,
  },
  disconnectButton: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#dc3545',
    marginTop: 16,
    marginBottom: 32,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  disconnectText: {
    color: '#dc3545',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    color: '#333',
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  infoSection: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
    color: '#333',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoBullet: {
    fontSize: 16,
    marginRight: 12,
    color: '#28a745',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  actionsSection: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  // x402 styles
  x402Card: {
    backgroundColor: '#f0f8ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#0066ff',
  },
  x402Title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0066ff',
    marginBottom: 12,
    textAlign: 'center',
  },
  x402StatusRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  authorized: {
    backgroundColor: '#d4edda',
    color: '#155724',
  },
  x402Info: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  x402InfoText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  x402Description: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  x402Hint: {
    fontSize: 12,
    color: '#28a745',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  x402Button: {
    backgroundColor: '#0066ff',
  },
  revokeButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dc3545',
    marginTop: 8,
  },
  revokeButtonText: {
    color: '#dc3545',
    fontSize: 14,
    fontWeight: '600',
  },
  reconnectButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#6c757d',
    marginTop: 16,
  },
  reconnectButtonText: {
    color: '#6c757d',
    fontSize: 14,
    fontWeight: '600',
  },
  reconnectHint: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
  },
});

export default MetaMaskWalletScreen;
