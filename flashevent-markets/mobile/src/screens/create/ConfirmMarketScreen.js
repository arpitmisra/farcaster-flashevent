import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ethers } from 'ethers';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { colors, typography, spacing } from '../../styles/theme';
import { useWalletStore } from '../../store/walletStore';
import { useAuthStore } from '../../store/authStore';
import { useWallet } from '../../context/WalletContext';
import apiService from '../../services/apiService';
import metamaskService from '../../services/metamaskService';
import authService from '../../services/authService';
import x402Service from '../../services/x402Service';
import { MARKET_TYPES, MARKET_FACTORY_ABI, CONTRACT_ADDRESSES } from '../../config/contracts';
import config from '../../config';

// Simple logger for this screen
const logger = {
  info: (msg, data) => console.log('[ConfirmMarket]', msg, JSON.stringify(data || '')),
  error: (msg, data) => console.error('[ConfirmMarket]', msg, JSON.stringify(data || '')),
};

export default function ConfirmMarketScreen({ route, navigation }) {
  const { template, formData, preview, autoCast } = route.params;
  const { address, balance, setExternalWallet, refreshBalance, getProvider } = useWalletStore();
  const { user } = useAuthStore();
  
  // Get wallet context for direct on-chain transactions
  const walletContext = useWallet();
  
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [balanceError, setBalanceError] = useState(null);
  const [creationStep, setCreationStep] = useState(''); // Track progress

  // Get native token symbol from chain config
  const nativeTokenSymbol = config.DEFAULT_CHAIN?.nativeCurrency?.symbol || 'MON';

  const creationFee = parseFloat(config.MARKET_CREATION_FEE);
  const platformFee = creationFee * 0.01; // 1%
  const totalCost = creationFee + platformFee;

  // Fetch balance on mount
  useEffect(() => {
    const fetchBalance = async () => {
      setIsLoadingBalance(true);
      setBalanceError(null);
      
      try {
        // Get session info from MetaMask
        const sessionInfo = metamaskService.getSessionInfo?.();
        logger.info('Session info', sessionInfo);
        
        const walletAddress = sessionInfo?.address || address;
        logger.info('Wallet address to fetch balance', { walletAddress });
        
        if (!walletAddress) {
          throw new Error('No wallet address available');
        }

        // Fetch balance directly using ethers
        const { ethers } = require('ethers');
        const rpcUrl = config.DEFAULT_CHAIN?.rpcUrls?.default?.http?.[0] || 'https://monad-testnet.g.alchemy.com/v2/f6Q2jX1N6pG4yztkh_TK5';
        logger.info('RPC URL', { rpcUrl });
        
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        logger.info('Provider created, fetching balance...');
        
        const balanceWei = await provider.getBalance(walletAddress);
        const balanceFormatted = ethers.formatEther(balanceWei);
        
        logger.info('Balance fetched', { 
          address: walletAddress, 
          balanceWei: balanceWei.toString(), 
          balanceFormatted 
        });

        // Update store
        await setExternalWallet(walletAddress, config.DEFAULT_CHAIN?.chainId || 10143);
        
      } catch (error) {
        logger.error('Failed to fetch balance', { error: error.message });
        setBalanceError(error.message);
      } finally {
        setIsLoadingBalance(false);
      }
    };

    fetchBalance();
  }, []);

  const handleCreate = async () => {
    logger.info('Create button pressed', { address, balance, totalCost });
    
    // Check wallet connection from WalletContext (source of truth)
    if (!walletContext.isConnected || !walletContext.address) {
      Alert.alert('Wallet Not Connected', 'Please connect your MetaMask wallet to create a market.');
      return;
    }

    const walletAddress = walletContext.address;
    logger.info('Using wallet address', { walletAddress });

    setIsCreating(true);
    setCreationStep('Preparing...');

    try {
      // Calculate expiry timestamp
      let durationSeconds = 86400; // Default 24 hours
      let expiryTimestamp;
      
      // Sports markets use match date + buffer for expiry
      if (template.type === MARKET_TYPES.SPORTS && formData.matchDate) {
        // Parse match date (format: "2026-01-25 20:00" or similar)
        const matchDateStr = formData.matchDate.trim();
        let matchTimestamp;
        
        try {
          // Try to parse the date
          const parsedDate = new Date(matchDateStr);
          if (!isNaN(parsedDate.getTime())) {
            matchTimestamp = Math.floor(parsedDate.getTime() / 1000);
          } else {
            // Try with different format (YYYY-MM-DD HH:MM)
            const parts = matchDateStr.split(' ');
            const dateParts = parts[0].split('-');
            const timeParts = (parts[1] || '20:00').split(':');
            const constructedDate = new Date(
              parseInt(dateParts[0]),
              parseInt(dateParts[1]) - 1,
              parseInt(dateParts[2]),
              parseInt(timeParts[0]),
              parseInt(timeParts[1] || 0)
            );
            matchTimestamp = Math.floor(constructedDate.getTime() / 1000);
          }
        } catch (e) {
          logger.error('Failed to parse match date', { matchDateStr, error: e.message });
          matchTimestamp = Math.floor(Date.now() / 1000) + 86400; // Default to 24h from now
        }
        
        // Add 3 hours buffer after match start for match to finish and results to be available
        const MATCH_BUFFER_SECONDS = 3 * 3600; // 3 hours
        expiryTimestamp = BigInt(matchTimestamp + MATCH_BUFFER_SECONDS);
        
        logger.info('Sports market expiry calculated', {
          matchDate: matchDateStr,
          matchTimestamp,
          expiryTimestamp: expiryTimestamp.toString(),
          expiryDate: new Date(Number(expiryTimestamp) * 1000).toISOString()
        });
      } else {
        // Standard duration-based expiry for other market types
        if (formData.duration) {
          if (formData.duration.includes('hour')) {
            const hours = parseInt(formData.duration);
            durationSeconds = hours * 3600;
          } else if (formData.duration.includes('day')) {
            const days = parseInt(formData.duration);
            durationSeconds = days * 86400;
          }
        }
        expiryTimestamp = BigInt(Math.floor(Date.now() / 1000) + durationSeconds);
      }

      logger.info('Calculated expiry', { 
        durationSeconds, 
        expiryTimestamp: expiryTimestamp.toString(),
        expiryDate: new Date(Number(expiryTimestamp) * 1000).toISOString()
      });

      // Build market parameters for backend registration
      const parameters = {};
      let marketType = 'PRICE_TOUCH';

      switch (template.type) {
        case MARKET_TYPES.PRICE_TOUCH:
          marketType = 'PRICE_TOUCH';
          parameters.token = formData.asset || 'BTC/USD';
          parameters.targetPrice = parseFloat(formData.price) || 0;
          parameters.isAbove = true;
          break;
        case MARKET_TYPES.ONCHAIN_EVENT:
          marketType = 'ONCHAIN_EVENT';
          parameters.contractAddress = formData.address || '';
          parameters.eventSelector = formData.action || '';
          break;
        case MARKET_TYPES.API_COUNT:
          marketType = 'API_COUNT';
          parameters.apiEndpoint = `twitter.com/${formData.username}`;
          parameters.threshold = parseInt(formData.count) || 1;
          break;
        case MARKET_TYPES.SPORTS:
          marketType = 'SPORTS';
          parameters.sport = formData.sport || 'soccer';
          parameters.team1 = formData.team1 || '';
          parameters.team2 = formData.team2 || '';
          parameters.betType = formData.betType || 'win';
          parameters.matchDate = formData.matchDate || '';
          if (formData.betType === 'over') {
            parameters.totalLine = parseFloat(formData.totalGoals) || 2.5;
          }
          break;
      }

      // ==========================================
      // STEP 1: Deploy market on-chain using USER'S WALLET
      // ==========================================
      setCreationStep('Deploying market on-chain...');
      
      // Log all the parameters being used
      logger.info('=== MARKET CREATION PARAMETERS ===');
      logger.info('Question', { value: preview, length: preview.length });
      logger.info('Expiry Timestamp', { 
        value: expiryTimestamp.toString(),
        asDate: new Date(Number(expiryTimestamp) * 1000).toISOString()
      });
      logger.info('Factory Address', { value: CONTRACT_ADDRESSES.MARKET_FACTORY });

      // Get the contract interface
      const factoryInterface = new ethers.Interface(MARKET_FACTORY_ABI);
      
      // Encode the function call with explicit BigInt conversion
      const encodedQuestion = preview; // string
      const encodedExpiry = BigInt(expiryTimestamp); // Ensure it's BigInt
      
      // Default betting deadline: 15 minutes before expiry (minimum lock duration)
      const DEFAULT_LOCK_DURATION = BigInt(15 * 60); // 15 minutes in seconds
      const encodedBettingDeadline = encodedExpiry - DEFAULT_LOCK_DURATION;
      
      logger.info('Encoding function call', {
        functionName: 'createMarket',
        args: [encodedQuestion, encodedExpiry.toString(), encodedBettingDeadline.toString()]
      });
      
      const data = factoryInterface.encodeFunctionData('createMarket', [
        encodedQuestion,
        encodedExpiry,
        encodedBettingDeadline,
      ]);
      
      // Log the encoded data for debugging
      logger.info('Encoded transaction data', {
        dataLength: data.length,
        functionSelector: data.slice(0, 10),
        fullData: data
      });

      // Send transaction via user's MetaMask wallet
      logger.info('Sending transaction to MetaMask...');
      
      const txResult = await walletContext.sendTransaction({
        to: CONTRACT_ADDRESSES.MARKET_FACTORY,
        data: data,
        value: '0x0', // No value needed
      });

      // Get the transaction hash (might be in different places depending on return type)
      const txHash = txResult.hash || txResult.transactionHash || txResult;
      logger.info('Transaction submitted!', { txHash });

      // Now fetch the full receipt from the Monad provider (with logs)
      setCreationStep('Waiting for confirmation...');
      const monadProvider = walletContext.getProvider();
      
      // Wait for the transaction to be mined and get full receipt
      logger.info('Fetching full receipt from Monad...');
      const fullReceipt = await monadProvider.getTransactionReceipt(txHash);
      
      if (!fullReceipt) {
        // Wait a bit and try again
        await new Promise(resolve => setTimeout(resolve, 2000));
        const retryReceipt = await monadProvider.getTransactionReceipt(txHash);
        if (!retryReceipt) {
          throw new Error(`Transaction ${txHash} not found. Please check the explorer.`);
        }
      }

      const txReceipt = fullReceipt || await monadProvider.getTransactionReceipt(txHash);
      
      logger.info('Full receipt retrieved!', { 
        txHash: txReceipt.hash,
        blockNumber: txReceipt.blockNumber,
        logsCount: txReceipt.logs?.length || 0,
        status: txReceipt.status
      });

      // Log all logs for debugging
      if (txReceipt.logs && txReceipt.logs.length > 0) {
        txReceipt.logs.forEach((log, i) => {
          logger.info(`Log ${i}`, {
            address: log.address,
            topics: log.topics,
            data: log.data?.slice(0, 100) + '...'
          });
        });
      }

      // Parse the MarketCreated event from the receipt
      let marketAddress = null;
      
      // MarketCreated event signature: MarketCreated(address indexed market, string question, uint256 expiry)
      // Event topic0 = keccak256("MarketCreated(address,string,uint256)")
      const MARKET_CREATED_TOPIC = ethers.id("MarketCreated(address,string,uint256)");
      logger.info('Looking for MarketCreated event', { expectedTopic: MARKET_CREATED_TOPIC });
      
      if (txReceipt.logs && txReceipt.logs.length > 0) {
        // Method 1: Look for the event by topic
        for (const log of txReceipt.logs) {
          if (log.topics && log.topics[0] === MARKET_CREATED_TOPIC) {
            // The market address is indexed, so it's in topics[1]
            // It's a 32-byte value with the address in the last 20 bytes
            const addressBytes = log.topics[1];
            if (addressBytes) {
              marketAddress = ethers.getAddress('0x' + addressBytes.slice(-40));
              logger.info('MarketCreated event found via topic matching!', { marketAddress });
              break;
            }
          }
        }

        // Method 2: Try parsing with interface
        if (!marketAddress) {
          for (const log of txReceipt.logs) {
            try {
              const parsed = factoryInterface.parseLog({
                topics: log.topics,
                data: log.data,
              });
              if (parsed && parsed.name === 'MarketCreated') {
                marketAddress = parsed.args.market || parsed.args[0];
                logger.info('MarketCreated event found via interface!', { marketAddress });
                break;
              }
            } catch (e) {
              // Not a MarketCreated event, continue
            }
          }
        }

        // Method 3: Fallback - try to get market address from any indexed topic
        if (!marketAddress) {
          for (const log of txReceipt.logs) {
            // Check if log is from the factory contract
            if (log.address?.toLowerCase() === CONTRACT_ADDRESSES.MARKET_FACTORY.toLowerCase()) {
              if (log.topics && log.topics.length > 1) {
                const potentialAddress = '0x' + log.topics[1]?.slice(-40);
                if (potentialAddress && potentialAddress.length === 42) {
                  try {
                    marketAddress = ethers.getAddress(potentialAddress);
                    logger.info('Market address from factory log topics', { marketAddress });
                    break;
                  } catch (e) {
                    // Invalid address, continue
                  }
                }
              }
            }
          }
        }
      }

      // Method 4: If still no market address, get latest market from factory
      if (!marketAddress) {
        logger.info('Trying to get market address from factory contract...');
        try {
          const factoryContract = new ethers.Contract(
            CONTRACT_ADDRESSES.MARKET_FACTORY,
            ['function marketsCount() view returns (uint256)', 'function getMarket(uint256) view returns (address)'],
            monadProvider
          );
          
          // Wait a bit for the state to be updated
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const marketCount = await factoryContract.marketsCount();
          logger.info('Factory market count', { count: marketCount.toString() });
          if (marketCount > 0n) {
            marketAddress = await factoryContract.getMarket(marketCount - 1n);
            logger.info('Market address from factory', { marketAddress, marketCount: marketCount.toString() });
          }
        } catch (e) {
          logger.error('Could not get market from factory', { error: e.message });
        }
      }

      // Method 5: If STILL no market address, try again with a longer wait
      if (!marketAddress) {
        logger.info('Retrying to get market address from factory after delay...');
        try {
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const factoryContract = new ethers.Contract(
            CONTRACT_ADDRESSES.MARKET_FACTORY,
            ['function marketsCount() view returns (uint256)', 'function getMarket(uint256) view returns (address)'],
            monadProvider
          );
          const marketCount = await factoryContract.marketsCount();
          logger.info('Factory market count (retry)', { count: marketCount.toString() });
          if (marketCount > 0n) {
            marketAddress = await factoryContract.getMarket(marketCount - 1n);
            logger.info('Market address from factory (retry)', { marketAddress });
          }
        } catch (e) {
          logger.error('Could not get market from factory (retry)', { error: e.message });
        }
      }

      if (!marketAddress) {
        logger.error('Could not extract market address', { 
          txHash,
          logsCount: txReceipt.logs?.length || 0 
        });
        // Don't fail completely - user can check explorer
        Alert.alert(
          '⚠️ Market Created',
          `Your transaction was successful!\n\nTx: ${txHash.slice(0, 10)}...${txHash.slice(-8)}\n\nWe couldn't automatically find the market address. Check the transaction on the explorer.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }

      // ==========================================
      // STEP 2: Register market in backend (optional - for indexing)
      // ==========================================
      setCreationStep('Registering market...');
      
      let registrationResult = null;
      try {
        logger.info('Registering market in backend...');
        
        // Try to authenticate first
        await authService.init();
        const authResult = await authService.ensureAuthenticated();
        
        if (authResult.success) {
          registrationResult = await apiService.request('/markets/register', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${authResult.token}`,
            },
            body: JSON.stringify({
              marketAddress,
              txHash: txHash,
              question: preview,
              type: marketType,
              parameters,
              creator: walletAddress,
              creatorFid: user?.fid,
              endTime: Number(expiryTimestamp),
            }),
          });
          logger.info('Market registered in backend', { result: registrationResult });
        }
      } catch (regError) {
        // Backend registration is optional - market is already on-chain
        logger.error('Backend registration failed (non-critical)', { error: regError.message });
      }

      // ==========================================
      // SUCCESS!
      // ==========================================
      const marketId = registrationResult?.marketId || marketAddress;

      // Show success alert first
      Alert.alert(
        '🎉 Market Created!',
        `Your market has been deployed on-chain!\n\nTransaction: ${txHash.slice(0, 10)}...${txHash.slice(-8)}\n\nMarket: ${marketAddress.slice(0, 10)}...${marketAddress.slice(-8)}`,
        [
          { 
            text: 'View Market',
            onPress: () => {
              // Navigate to the market detail screen
              navigation.navigate('MarketDetail', { 
                marketId: marketId,
                marketAddress: marketAddress 
              });
            }
          }
        ]
      );
    } catch (error) {
      logger.error('Market creation failed', { error: error.message, stack: error.stack });
      
      // Parse and show helpful error message
      let errorMessage = error.message || 'Failed to create market. Please try again.';
      let errorTitle = 'Creation Failed';
      
      if (error.message.includes('rejected') || error.message.includes('denied') || error.message.includes('User rejected')) {
        errorMessage = 'Transaction was rejected. Please try again and approve the request in MetaMask.';
      } else if (error.message.includes('insufficient funds') || error.message.includes('insufficient balance')) {
        errorTitle = 'Insufficient Funds';
        errorMessage = 'Your wallet does not have enough MON to pay for gas. Please add more MON to your wallet.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Transaction timed out. Please check MetaMask app and try again.';
      } else if (error.message.includes('network') || error.message.includes('Network')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.message.includes('method is not available') || error.code === -32601) {
        errorTitle = 'Wallet Session Issue';
        errorMessage = 'Please disconnect your wallet (in Profile tab), then reconnect it. Make sure MetaMask is switched to Monad Testnet (Chain ID: 10143) before creating a market.';
      } else if (error.message.includes('disconnect and reconnect')) {
        errorTitle = 'Wallet Session Issue';
        errorMessage = error.message;
      }
      
      Alert.alert(errorTitle, errorMessage);
    } finally {
      setIsCreating(false);
      setCreationStep('');
    }
  };

  const formatFormData = () => {
    const items = [];
    
    switch (template.type) {
      case 0: // PRICE_TOUCH
        items.push({ label: 'Asset', value: formData.asset });
        items.push({ label: 'Target Price', value: `$${formData.price}` });
        items.push({ label: 'Duration', value: formData.duration });
        items.push({ label: 'Source', value: 'Chainlink Oracle' });
        break;
      case 1: // ONCHAIN_EVENT
        items.push({ label: 'Address', value: `${formData.address?.slice(0, 10)}...` });
        items.push({ label: 'Action', value: formData.action });
        items.push({ label: 'Duration', value: formData.duration });
        items.push({ label: 'Source', value: 'Blockchain Events' });
        break;
      case 2: // API_COUNT
        items.push({ label: 'Account', value: `@${formData.username}` });
        items.push({ label: 'Min Tweets', value: formData.count });
        items.push({ label: 'Duration', value: formData.duration });
        items.push({ label: 'Source', value: 'Twitter API + ZK Proof' });
        break;
    }
    
    return items;
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Market Preview */}
      <Card style={styles.previewCard}>
        <LinearGradient
          colors={[colors.primary + '20', 'transparent']}
          style={styles.previewGradient}
        />
        <Text style={styles.previewIcon}>{template.icon}</Text>
        <Text style={styles.previewQuestion}>"{preview}"</Text>
        <View style={styles.previewMeta}>
          <Text style={styles.previewLabel}>{template.label}</Text>
        </View>
      </Card>

      {/* Market Details */}
      <Text style={styles.sectionTitle}>MARKET DETAILS</Text>
      <Card style={styles.detailsCard}>
        {formatFormData().map((item, index) => (
          <View key={index} style={styles.detailRow}>
            <Text style={styles.detailLabel}>{item.label}</Text>
            <Text style={styles.detailValue}>{item.value}</Text>
          </View>
        ))}
      </Card>

      {/* Creator Info */}
      <Text style={styles.sectionTitle}>CREATOR</Text>
      <Card style={styles.creatorCard}>
        <View style={styles.creatorRow}>
          <View style={styles.creatorAvatar}>
            <Text style={styles.creatorAvatarText}>
              {user?.username?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
          <View style={styles.creatorInfo}>
            <Text style={styles.creatorName}>@{user?.username || 'user'}</Text>
            <Text style={styles.creatorFid}>FID: {user?.fid || 'N/A'}</Text>
          </View>
        </View>
      </Card>

      {/* Fee Breakdown */}
      <Text style={styles.sectionTitle}>FEE BREAKDOWN</Text>
      <Card style={styles.feeCard}>
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Creation Fee</Text>
          <Text style={styles.feeValue}>{creationFee} {nativeTokenSymbol}</Text>
        </View>
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Platform Fee (1%)</Text>
          <Text style={styles.feeValue}>{platformFee.toFixed(4)} {nativeTokenSymbol}</Text>
        </View>
        <View style={[styles.feeRow, styles.feeTotalRow]}>
          <Text style={styles.feeTotalLabel}>Total</Text>
          <Text style={styles.feeTotalValue}>{totalCost.toFixed(4)} {nativeTokenSymbol}</Text>
        </View>
      </Card>

      {/* Wallet Balance */}
      <Card style={styles.balanceCard}>
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>Your Balance</Text>
          {isLoadingBalance ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text
              style={[
                styles.balanceValue,
                parseFloat(balance || 0) < totalCost && styles.balanceInsufficient,
              ]}
            >
              {parseFloat(balance || 0).toFixed(4)} {nativeTokenSymbol}
            </Text>
          )}
        </View>
        {balanceError && (
          <Text style={styles.balanceWarning}>
            ⚠️ Error fetching balance: {balanceError}
          </Text>
        )}
        {!isLoadingBalance && parseFloat(balance || 0) < totalCost && (
          <Text style={styles.balanceWarning}>
            ⚠️ Insufficient balance for this transaction
          </Text>
        )}
        {address && (
          <Text style={[styles.balanceWarning, { color: colors.textMuted }]}>
            Wallet: {address?.slice(0, 10)}...{address?.slice(-8)}
          </Text>
        )}
      </Card>

      {/* Auto-cast info */}
      {autoCast && (
        <Card style={styles.autoCastCard}>
          <Text style={styles.autoCastIcon}>📢</Text>
          <View style={styles.autoCastContent}>
            <Text style={styles.autoCastTitle}>Auto-cast enabled</Text>
            <Text style={styles.autoCastText}>
              This market will be automatically shared to your Farcaster feed
            </Text>
          </View>
        </Card>
      )}

      {/* Creation Progress */}
      {isCreating && creationStep && (
        <Card style={styles.progressCard}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.progressText}>{creationStep}</Text>
        </Card>
      )}

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Button
          title={isCreating ? (creationStep || 'Creating...') : 'Create Market'}
          onPress={handleCreate}
          disabled={isCreating || (!walletContext.isConnected)}
          style={styles.createButton}
          leftIcon={
            isCreating ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : null
          }
        />
        <Button
          title="← Back"
          variant="outline"
          onPress={() => navigation.goBack()}
          disabled={isCreating}
          style={styles.backButton}
        />
      </View>

      {/* Terms */}
      <Text style={styles.terms}>
        By creating this market, you agree to the FlashEvent Terms of Service.
        Markets are non-refundable once created.
      </Text>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.screenHorizontal,
  },
  previewCard: {
    alignItems: 'center',
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  previewGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  previewIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  previewQuestion: {
    ...typography.styles.h4,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  previewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewLabel: {
    ...typography.styles.caption,
    color: colors.primary,
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.xs,
  },
  sectionTitle: {
    ...typography.styles.label,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  detailsCard: {},
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLabel: {
    ...typography.styles.body,
    color: colors.textSecondary,
  },
  detailValue: {
    ...typography.styles.body,
    color: colors.text,
    fontWeight: '600',
  },
  creatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creatorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  creatorAvatarText: {
    ...typography.styles.h4,
    color: colors.white,
  },
  creatorInfo: {},
  creatorName: {
    ...typography.styles.h5,
    color: colors.text,
  },
  creatorFid: {
    ...typography.styles.caption,
    color: colors.textMuted,
  },
  feeCard: {},
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  feeLabel: {
    ...typography.styles.body,
    color: colors.textSecondary,
  },
  feeValue: {
    ...typography.styles.body,
    color: colors.text,
  },
  feeTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
  },
  feeTotalLabel: {
    ...typography.styles.h5,
    color: colors.text,
  },
  feeTotalValue: {
    ...typography.styles.h5,
    color: colors.primary,
  },
  balanceCard: {},
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    ...typography.styles.body,
    color: colors.textSecondary,
  },
  balanceValue: {
    ...typography.styles.h5,
    color: colors.success,
  },
  balanceInsufficient: {
    color: colors.error,
  },
  balanceWarning: {
    ...typography.styles.bodySmall,
    color: colors.error,
    marginTop: spacing.sm,
  },
  autoCastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '10',
    marginTop: spacing.lg,
  },
  autoCastIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  autoCastContent: {
    flex: 1,
  },
  autoCastTitle: {
    ...typography.styles.label,
    color: colors.primary,
  },
  autoCastText: {
    ...typography.styles.bodySmall,
    color: colors.textSecondary,
  },
  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '10',
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
  },
  progressText: {
    ...typography.styles.body,
    color: colors.primary,
    marginLeft: spacing.sm,
  },
  actions: {
    marginTop: spacing.xl,
  },
  createButton: {
    marginBottom: spacing.sm,
  },
  backButton: {},
  terms: {
    ...typography.styles.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  bottomPadding: {
    height: spacing['3xl'],
  },
});
