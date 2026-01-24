import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ethers } from 'ethers';
import Card from '../../components/common/Card';
import { colors, typography, spacing } from '../../styles/theme';
import { useWallet } from '../../context/WalletContext';
import { CONTRACT_ADDRESSES } from '../../config/contracts';
import config from '../../config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Logger
const logger = {
  info: (msg, data) => console.log('[MyBets]', msg, data || ''),
  error: (msg, data) => console.error('[MyBets]', msg, data || ''),
};

// Tab configuration
const TABS = [
  { id: 'active', label: 'Active', icon: '⏳' },
  { id: 'claimable', label: 'Claim', icon: '🎁' },
  { id: 'resolved', label: 'History', icon: '📜' },
];

// Market Result enum (matches contract)
const MARKET_RESULT = {
  Pending: 0,
  Yes: 1,
  No: 2,
};

// Extended Market ABI for reading bet data
const EXTENDED_MARKET_ABI = [
  'function question() view returns (string)',
  'function expiry() view returns (uint256)',
  'function bettingDeadline() view returns (uint256)',
  'function result() view returns (uint8)',
  'function yesBets(address) view returns (uint256)',
  'function noBets(address) view returns (uint256)',
  'function hasVoted(address) view returns (bool)',
  'function hasClaimed(address) view returns (bool)',
  'function totalYesBetsAmount() view returns (uint256)',
  'function totalNoBetsAmount() view returns (uint256)',
  'function totalYesBets() view returns (uint256)',
  'function totalNoBets() view returns (uint256)',
  'function getClaimableAmount(address) view returns (uint256 claimableAmount, uint256 feeDeducted)',
  'function isOneSided() view returns (bool)',
  'function claim() returns (uint256)',
  'function creator() view returns (address)',
];

// Factory ABI for getting markets
const FACTORY_READ_ABI = [
  'function marketsCount() view returns (uint256)',
  'function getMarket(uint256) view returns (address)',
  'function getAllMarkets() view returns (address[])',
];

export default function MyBetsScreen({ navigation }) {
  const { address, isConnected, getProvider, sendTransaction } = useWallet();
  
  const [activeTab, setActiveTab] = useState('active');
  const [bets, setBets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isClaiming, setIsClaiming] = useState(null);
  const [stats, setStats] = useState({
    totalBets: 0,
    activeBets: 0,
    wonBets: 0,
    lostBets: 0,
    totalWagered: '0',
    totalWon: '0',
    claimable: '0',
  });
  
  // Animated values
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];

  // Get native token symbol
  const nativeSymbol = config.DEFAULT_CHAIN?.nativeCurrency?.symbol || 'MON';

  /**
   * Fetch all user bets directly from blockchain
   */
  const fetchUserBets = useCallback(async () => {
    if (!address || !isConnected) {
      setBets([]);
      setIsLoading(false);
      return;
    }

    logger.info('Fetching bets for address:', address);

    try {
      const provider = getProvider();
      if (!provider) {
        throw new Error('Provider not available');
      }

      // Get factory contract
      const factory = new ethers.Contract(
        CONTRACT_ADDRESSES.MARKET_FACTORY,
        FACTORY_READ_ABI,
        provider
      );

      // Get all market addresses
      let marketAddresses = [];
      try {
        marketAddresses = await factory.getAllMarkets();
        logger.info(`Found ${marketAddresses.length} markets`);
      } catch (e) {
        // Fallback: iterate through markets
        const count = await factory.marketsCount();
        for (let i = 0; i < Number(count); i++) {
          const addr = await factory.getMarket(i);
          marketAddresses.push(addr);
        }
      }

      // Check each market for user bets
      const userBets = [];
      const batchSize = 10; // Process in batches for performance
      
      for (let i = 0; i < marketAddresses.length; i += batchSize) {
        const batch = marketAddresses.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (marketAddress) => {
          try {
            const market = new ethers.Contract(marketAddress, EXTENDED_MARKET_ABI, provider);
            
            // Check if user has voted on this market
            const hasVoted = await market.hasVoted(address);
            if (!hasVoted) return null;

            // User has a bet - fetch all details in parallel
            const [
              question,
              expiry,
              bettingDeadline,
              result,
              yesBet,
              noBet,
              hasClaimed,
              totalYes,
              totalNo,
              totalYesBets,
              totalNoBets,
              isOneSided,
              creator,
            ] = await Promise.all([
              market.question(),
              market.expiry(),
              market.bettingDeadline(),
              market.result(),
              market.yesBets(address),
              market.noBets(address),
              market.hasClaimed(address),
              market.totalYesBetsAmount(),
              market.totalNoBetsAmount(),
              market.totalYesBets(),
              market.totalNoBets(),
              market.isOneSided(),
              market.creator(),
            ]);

            const now = Math.floor(Date.now() / 1000);
            const expiryNum = Number(expiry);
            const resultNum = Number(result);
            const yesBetAmount = ethers.formatEther(yesBet);
            const noBetAmount = ethers.formatEther(noBet);
            const userBetAmount = parseFloat(yesBetAmount) > 0 ? yesBetAmount : noBetAmount;
            const userSide = parseFloat(yesBetAmount) > 0 ? 'YES' : 'NO';
            
            // Calculate potential payout / claimable
            let claimableAmount = '0';
            let feeDeducted = '0';
            let potentialPayout = '0';
            
            if (resultNum !== MARKET_RESULT.Pending) {
              try {
                const [claimable, fee] = await market.getClaimableAmount(address);
                claimableAmount = ethers.formatEther(claimable);
                feeDeducted = ethers.formatEther(fee);
              } catch (e) {
                // User didn't bet on winning side
                claimableAmount = '0';
              }
            } else {
              // Calculate potential payout for active markets
              const totalPool = parseFloat(ethers.formatEther(totalYes)) + parseFloat(ethers.formatEther(totalNo));
              const userBetFloat = parseFloat(userBetAmount);
              const winningPool = userSide === 'YES' ? parseFloat(ethers.formatEther(totalYes)) : parseFloat(ethers.formatEther(totalNo));
              
              if (winningPool > 0 && totalPool > 0) {
                // Simplified potential payout (assuming user wins)
                const feeRate = 0.075; // 7.5% total fees
                const distributablePool = totalPool * (1 - feeRate);
                potentialPayout = ((userBetFloat / winningPool) * distributablePool).toFixed(4);
              }
            }

            // Determine bet status
            let status = 'active';
            let statusLabel = 'Active';
            let won = null;
            
            if (resultNum !== MARKET_RESULT.Pending) {
              const winningOutcome = resultNum === MARKET_RESULT.Yes ? 'YES' : 'NO';
              won = userSide === winningOutcome || isOneSided;
              
              if (hasClaimed) {
                status = 'claimed';
                statusLabel = won ? 'Claimed ✓' : 'Lost';
              } else if (won && parseFloat(claimableAmount) > 0) {
                status = 'claimable';
                statusLabel = 'Claim Now!';
              } else {
                status = 'resolved';
                statusLabel = won ? 'Won' : 'Lost';
              }
            } else if (expiryNum < now) {
              status = 'pending_resolution';
              statusLabel = 'Awaiting Result';
            }

            // Calculate odds/probability
            const totalBetsCount = Number(totalYesBets) + Number(totalNoBets);
            const yesOdds = totalBetsCount > 0 ? (Number(totalYesBets) / totalBetsCount * 100).toFixed(0) : 50;
            const noOdds = totalBetsCount > 0 ? (Number(totalNoBets) / totalBetsCount * 100).toFixed(0) : 50;

            return {
              id: marketAddress,
              marketAddress,
              question,
              expiry: expiryNum,
              bettingDeadline: Number(bettingDeadline),
              result: resultNum,
              side: userSide,
              amount: userBetAmount,
              hasClaimed,
              claimableAmount,
              feeDeducted,
              potentialPayout,
              status,
              statusLabel,
              won,
              isOneSided,
              creator,
              totalPool: ethers.formatEther(BigInt(totalYes) + BigInt(totalNo)),
              yesPool: ethers.formatEther(totalYes),
              noPool: ethers.formatEther(totalNo),
              totalBetsCount,
              yesOdds,
              noOdds,
              timestamp: expiryNum * 1000, // For sorting
            };
          } catch (error) {
            logger.error(`Error fetching market ${marketAddress}:`, error.message);
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        userBets.push(...batchResults.filter(Boolean));
      }

      // Sort by timestamp (newest first)
      userBets.sort((a, b) => b.timestamp - a.timestamp);
      
      logger.info(`Found ${userBets.length} bets for user`);
      setBets(userBets);

      // Calculate stats
      const totalBets = userBets.length;
      const activeBets = userBets.filter(b => b.status === 'active' || b.status === 'pending_resolution').length;
      const wonBets = userBets.filter(b => b.won === true).length;
      const lostBets = userBets.filter(b => b.won === false).length;
      const totalWagered = userBets.reduce((sum, b) => sum + parseFloat(b.amount), 0);
      const totalWon = userBets
        .filter(b => b.won && b.hasClaimed)
        .reduce((sum, b) => sum + parseFloat(b.claimableAmount || 0), 0);
      const claimable = userBets
        .filter(b => b.status === 'claimable')
        .reduce((sum, b) => sum + parseFloat(b.claimableAmount), 0);

      setStats({
        totalBets,
        activeBets,
        wonBets,
        lostBets,
        totalWagered: totalWagered.toFixed(4),
        totalWon: totalWon.toFixed(4),
        claimable: claimable.toFixed(4),
      });

      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();

    } catch (error) {
      logger.error('Failed to fetch bets:', error.message);
      Alert.alert('Error', 'Failed to load your bets. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [address, isConnected, getProvider, fadeAnim, slideAnim]);

  // Initial load
  useEffect(() => {
    fetchUserBets();
  }, [fetchUserBets]);

  // Refresh handler
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchUserBets();
  }, [fetchUserBets]);

  /**
   * Claim winnings from a market
   */
  const handleClaim = useCallback(async (bet) => {
    if (!isConnected || !address) {
      Alert.alert('Not Connected', 'Please connect your wallet to claim.');
      return;
    }

    setIsClaiming(bet.marketAddress);

    try {
      logger.info('Claiming from market:', bet.marketAddress);

      // Encode claim function call
      const marketInterface = new ethers.Interface(EXTENDED_MARKET_ABI);
      const data = marketInterface.encodeFunctionData('claim');

      logger.info('Encoded claim data:', data);

      // Send transaction via wallet (sendTransaction already waits for confirmation)
      const txResult = await sendTransaction({
        to: bet.marketAddress,
        data: data,
        value: '0x0',
      });

      logger.info('Transaction result:', JSON.stringify(txResult));

      // Extract transaction hash from result
      const txHash = typeof txResult === 'string' 
        ? txResult 
        : (txResult?.hash || txResult?.transactionHash);
      
      if (!txHash) {
        throw new Error('No transaction hash received');
      }

      logger.info('Claim transaction hash:', txHash);

      // Check if we already have a receipt with status (sendTransaction returns receipt)
      const status = txResult?.status;
      const isConfirmed = status === 1 || status === 'pending'; // 'pending' means tx was sent

      if (isConfirmed || typeof txResult === 'string') {
        Alert.alert(
          '🎉 Claimed Successfully!',
          `Your winnings have been sent to your wallet!\n\nTx: ${txHash.slice(0, 10)}...${txHash.slice(-8)}`,
          [{ text: 'Great!', style: 'default' }]
        );
        
        // Refresh bets
        fetchUserBets();
      } else if (status === 0) {
        throw new Error('Transaction failed on chain');
      } else {
        // If we only got a hash, show success (tx was sent)
        Alert.alert(
          '🎉 Claim Submitted!',
          `Transaction sent! Check your wallet for confirmation.\n\nTx: ${txHash.slice(0, 10)}...${txHash.slice(-8)}`,
          [{ text: 'OK', style: 'default' }]
        );
        fetchUserBets();
      }
    } catch (error) {
      logger.error('Claim failed:', error.message);
      
      let errorMsg = error.message;
      if (error.message?.includes('rejected') || error.message?.includes('denied')) {
        errorMsg = 'Transaction was rejected. Please try again.';
      } else if (error.message?.includes('timeout') || error.message?.includes('expired')) {
        errorMsg = 'Request timed out. Please check MetaMask and try again.';
      } else if (error.message?.includes('AlreadyClaimed')) {
        errorMsg = 'You have already claimed from this market.';
      } else if (error.message?.includes('MarketNotResolved')) {
        errorMsg = 'This market has not been resolved yet.';
      }
      
      Alert.alert('Claim Failed', errorMsg);
    } finally {
      setIsClaiming(null);
    }
  }, [isConnected, address, sendTransaction, fetchUserBets]);

  /**
   * Claim all claimable winnings
   */
  const handleClaimAll = useCallback(async () => {
    if (!isConnected || !address) {
      Alert.alert('Not Connected', 'Please connect your wallet to claim.');
      return;
    }

    const claimableBets = bets.filter(b => b.status === 'claimable');
    
    if (claimableBets.length === 0) {
      Alert.alert('Nothing to Claim', 'You have no winnings to claim.');
      return;
    }

    // Confirm claim all
    Alert.alert(
      '🎁 Claim All Winnings',
      `You have ${claimableBets.length} market(s) with winnings totaling ${stats.claimable} ${nativeSymbol}.\n\nYou will need to approve ${claimableBets.length} transaction(s) in MetaMask.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Claim All',
          style: 'default',
          onPress: async () => {
            let successCount = 0;
            let failCount = 0;

            for (const bet of claimableBets) {
              try {
                setIsClaiming(bet.marketAddress);
                logger.info('Claiming from market:', bet.marketAddress);

                const marketInterface = new ethers.Interface(EXTENDED_MARKET_ABI);
                const data = marketInterface.encodeFunctionData('claim');

                const txResult = await sendTransaction({
                  to: bet.marketAddress,
                  data: data,
                  value: '0x0',
                });

                const txHash = typeof txResult === 'string' 
                  ? txResult 
                  : (txResult?.hash || txResult?.transactionHash);
                
                if (txHash) {
                  logger.info('Claim successful:', txHash);
                  successCount++;
                } else {
                  failCount++;
                }
              } catch (error) {
                logger.error('Claim failed for', bet.marketAddress, error.message);
                failCount++;
                
                // If user rejected, stop the loop
                if (error.message?.includes('rejected') || error.message?.includes('denied')) {
                  Alert.alert(
                    'Claim Cancelled',
                    `Claimed ${successCount} of ${claimableBets.length} markets before cancellation.`,
                    [{ text: 'OK' }]
                  );
                  break;
                }
              }
            }

            setIsClaiming(null);
            
            // Show summary
            if (successCount > 0) {
              Alert.alert(
                '🎉 Claims Complete!',
                `Successfully claimed from ${successCount} market(s)!${failCount > 0 ? `\n\n${failCount} claim(s) failed.` : ''}`,
                [{ text: 'Great!', style: 'default' }]
              );
            } else if (failCount > 0) {
              Alert.alert('Claims Failed', 'Could not claim from any markets. Please try again.');
            }
            
            // Refresh bets
            fetchUserBets();
          },
        },
      ]
    );
  }, [isConnected, address, bets, stats.claimable, nativeSymbol, sendTransaction, fetchUserBets]);

  // Filter bets by active tab
  const filteredBets = useMemo(() => {
    switch (activeTab) {
      case 'active':
        return bets.filter(b => b.status === 'active' || b.status === 'pending_resolution');
      case 'claimable':
        return bets.filter(b => b.status === 'claimable');
      case 'resolved':
        return bets.filter(b => ['resolved', 'claimed'].includes(b.status));
      default:
        return bets;
    }
  }, [bets, activeTab]);

  // Format time remaining or ago
  const formatTime = (timestamp) => {
    const now = Date.now();
    const diff = timestamp * 1000 - now;
    
    if (diff > 0) {
      // Future - time remaining
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      if (hours > 24) {
        return `${Math.floor(hours / 24)}d ${hours % 24}h left`;
      }
      return hours > 0 ? `${hours}h ${mins}m left` : `${mins}m left`;
    } else {
      // Past - time ago
      const absDiff = Math.abs(diff);
      const hours = Math.floor(absDiff / 3600000);
      const days = Math.floor(hours / 24);
      if (days > 0) return `${days}d ago`;
      if (hours > 0) return `${hours}h ago`;
      return 'Just now';
    }
  };

  // Render bet card
  const renderBetCard = ({ item, index }) => {
    const isClaimable = item.status === 'claimable';
    const isWon = item.won === true;
    const isLost = item.won === false;
    const isActive = item.status === 'active' || item.status === 'pending_resolution';
    
    return (
      <Animated.View
        style={[
          styles.cardContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate('MarketDetail', { 
            marketId: item.marketAddress,
            marketAddress: item.marketAddress,
          })}
        >
          <Card style={[
            styles.betCard,
            isClaimable && styles.betCardClaimable,
            isWon && !isClaimable && styles.betCardWon,
            isLost && styles.betCardLost,
          ]}>
            {/* Glow effect for claimable */}
            {isClaimable && (
              <LinearGradient
                colors={['rgba(0, 255, 136, 0.15)', 'rgba(0, 255, 136, 0)']}
                style={styles.glowEffect}
              />
            )}

            {/* Status Badge */}
            <View style={[
              styles.statusBadge,
              isClaimable && styles.statusBadgeClaimable,
              isWon && !isClaimable && styles.statusBadgeWon,
              isLost && styles.statusBadgeLost,
              isActive && styles.statusBadgeActive,
            ]}>
              <Text style={[
                styles.statusBadgeText,
                isClaimable && styles.statusBadgeTextClaimable,
                isWon && !isClaimable && styles.statusBadgeTextWon,
                isLost && styles.statusBadgeTextLost,
              ]}>
                {item.statusLabel}
              </Text>
            </View>

            {/* Question */}
            <Text style={styles.question} numberOfLines={2}>
              {item.question}
            </Text>

            {/* Market Info Row */}
            <View style={styles.marketInfoRow}>
              <View style={styles.timeContainer}>
                <Text style={styles.timeIcon}>⏱️</Text>
                <Text style={styles.timeText}>{formatTime(item.expiry)}</Text>
              </View>
              <View style={styles.poolContainer}>
                <Text style={styles.poolLabel}>Pool</Text>
                <Text style={styles.poolValue}>{parseFloat(item.totalPool).toFixed(2)} {nativeSymbol}</Text>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Your Bet Section */}
            <View style={styles.betDetails}>
              {/* Side & Amount */}
              <View style={styles.betMain}>
                <View style={[
                  styles.sideBadge,
                  item.side === 'YES' ? styles.sideBadgeYes : styles.sideBadgeNo,
                ]}>
                  <Text style={[
                    styles.sideText,
                    item.side === 'YES' ? styles.sideTextYes : styles.sideTextNo,
                  ]}>
                    {item.side === 'YES' ? '👍 YES' : '👎 NO'}
                  </Text>
                </View>
                <View style={styles.amountContainer}>
                  <Text style={styles.amountLabel}>Your Bet</Text>
                  <Text style={styles.amountValue}>{parseFloat(item.amount).toFixed(4)} {nativeSymbol}</Text>
                </View>
              </View>

              {/* Payout/Result */}
              <View style={styles.payoutContainer}>
                {isActive ? (
                  <>
                    <Text style={styles.payoutLabel}>Est. Payout</Text>
                    <Text style={styles.payoutValue}>
                      ~{item.potentialPayout} {nativeSymbol}
                    </Text>
                    <Text style={styles.oddsText}>
                      {item.side === 'YES' ? item.yesOdds : item.noOdds}% odds
                    </Text>
                  </>
                ) : isClaimable ? (
                  <>
                    <Text style={styles.payoutLabelWin}>🎉 You Won!</Text>
                    <Text style={styles.payoutValueWin}>
                      +{parseFloat(item.claimableAmount).toFixed(4)} {nativeSymbol}
                    </Text>
                    <Text style={styles.feeText}>
                      (Fee: {parseFloat(item.feeDeducted).toFixed(4)})
                    </Text>
                  </>
                ) : isWon ? (
                  <>
                    <Text style={styles.payoutLabelClaimed}>Claimed ✓</Text>
                    <Text style={styles.payoutValueClaimed}>
                      +{parseFloat(item.claimableAmount || item.amount).toFixed(4)} {nativeSymbol}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.payoutLabelLost}>Lost</Text>
                    <Text style={styles.payoutValueLost}>
                      -{parseFloat(item.amount).toFixed(4)} {nativeSymbol}
                    </Text>
                  </>
                )}
              </View>
            </View>

            {/* Claim Button */}
            {isClaimable && (
              <TouchableOpacity
                style={styles.claimButton}
                onPress={() => handleClaim(item)}
                disabled={isClaiming === item.marketAddress}
              >
                <LinearGradient
                  colors={['#00FF88', '#00CC6A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.claimButtonGradient}
                >
                  {isClaiming === item.marketAddress ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <>
                      <Text style={styles.claimButtonIcon}>💰</Text>
                      <Text style={styles.claimButtonText}>
                        Claim {parseFloat(item.claimableAmount).toFixed(4)} {nativeSymbol}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}
          </Card>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Render header with stats
  const renderHeader = () => (
    <View style={styles.header}>
      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <LinearGradient
          colors={['#1a1a2e', '#16213e']}
          style={styles.statsGradient}
        >
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalBets}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, styles.statValueActive]}>{stats.activeBets}</Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, styles.statValueWon]}>{stats.wonBets}</Text>
              <Text style={styles.statLabel}>Won</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, styles.statValueLost]}>{stats.lostBets}</Text>
              <Text style={styles.statLabel}>Lost</Text>
            </View>
          </View>
          
          {/* Claimable Banner */}
          {parseFloat(stats.claimable) > 0 && (
            <View style={styles.claimableBanner}>
              <LinearGradient
                colors={['rgba(0, 255, 136, 0.2)', 'rgba(0, 204, 106, 0.1)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.claimableBannerGradient}
              >
                <Text style={styles.claimableBannerIcon}>🎁</Text>
                <Text style={styles.claimableBannerText}>
                  {stats.claimable} {nativeSymbol} ready to claim!
                </Text>
                <TouchableOpacity 
                  onPress={handleClaimAll}
                  style={styles.claimableBannerButton}
                  disabled={isClaiming !== null}
                >
                  {isClaiming !== null ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <Text style={styles.claimableBannerButtonText}>Claim All 💰</Text>
                  )}
                </TouchableOpacity>
              </LinearGradient>
            </View>
          )}
        </LinearGradient>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {TABS.map((tab) => {
          const count = tab.id === 'active' ? stats.activeBets :
                       tab.id === 'claimable' ? bets.filter(b => b.status === 'claimable').length :
                       bets.filter(b => ['resolved', 'claimed'].includes(b.status)).length;
          
          return (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tab,
                activeTab === tab.id && styles.tabActive,
              ]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text style={styles.tabIcon}>{tab.icon}</Text>
              <Text style={[
                styles.tabText,
                activeTab === tab.id && styles.tabTextActive,
              ]}>
                {tab.label}
              </Text>
              {count > 0 && (
                <View style={[
                  styles.tabBadge,
                  activeTab === tab.id && styles.tabBadgeActive,
                  tab.id === 'claimable' && count > 0 && styles.tabBadgeClaimable,
                ]}>
                  <Text style={[
                    styles.tabBadgeText,
                    tab.id === 'claimable' && count > 0 && styles.tabBadgeTextClaimable,
                  ]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // Render empty state
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>
        {activeTab === 'claimable' ? '🎁' : activeTab === 'resolved' ? '📜' : '🎯'}
      </Text>
      <Text style={styles.emptyTitle}>
        {activeTab === 'claimable' ? 'No Winnings to Claim' :
         activeTab === 'resolved' ? 'No Bet History' :
         'No Active Bets'}
      </Text>
      <Text style={styles.emptyText}>
        {activeTab === 'claimable' 
          ? 'When you win a prediction, your winnings will appear here!'
          : activeTab === 'resolved'
          ? 'Your completed bets will show up here.'
          : "Start predicting to see your active bets here!"}
      </Text>
      {activeTab !== 'claimable' && (
        <TouchableOpacity
          style={styles.emptyButton}
          onPress={() => navigation.navigate('Markets')}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryDark || '#5A2FC9']}
            style={styles.emptyButtonGradient}
          >
            <Text style={styles.emptyButtonText}>Browse Markets</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );

  // Not connected state
  if (!isConnected) {
    return (
      <View style={styles.container}>
        <View style={styles.notConnectedContainer}>
          <Text style={styles.notConnectedIcon}>🔗</Text>
          <Text style={styles.notConnectedTitle}>Wallet Not Connected</Text>
          <Text style={styles.notConnectedText}>
            Connect your wallet to view your bets and claim winnings.
          </Text>
        </View>
      </View>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading your bets...</Text>
          <Text style={styles.loadingSubtext}>Scanning blockchain data</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredBets}
        renderItem={renderBetCard}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  // Loading & Not Connected States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.styles.h4,
    color: colors.text,
    marginTop: spacing.lg,
  },
  loadingSubtext: {
    ...typography.styles.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  notConnectedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  notConnectedIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  notConnectedTitle: {
    ...typography.styles.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  notConnectedText: {
    ...typography.styles.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  
  // Header & Stats
  header: {
    paddingHorizontal: spacing.screenHorizontal,
    paddingTop: spacing.md,
  },
  statsContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  statsGradient: {
    padding: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  statValue: {
    ...typography.styles.h3,
    color: colors.text,
    fontWeight: 'bold',
  },
  statValueActive: {
    color: colors.primary,
  },
  statValueWon: {
    color: colors.success,
  },
  statValueLost: {
    color: colors.error,
  },
  statLabel: {
    ...typography.styles.caption,
    color: colors.textMuted,
    marginTop: 4,
  },
  
  // Claimable Banner
  claimableBanner: {
    marginTop: spacing.md,
    borderRadius: 12,
    overflow: 'hidden',
  },
  claimableBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  claimableBannerIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  claimableBannerText: {
    ...typography.styles.body,
    color: '#00FF88',
    fontWeight: '600',
    flex: 1,
  },
  claimableBannerButton: {
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  claimableBannerButtonText: {
    ...typography.styles.label,
    color: '#00FF88',
    fontWeight: 'bold',
  },
  
  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundCard,
    borderRadius: 12,
    padding: 4,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  tabText: {
    ...typography.styles.label,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  tabBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 6,
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  tabBadgeClaimable: {
    backgroundColor: '#00FF88',
  },
  tabBadgeText: {
    ...typography.styles.caption,
    color: colors.text,
    fontWeight: 'bold',
    fontSize: 10,
  },
  tabBadgeTextClaimable: {
    color: '#000',
  },
  
  // List
  listContent: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  
  // Bet Card
  cardContainer: {
    paddingHorizontal: spacing.screenHorizontal,
    marginBottom: spacing.md,
  },
  betCard: {
    borderRadius: 16,
    padding: spacing.lg,
    backgroundColor: colors.backgroundCard,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    position: 'relative',
    overflow: 'hidden',
  },
  betCardClaimable: {
    borderColor: 'rgba(0, 255, 136, 0.3)',
  },
  betCardWon: {
    borderColor: 'rgba(0, 255, 136, 0.15)',
  },
  betCardLost: {
    borderColor: 'rgba(255, 107, 107, 0.15)',
  },
  glowEffect: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  
  // Status Badge
  statusBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusBadgeClaimable: {
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
  },
  statusBadgeWon: {
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
  },
  statusBadgeLost: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
  },
  statusBadgeActive: {
    backgroundColor: 'rgba(138, 43, 226, 0.2)',
  },
  statusBadgeText: {
    ...typography.styles.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  statusBadgeTextClaimable: {
    color: '#00FF88',
  },
  statusBadgeTextWon: {
    color: colors.success,
  },
  statusBadgeTextLost: {
    color: colors.error,
  },
  
  // Question
  question: {
    ...typography.styles.body,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.md,
    marginRight: 80, // Space for badge
    lineHeight: 22,
  },
  
  // Market Info Row
  marketInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  timeText: {
    ...typography.styles.caption,
    color: colors.textMuted,
  },
  poolContainer: {
    alignItems: 'flex-end',
  },
  poolLabel: {
    ...typography.styles.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  poolValue: {
    ...typography.styles.label,
    color: colors.text,
    fontWeight: '600',
  },
  
  // Divider
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: spacing.md,
  },
  
  // Bet Details
  betDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  betMain: {
    flex: 1,
  },
  sideBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  sideBadgeYes: {
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
  },
  sideBadgeNo: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
  },
  sideText: {
    ...typography.styles.label,
    fontWeight: 'bold',
  },
  sideTextYes: {
    color: '#00FF88',
  },
  sideTextNo: {
    color: '#FF6B6B',
  },
  amountContainer: {
    marginTop: spacing.xs,
  },
  amountLabel: {
    ...typography.styles.caption,
    color: colors.textMuted,
    marginBottom: 2,
  },
  amountValue: {
    ...typography.styles.body,
    color: colors.text,
    fontWeight: '600',
  },
  
  // Payout Section
  payoutContainer: {
    alignItems: 'flex-end',
    minWidth: 120,
  },
  payoutLabel: {
    ...typography.styles.caption,
    color: colors.textMuted,
    marginBottom: 2,
  },
  payoutValue: {
    ...typography.styles.body,
    color: colors.text,
    fontWeight: '600',
  },
  payoutLabelWin: {
    ...typography.styles.caption,
    color: '#00FF88',
    fontWeight: '600',
    marginBottom: 2,
  },
  payoutValueWin: {
    ...typography.styles.h4,
    color: '#00FF88',
    fontWeight: 'bold',
  },
  payoutLabelClaimed: {
    ...typography.styles.caption,
    color: colors.success,
    marginBottom: 2,
  },
  payoutValueClaimed: {
    ...typography.styles.body,
    color: colors.success,
    fontWeight: '600',
  },
  payoutLabelLost: {
    ...typography.styles.caption,
    color: colors.error,
    marginBottom: 2,
  },
  payoutValueLost: {
    ...typography.styles.body,
    color: colors.error,
    fontWeight: '600',
  },
  oddsText: {
    ...typography.styles.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  feeText: {
    ...typography.styles.caption,
    color: colors.textMuted,
    marginTop: 2,
    fontSize: 10,
  },
  
  // Claim Button
  claimButton: {
    marginTop: spacing.lg,
    borderRadius: 12,
    overflow: 'hidden',
  },
  claimButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  claimButtonIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  claimButtonText: {
    ...typography.styles.body,
    color: '#000',
    fontWeight: 'bold',
  },
  
  // Empty State
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['3xl'],
    paddingBottom: spacing['3xl'],
  },
  emptyIcon: {
    fontSize: 72,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.styles.h3,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    ...typography.styles.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  emptyButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  emptyButtonGradient: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  emptyButtonText: {
    ...typography.styles.body,
    color: colors.white,
    fontWeight: '600',
  },
});
