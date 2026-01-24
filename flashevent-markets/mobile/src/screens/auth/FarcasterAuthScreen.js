import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  TextInput,
  ScrollView,
  AppState,
  Clipboard,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore } from '../../store/authStore';
import { useWalletStore } from '../../store/walletStore';
import { useMetaMask } from '../../hooks/useMetaMask';
import { neynarService } from '../../services/neynarService';
import { colors, typography, spacing } from '../../styles/theme';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';

export default function FarcasterAuthScreen({ navigation }) {
  const [step, setStep] = useState('farcaster'); // 'farcaster' | 'wallet' | 'complete'
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [showUsernameInput, setShowUsernameInput] = useState(false);
  const [privateKey, setPrivateKey] = useState('');
  const [showImportKey, setShowImportKey] = useState(false);
  const [generatedKey, setGeneratedKey] = useState(null);
  
  // SIWF (Sign-In With Farcaster) state
  const [signerUuid, setSignerUuid] = useState(null);
  const [signerApprovalUrl, setSignerApprovalUrl] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const [pollStatus, setPollStatus] = useState('');
  const pollingRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  const login = useAuthStore((state) => state.login);
  const { importFromPrivateKey, generateNewWallet, isConnected, address } = useWalletStore();
  const { connect: connectMetaMask, isConnecting: isMetaMaskConnecting } = useMetaMask();

  // Handle app state changes (for detecting when user returns from Warpcast)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        signerUuid &&
        !isPolling
      ) {
        // App came back to foreground - check signer status
        console.log('[FarcasterAuth] App returned to foreground, checking signer status');
        checkSignerStatus();
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [signerUuid, isPolling]);

  // Check signer status
  const checkSignerStatus = async () => {
    if (!signerUuid) return;
    
    try {
      const status = await neynarService.getSignerStatus(signerUuid);
      console.log('[FarcasterAuth] Signer status:', status);
      
      if (status.status === 'approved' && status.fid) {
        // Signer approved! Get user data and login
        await handleSignerApproved(status);
      }
    } catch (error) {
      console.error('[FarcasterAuth] Error checking signer status:', error);
    }
  };

  // Handle when signer is approved
  const handleSignerApproved = async (signerStatus) => {
    try {
      setIsLoading(true);
      setPollStatus('Getting your profile...');
      
      // Stop polling
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      setIsPolling(false);
      
      // Get user data
      const userData = signerStatus.user || await neynarService.getUserByFid(signerStatus.fid);
      
      if (!userData) {
        throw new Error('Could not fetch user profile');
      }
      
      console.log('[FarcasterAuth] User authenticated:', {
        fid: userData.fid,
        username: userData.username,
        signerUuid: signerStatus.signer_uuid,
      });
      
      // Login with user data and signer UUID
      await login(userData, signerStatus.signer_uuid);
      
      // Move to wallet connection step
      setStep('wallet');
      
      Alert.alert(
        '✅ Connected!',
        `Welcome @${userData.username}! You're now signed in with Farcaster.`
      );
    } catch (error) {
      console.error('[FarcasterAuth] Error after signer approved:', error);
      Alert.alert('Error', 'Failed to complete authentication. Please try again.');
    } finally {
      setIsLoading(false);
      setPollStatus('');
    }
  };

  // Step 1: Initiate proper SIWF flow
  const handleFarcasterAuth = async () => {
    try {
      setIsLoading(true);
      setPollStatus('Creating signer...');
      
      // Create a signer via backend (will fall back to demo if network fails)
      const signerData = await neynarService.createSigner();
      
      console.log('[FarcasterAuth] Signer created:', signerData);
      
      // Check if demo mode (no approval needed) - signer_uuid starts with 'demo-' or status is approved
      const isDemoSigner = signerData.signer_uuid?.startsWith('demo-') || 
                          (signerData.status === 'approved' && !signerData.signer_approval_url);
      
      if (isDemoSigner) {
        // Demo mode - auto-approved
        const userData = neynarService.getDemoUser(signerData.fid || 12345);
        await login(userData, signerData.signer_uuid);
        setStep('wallet');
        Alert.alert(
          'Demo Mode', 
          'You are signed in with a demo account. To use full Farcaster features, ensure the backend server is running and has a valid Neynar API key.'
        );
        setIsLoading(false);
        return;
      }
      
      // Store signer UUID
      setSignerUuid(signerData.signer_uuid);
      setSignerApprovalUrl(signerData.deepLinkUrl || signerData.signer_approval_url);
      
      // Show approval UI
      setPollStatus('');
      setIsLoading(false);
      setShowUsernameInput(true);
      
    } catch (error) {
      console.error('[FarcasterAuth] Error creating signer:', error);
      
      // If error occurs, offer demo mode as fallback
      Alert.alert(
        'Connection Issue',
        'Could not connect to Farcaster service. Would you like to continue in Demo Mode?',
        [
          {
            text: 'Try Again',
            onPress: () => setIsLoading(false),
            style: 'cancel',
          },
          {
            text: 'Use Demo Mode',
            onPress: async () => {
              const demoUser = neynarService.getDemoUser(12345);
              await login(demoUser, 'demo-signer-' + Date.now());
              setStep('wallet');
              setIsLoading(false);
            },
          },
        ]
      );
    }
  };

  // Open Warpcast for approval
  const handleOpenWarpcast = async () => {
    if (!signerApprovalUrl) {
      Alert.alert('Error', 'No approval URL available. Please restart authentication.');
      return;
    }
    
    try {
      setIsLoading(true);
      setPollStatus('Opening Warpcast...');
      
      // Start polling for approval
      startPolling();
      
      // Try to open Warpcast app
      const canOpen = await Linking.canOpenURL(signerApprovalUrl);
      
      if (canOpen) {
        await Linking.openURL(signerApprovalUrl);
      } else {
        // Fallback to web browser
        const webUrl = signerApprovalUrl.replace('farcaster://', 'https://warpcast.com/~/');
        await WebBrowser.openBrowserAsync(webUrl);
      }
      
      setPollStatus('Waiting for approval in Warpcast...');
      
    } catch (error) {
      console.error('[FarcasterAuth] Error opening Warpcast:', error);
      Alert.alert(
        'Error',
        'Could not open Warpcast. Please make sure you have Warpcast installed.'
      );
      setIsLoading(false);
      stopPolling();
    }
  };

  // Start polling for signer approval
  const startPolling = () => {
    if (pollingRef.current) return; // Already polling
    
    setIsPolling(true);
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes with 5 second intervals
    
    pollingRef.current = setInterval(async () => {
      attempts++;
      
      if (attempts > maxAttempts) {
        stopPolling();
        Alert.alert(
          'Timeout',
          'Authentication timed out. Please try again.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      try {
        const status = await neynarService.getSignerStatus(signerUuid);
        
        if (status.status === 'approved' && status.fid) {
          stopPolling();
          await handleSignerApproved(status);
        }
      } catch (error) {
        console.log('[FarcasterAuth] Poll error:', error.message);
      }
    }, 5000); // Poll every 5 seconds
  };

  // Stop polling
  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsPolling(false);
    setIsLoading(false);
    setPollStatus('');
  };

  // Alternative: Login with username (view-only, no casting ability)
  const handleUsernameLogin = async () => {
    if (!username.trim()) {
      Alert.alert('Error', 'Please enter your Farcaster username');
      return;
    }

    try {
      setIsLoading(true);
      setPollStatus('Looking up your account...');

      // Look up user by username
      const userData = await neynarService.getUserByUsername(username.trim().replace('@', ''));
      
      if (!userData) {
        Alert.alert(
          'Not Found', 
          'Could not find a Farcaster user with that username. Please check and try again, or sign in with Warpcast for full access.'
        );
        setIsLoading(false);
        setPollStatus('');
        return;
      }

      // Show warning about limited functionality
      Alert.alert(
        'Limited Access',
        `Found @${userData.username}. Note: Username-only login gives read-only access. You won't be able to post to Farcaster. For full access, use "Sign in with Warpcast".`,
        [
          { 
            text: 'Sign in with Warpcast',
            onPress: () => {
              setIsLoading(false);
              setPollStatus('');
              handleFarcasterAuth();
            }
          },
          {
            text: 'Continue Anyway',
            onPress: async () => {
              // Login with view-only access (no signer)
              await login(userData, null);
              setStep('wallet');
              setIsLoading(false);
              setPollStatus('');
            }
          }
        ]
      );
    } catch (error) {
      console.error('[FarcasterAuth] Error during username lookup:', error);
      setIsLoading(false);
      setPollStatus('');
      Alert.alert('Error', 'Failed to look up user. Please try again.');
    }
  };

  // Demo mode login
  const handleDemoMode = async () => {
    const demoUser = neynarService.getDemoUser(12345);
    await login(demoUser, 'demo-signer-uuid');
    setStep('wallet');
  };

  // Step 2: Generate new wallet
  const handleGenerateWallet = async () => {
    try {
      setIsLoading(true);
      const result = await generateNewWallet();
      
      if (result.success) {
        setGeneratedKey(result.privateKey);
        Alert.alert(
          '⚠️ Important: Save Your Private Key',
          'Your new wallet has been created. SAVE YOUR PRIVATE KEY NOW - you will need it to recover your wallet!\n\nYour address: ' + result.address,
          [
            {
              text: 'Copy Key & Continue',
              onPress: () => {
                Clipboard.setString(result.privateKey);
                Alert.alert('Copied!', 'Private key copied to clipboard. Store it safely!');
                setStep('complete');
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to generate wallet');
      }
    } catch (error) {
      console.error('Error generating wallet:', error);
      Alert.alert('Error', 'Failed to generate wallet. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Import wallet from private key
  const handleImportWallet = async () => {
    if (!privateKey.trim()) {
      Alert.alert('Error', 'Please enter your private key');
      return;
    }

    try {
      setIsLoading(true);
      const result = await importFromPrivateKey(privateKey.trim());
      
      if (result.success) {
        Alert.alert('Success', `Wallet connected!\n\nAddress: ${result.address.slice(0, 6)}...${result.address.slice(-4)}`);
        setStep('complete');
      } else {
        Alert.alert('Error', result.error || 'Invalid private key');
      }
    } catch (error) {
      console.error('Error importing wallet:', error);
      Alert.alert('Error', 'Failed to import wallet. Please check your private key.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Connect wallet (show options)
  const handleWalletConnect = async () => {
    setShowImportKey(true);
  };

  // Connect with MetaMask
  const handleMetaMaskConnect = async () => {
    try {
      setIsLoading(true);
      await connectMetaMask();
      
      Alert.alert(
        'MetaMask Connected! 🎉', 
        'Your wallet is connected successfully.',
        [{ text: 'Continue', onPress: () => setStep('complete') }]
      );
    } catch (error) {
      console.error('Error connecting MetaMask:', error);
      if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
        Alert.alert(
          '⏱️ Connection Timeout',
          'Please open MetaMask app and approve the connection request. Then try again.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', error.message || 'Failed to connect MetaMask');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Skip wallet connection
  const handleSkipWallet = () => {
    setStep('complete');
  };

  // Complete setup
  const handleComplete = () => {
    // Navigation will automatically happen due to auth state change
  };

  // Cancel SIWF and go back
  const handleCancelSIWF = () => {
    stopPolling();
    setSignerUuid(null);
    setSignerApprovalUrl(null);
    setShowUsernameInput(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>⚡</Text>
        <Text style={styles.headerTitle}>FlashEvent Markets</Text>
      </View>

      <View style={styles.content}>
        {step === 'farcaster' && !showUsernameInput && (
          <TouchableOpacity
            style={styles.walletFirstButton}
            onPress={() => setStep('wallet')}
          >
            <Text style={styles.walletFirstText}>🦊 Connect with MetaMask Wallet</Text>
          </TouchableOpacity>
        )}

        {step === 'farcaster' && (
          <Card style={styles.stepCard}>
            <View style={styles.stepIndicator}>
              <View style={[styles.stepDot, styles.stepDotActive]} />
              <View style={styles.stepLine} />
              <View style={styles.stepDot} />
            </View>

            <Text style={styles.stepTitle}>
              {showUsernameInput && signerApprovalUrl 
                ? 'Sign in with Warpcast' 
                : 'Sign in with Farcaster'}
            </Text>
            <Text style={styles.stepDescription}>
              {showUsernameInput && signerApprovalUrl
                ? 'Tap the button below to approve sign-in in Warpcast. This will let you post predictions to your Farcaster feed.'
                : isPolling
                ? pollStatus || 'Waiting for approval...'
                : 'Connect your Farcaster account to access prediction markets, social features, and start betting!'
              }
            </Text>

            {!showUsernameInput ? (
              <>
                <View style={styles.benefits}>
                  <Text style={styles.benefitItem}>✓ Sign in securely with Warpcast</Text>
                  <Text style={styles.benefitItem}>✓ Post predictions to your feed</Text>
                  <Text style={styles.benefitItem}>✓ Share bets and wins with followers</Text>
                </View>

                <Button
                  title={isLoading ? 'Initializing...' : '🟣 Sign in with Farcaster'}
                  onPress={handleFarcasterAuth}
                  loading={isLoading}
                  disabled={isLoading}
                  style={styles.mainButton}
                />
              </>
            ) : signerApprovalUrl ? (
              <>
                {/* SIWF approval flow */}
                {isPolling ? (
                  <View style={styles.pollingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.pollingText}>{pollStatus || 'Waiting for approval...'}</Text>
                    <Text style={styles.pollingHint}>
                      Please approve the request in Warpcast. {'\n'}
                      This screen will update automatically.
                    </Text>
                    
                    <TouchableOpacity
                      style={styles.reopenButton}
                      onPress={handleOpenWarpcast}
                    >
                      <Text style={styles.reopenText}>Reopen Warpcast</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <Button
                      title={isLoading ? 'Opening...' : '📱 Open Warpcast to Approve'}
                      onPress={handleOpenWarpcast}
                      loading={isLoading}
                      disabled={isLoading}
                      style={styles.mainButton}
                    />
                    
                    <View style={styles.orDivider}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.orText}>OR</Text>
                      <View style={styles.dividerLine} />
                    </View>

                    <View style={styles.usernameInputContainer}>
                      <Text style={styles.inputLabel}>Continue with Username (Read-only)</Text>
                      <TextInput
                        style={styles.usernameInput}
                        placeholder="e.g., vitalik.eth"
                        placeholderTextColor={colors.textMuted}
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!isLoading}
                      />
                    </View>

                    <Button
                      title={isLoading ? 'Looking up...' : '🔍 Find My Account'}
                      onPress={handleUsernameLogin}
                      disabled={isLoading || !username.trim()}
                      loading={isLoading && !!username.trim()}
                      variant="secondary"
                      style={styles.secondaryButton}
                    />
                  </>
                )}

                <TouchableOpacity
                  style={styles.backButton}
                  onPress={handleCancelSIWF}
                >
                  <Text style={styles.backText}>← Cancel & Go Back</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Fallback username input (when no approval URL) */}
                <View style={styles.usernameInputContainer}>
                  <Text style={styles.inputLabel}>Farcaster Username</Text>
                  <TextInput
                    style={styles.usernameInput}
                    placeholder="e.g., vitalik.eth"
                    placeholderTextColor={colors.textMuted}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                </View>

                <Button
                  title={isLoading ? 'Looking up...' : '🔍 Find My Account'}
                  onPress={handleUsernameLogin}
                  disabled={isLoading || !username.trim()}
                  loading={isLoading}
                  style={styles.mainButton}
                />

                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setShowUsernameInput(false)}
                >
                  <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
              </>
            )}

            {!isPolling && (
              <TouchableOpacity
                style={styles.demoButton}
                onPress={handleDemoMode}
              >
                <Text style={styles.demoText}>Try Demo Mode</Text>
              </TouchableOpacity>
            )}
          </Card>
        )}

        {step === 'wallet' && (
          <Card style={styles.stepCard}>
            <View style={styles.stepIndicator}>
              <View style={[styles.stepDot, styles.stepDotComplete]}>
                <Text style={styles.checkmark}>✓</Text>
              </View>
              <View style={[styles.stepLine, styles.stepLineComplete]} />
              <View style={[styles.stepDot, styles.stepDotActive]} />
            </View>

            <Text style={styles.stepTitle}>Connect Wallet</Text>
            <Text style={styles.stepDescription}>
              {showImportKey 
                ? 'Import an existing wallet or create a new one'
                : 'Connect your wallet to place bets and receive winnings on Monad Testnet.'
              }
            </Text>

            {!showImportKey ? (
              <>
                <View style={styles.networkInfo}>
                  <Text style={styles.networkLabel}>Network</Text>
                  <Text style={styles.networkValue}>Monad Testnet</Text>
                  <Text style={styles.networkHint}>
                    Get testnet MON from faucet.monad.xyz
                  </Text>
                </View>

                <Button
                  title="🦊 Connect with MetaMask"
                  onPress={handleMetaMaskConnect}
                  disabled={isLoading || isMetaMaskConnecting}
                  loading={isLoading || isMetaMaskConnecting}
                  style={styles.mainButton}
                />
                
                <Text style={styles.walletHint}>
                  Scan QR code from your mobile app or browser
                </Text>

                <View style={styles.orDivider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.orText}>OR</Text>
                  <View style={styles.dividerLine} />
                </View>

                <Button
                  title="🔐 Use Private Key / Create Wallet"
                  onPress={handleWalletConnect}
                  disabled={isLoading}
                  variant="secondary"
                  style={styles.secondaryButton}
                />

                <TouchableOpacity
                  style={styles.skipButton}
                  onPress={handleSkipWallet}
                >
                  <Text style={styles.skipText}>Skip for now</Text>
                </TouchableOpacity>
              </>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.walletOptions}>
                  <Button
                    title="✨ Create New Wallet"
                    onPress={handleGenerateWallet}
                    disabled={isLoading}
                    loading={isLoading}
                    style={styles.mainButton}
                  />
                  
                  <View style={styles.orDivider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.orText}>OR</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <View style={styles.usernameInputContainer}>
                    <Text style={styles.inputLabel}>Import with Private Key</Text>
                    <TextInput
                      style={[styles.usernameInput, styles.privateKeyInput]}
                      placeholder="Enter your private key (0x...)"
                      placeholderTextColor={colors.textMuted}
                      value={privateKey}
                      onChangeText={setPrivateKey}
                      autoCapitalize="none"
                      autoCorrect={false}
                      secureTextEntry={true}
                      editable={!isLoading}
                      multiline={false}
                    />
                    <Text style={styles.securityNote}>
                      🔒 Your key is stored securely on device
                    </Text>
                  </View>

                  <Button
                    title={isLoading ? 'Importing...' : '📥 Import Wallet'}
                    onPress={handleImportWallet}
                    disabled={isLoading || !privateKey.trim()}
                    loading={isLoading}
                    style={styles.mainButton}
                  />

                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => setShowImportKey(false)}
                  >
                    <Text style={styles.backText}>← Back</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </Card>
        )}

        {step === 'complete' && (
          <Card style={styles.stepCard}>
            <View style={styles.completeIcon}>
              <Text style={styles.completeEmoji}>🎉</Text>
            </View>

            <Text style={styles.stepTitle}>You're all set!</Text>
            <Text style={styles.stepDescription}>
              Start exploring prediction markets, place bets, and win ETH!
            </Text>

            <Button
              title="⚡ Start Predicting"
              onPress={handleComplete}
              style={styles.mainButton}
            />
          </Card>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing['3xl'],
    paddingBottom: spacing.xl,
  },
  headerIcon: {
    fontSize: 28,
    marginRight: spacing.sm,
  },
  headerTitle: {
    ...typography.styles.h4,
    color: colors.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.screenHorizontal,
    justifyContent: 'center',
  },
  stepCard: {
    padding: spacing.xl,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '20',
  },
  stepDotComplete: {
    borderColor: colors.success,
    backgroundColor: colors.success,
  },
  stepLine: {
    width: 60,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  stepLineComplete: {
    backgroundColor: colors.success,
  },
  checkmark: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  stepTitle: {
    ...typography.styles.h3,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  stepDescription: {
    ...typography.styles.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  benefits: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: spacing.cardBorderRadius,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  benefitItem: {
    ...typography.styles.bodySmall,
    color: colors.success,
    marginBottom: spacing.xs,
  },
  mainButton: {
    marginBottom: spacing.md,
  },
  secondaryButton: {
    marginBottom: spacing.md,
  },
  demoButton: {
    alignItems: 'center',
    padding: spacing.sm,
  },
  demoText: {
    ...typography.styles.bodySmall,
    color: colors.textMuted,
  },
  skipButton: {
    alignItems: 'center',
    padding: spacing.sm,
  },
  skipText: {
    ...typography.styles.body,
    color: colors.textSecondary,
  },
  networkInfo: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: spacing.cardBorderRadius,
    padding: spacing.md,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  networkLabel: {
    ...typography.styles.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  networkValue: {
    ...typography.styles.h5,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  networkHint: {
    ...typography.styles.captionSmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  completeIcon: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  completeEmoji: {
    fontSize: 64,
  },
  usernameInputContainer: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    ...typography.styles.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  usernameInput: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: spacing.buttonBorderRadius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.text,
    fontSize: 16,
  },
  backButton: {
    alignItems: 'center',
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  backText: {
    ...typography.styles.body,
    color: colors.primary,
  },
  walletOptions: {
    paddingBottom: spacing.lg,
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  orText: {
    ...typography.styles.caption,
    color: colors.textMuted,
    marginHorizontal: spacing.md,
  },
  privateKeyInput: {
    fontFamily: 'monospace',
    fontSize: 14,
  },
  securityNote: {
    ...typography.styles.captionSmall,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  walletFirstButton: {
    backgroundColor: colors.backgroundElevated,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.buttonBorderRadius,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  walletFirstText: {
    ...typography.styles.button,
    color: colors.text,
  },
  walletHint: {
    ...typography.styles.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  pollingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  pollingText: {
    ...typography.styles.body,
    color: colors.text,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  pollingHint: {
    ...typography.styles.bodySmall,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  reopenButton: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.backgroundElevated,
    borderRadius: spacing.buttonBorderRadius,
  },
  reopenText: {
    ...typography.styles.button,
    color: colors.primary,
  },
});
