import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import { ethers } from 'ethers';
import Card from '../../components/common/Card';
import Avatar from '../../components/common/Avatar';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { colors, typography, spacing } from '../../styles/theme';
import { useAuthStore } from '../../store/authStore';
import { useWallet } from '../../context/WalletContext';
import { CONTRACT_ADDRESSES } from '../../config/contracts';
import config from '../../config';

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
  'function result() view returns (uint8)',
  'function yesBets(address) view returns (uint256)',
  'function noBets(address) view returns (uint256)',
  'function hasVoted(address) view returns (bool)',
  'function hasClaimed(address) view returns (bool)',
  'function totalYesBetsAmount() view returns (uint256)',
  'function totalNoBetsAmount() view returns (uint256)',
  'function getClaimableAmount(address) view returns (uint256 claimableAmount, uint256 feeDeducted)',
  'function isOneSided() view returns (bool)',
  'function creator() view returns (address)',
];

// Factory ABI for getting markets
const FACTORY_READ_ABI = [
  'function marketsCount() view returns (uint256)',
  'function getMarket(uint256) view returns (address)',
  'function getAllMarkets() view returns (address[])',
];

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuthStore();
  const { address, balance, isConnected, getProvider, disconnectWallet } = useWallet();

  const [stats, setStats] = useState({
    totalBets: 0,
    activeBets: 0,
    wonBets: 0,
    lostBets: 0,
    winRate: 0,
    totalWon: 0,
    totalLost: 0,
    netPnL: 0,
    marketsCreated: 0,
    claimable: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  /**
   * Fetch real stats from blockchain
   */
  const fetchUserStats = useCallback(async () => {
    if (!address || !isConnected) {
      setStats({
        totalBets: 0,
        activeBets: 0,
        wonBets: 0,
        lostBets: 0,
        winRate: 0,
        totalWon: 0,
        totalLost: 0,
        netPnL: 0,
        marketsCreated: 0,
        claimable: 0,
      });
      setIsLoading(false);
      return;
    }

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
      } catch (e) {
        const count = await factory.marketsCount();
        for (let i = 0; i < Number(count); i++) {
          const addr = await factory.getMarket(i);
          marketAddresses.push(addr);
        }
      }

      // Process all markets
      let totalBets = 0;
      let activeBets = 0;
      let wonBets = 0;
      let lostBets = 0;
      let totalWon = 0;
      let totalLost = 0;
      let marketsCreated = 0;
      let claimable = 0;

      const batchSize = 10;
      
      for (let i = 0; i < marketAddresses.length; i += batchSize) {
        const batch = marketAddresses.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (marketAddress) => {
          try {
            const market = new ethers.Contract(marketAddress, EXTENDED_MARKET_ABI, provider);
            
            // Check if user created this market
            const creatorAddress = await market.creator();
            if (creatorAddress.toLowerCase() === address.toLowerCase()) {
              marketsCreated++;
            }

            // Check if user has voted on this market
            const hasVoted = await market.hasVoted(address);
            if (!hasVoted) return;

            totalBets++;

            // Fetch bet details
            const [result, yesBet, noBet, hasClaimed, isOneSided] = await Promise.all([
              market.result(),
              market.yesBets(address),
              market.noBets(address),
              market.hasClaimed(address),
              market.isOneSided(),
            ]);

            const resultNum = Number(result);
            const yesBetAmount = parseFloat(ethers.formatEther(yesBet));
            const noBetAmount = parseFloat(ethers.formatEther(noBet));
            const userBetAmount = yesBetAmount > 0 ? yesBetAmount : noBetAmount;
            const userSide = yesBetAmount > 0 ? 'YES' : 'NO';

            if (resultNum === MARKET_RESULT.Pending) {
              // Active bet
              activeBets++;
            } else {
              // Resolved bet
              const winningOutcome = resultNum === MARKET_RESULT.Yes ? 'YES' : 'NO';
              const won = userSide === winningOutcome || isOneSided;

              if (won) {
                wonBets++;
                
                // Get claimable amount
                try {
                  const [claimableAmount] = await market.getClaimableAmount(address);
                  const claimableEth = parseFloat(ethers.formatEther(claimableAmount));
                  
                  if (hasClaimed) {
                    totalWon += claimableEth;
                  } else if (claimableEth > 0) {
                    claimable += claimableEth;
                  }
                } catch (e) {
                  // Couldn't get claimable amount
                }
              } else {
                lostBets++;
                totalLost += userBetAmount;
              }
            }
          } catch (e) {
            console.error('Error processing market:', e.message);
          }
        }));
      }

      const resolvedBets = wonBets + lostBets;
      const winRate = resolvedBets > 0 ? Math.round((wonBets / resolvedBets) * 100) : 0;
      const netPnL = totalWon - totalLost;

      setStats({
        totalBets,
        activeBets,
        wonBets,
        lostBets,
        winRate,
        totalWon,
        totalLost,
        netPnL,
        marketsCreated,
        claimable,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [address, isConnected, getProvider]);

  // Initial fetch
  useEffect(() => {
    fetchUserStats();
  }, [fetchUserStats]);

  // Pull to refresh
  const onRefresh = () => {
    setIsRefreshing(true);
    fetchUserStats();
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
            disconnectWallet();
            logout();
          },
        },
      ]
    );
  };

  const openFarcasterProfile = () => {
    if (user?.username) {
      Linking.openURL(`https://warpcast.com/${user.username}`);
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading profile..." />;
  }

  // Get native token symbol
  const nativeSymbol = config.DEFAULT_CHAIN?.nativeCurrency?.symbol || 'MON';

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {/* Profile Header */}
      <View style={styles.header}>
        <Avatar name={user?.display_name || user?.displayName || user?.username || 'User'} size={80} />
        <View style={styles.headerInfo}>
          <Text style={styles.displayName}>
            {user?.display_name || user?.displayName || user?.username || 'Anonymous'}
          </Text>
          <Text style={styles.username}>@{user?.username || 'user'}</Text>
          <Text style={styles.fid}>FID: {user?.fid || 'N/A'}</Text>
        </View>
        <TouchableOpacity
          style={styles.editButton}
          onPress={openFarcasterProfile}
        >
          <Text style={styles.editButtonText}>↗</Text>
        </TouchableOpacity>
      </View>

      {/* Wallet Section */}
      <Card style={styles.walletCard}>
        <View style={styles.walletHeader}>
          <Text style={styles.walletTitle}>💳 Wallet</Text>
          {address && (
            <TouchableOpacity
              onPress={() => {
                Linking.openURL(`${config.MONAD_EXPLORER_URL}/address/${address}`);
              }}
            >
              <Text style={styles.viewExplorer}>View on Explorer</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {address ? (
          <>
            <Text style={styles.walletAddress}>
              {address.slice(0, 8)}...{address.slice(-6)}
            </Text>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Balance</Text>
              <Text style={styles.balanceValue}>
                {typeof balance === 'number' ? balance.toFixed(4) : (balance || '0.0000')} {nativeSymbol}
              </Text>
            </View>
          </>
        ) : (
          <Button
            title="Connect Wallet"
            onPress={() => navigation.navigate('Wallet')}
            size="small"
          />
        )}
      </Card>

      {/* Claimable Banner */}
      {stats.claimable > 0 && (
        <TouchableOpacity 
          style={styles.claimableBanner}
          onPress={() => navigation.navigate('MyBets')}
        >
          <Text style={styles.claimableIcon}>🎁</Text>
          <View style={styles.claimableTextContainer}>
            <Text style={styles.claimableTitle}>Winnings Available!</Text>
            <Text style={styles.claimableAmount}>
              {stats.claimable.toFixed(4)} {nativeSymbol} ready to claim
            </Text>
          </View>
          <Text style={styles.claimableArrow}>→</Text>
        </TouchableOpacity>
      )}

      {/* Stats */}
      <Text style={styles.sectionTitle}>YOUR STATS</Text>
      <View style={styles.statsGrid}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{stats.totalBets}</Text>
          <Text style={styles.statLabel}>Total Bets</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, styles.winRateValue]}>
            {stats.winRate}%
          </Text>
          <Text style={styles.statLabel}>Win Rate</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, stats.netPnL >= 0 ? styles.positiveValue : styles.negativeValue]}>
            {stats.netPnL >= 0 ? '+' : ''}{stats.netPnL.toFixed(2)}
          </Text>
          <Text style={styles.statLabel}>Net P&L ({nativeSymbol})</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{stats.marketsCreated}</Text>
          <Text style={styles.statLabel}>Created</Text>
        </Card>
      </View>

      {/* Detailed Stats */}
      <Card style={styles.detailedStats}>
        <View style={styles.detailedRow}>
          <Text style={styles.detailedLabel}>Active Bets</Text>
          <Text style={styles.detailedValue}>{stats.activeBets}</Text>
        </View>
        <View style={styles.detailedRow}>
          <Text style={styles.detailedLabel}>Won Bets</Text>
          <Text style={[styles.detailedValue, styles.positiveValue]}>
            {stats.wonBets}
          </Text>
        </View>
        <View style={styles.detailedRow}>
          <Text style={styles.detailedLabel}>Lost Bets</Text>
          <Text style={[styles.detailedValue, styles.negativeValue]}>
            {stats.lostBets}
          </Text>
        </View>
        <View style={styles.detailedRow}>
          <Text style={styles.detailedLabel}>Total Won</Text>
          <Text style={[styles.detailedValue, styles.positiveValue]}>
            +{stats.totalWon.toFixed(4)} {nativeSymbol}
          </Text>
        </View>
        <View style={styles.detailedRow}>
          <Text style={styles.detailedLabel}>Total Lost</Text>
          <Text style={[styles.detailedValue, styles.negativeValue]}>
            -{stats.totalLost.toFixed(4)} {nativeSymbol}
          </Text>
        </View>
        <View style={styles.detailedRow}>
          <Text style={styles.detailedLabel}>Claimable</Text>
          <Text style={[styles.detailedValue, stats.claimable > 0 && styles.claimableValue]}>
            {stats.claimable.toFixed(4)} {nativeSymbol}
          </Text>
        </View>
      </Card>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
      <View style={styles.actionsGrid}>
        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => navigation.navigate('MyBets')}
        >
          <Text style={styles.actionIcon}>🎯</Text>
          <Text style={styles.actionLabel}>My Bets</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => navigation.navigate('Create')}
        >
          <Text style={styles.actionIcon}>➕</Text>
          <Text style={styles.actionLabel}>Create Market</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.actionIcon}>⚙️</Text>
          <Text style={styles.actionLabel}>Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionItem}
          onPress={openFarcasterProfile}
        >
          <Text style={styles.actionIcon}>🟣</Text>
          <Text style={styles.actionLabel}>Farcaster</Text>
        </TouchableOpacity>
      </View>

      {/* Sign Out */}
      <Button
        title="Sign Out"
        variant="outline"
        onPress={handleLogout}
        style={styles.signOutButton}
      />

      {/* App Info */}
      <View style={styles.appInfo}>
        <Text style={styles.appName}>FlashEvent Markets</Text>
        <Text style={styles.appVersion}>Version 1.0.0</Text>
        <Text style={styles.networkBadge}>Monad Testnet</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.screenHorizontal,
    paddingTop: spacing.lg,
  },
  headerInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  displayName: {
    ...typography.styles.h4,
    color: colors.text,
  },
  username: {
    ...typography.styles.body,
    color: colors.textSecondary,
  },
  fid: {
    ...typography.styles.caption,
    color: colors.textMuted,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    fontSize: 20,
    color: colors.primary,
  },
  walletCard: {
    marginHorizontal: spacing.screenHorizontal,
    marginTop: spacing.lg,
  },
  walletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  walletTitle: {
    ...typography.styles.h5,
    color: colors.text,
  },
  viewExplorer: {
    ...typography.styles.caption,
    color: colors.primary,
  },
  walletAddress: {
    ...typography.styles.body,
    color: colors.textSecondary,
    fontFamily: 'monospace',
    marginBottom: spacing.md,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  balanceLabel: {
    ...typography.styles.body,
    color: colors.textSecondary,
  },
  balanceValue: {
    ...typography.styles.h5,
    color: colors.success,
  },
  sectionTitle: {
    ...typography.styles.label,
    color: colors.textSecondary,
    marginHorizontal: spacing.screenHorizontal,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.screenHorizontal,
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
  },
  statValue: {
    ...typography.styles.h3,
    color: colors.text,
  },
  winRateValue: {
    color: colors.success,
  },
  positiveValue: {
    color: colors.success,
  },
  negativeValue: {
    color: colors.error,
  },
  claimableValue: {
    color: colors.success,
  },
  statLabel: {
    ...typography.styles.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  detailedStats: {
    marginHorizontal: spacing.screenHorizontal,
    marginTop: spacing.md,
  },
  detailedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailedLabel: {
    ...typography.styles.body,
    color: colors.textSecondary,
  },
  detailedValue: {
    ...typography.styles.body,
    color: colors.text,
    fontWeight: '600',
  },
  actionsGrid: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screenHorizontal,
    gap: spacing.sm,
  },
  actionItem: {
    flex: 1,
    backgroundColor: colors.backgroundCard,
    borderRadius: spacing.cardRadius,
    padding: spacing.md,
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  actionLabel: {
    ...typography.styles.caption,
    color: colors.text,
    textAlign: 'center',
  },
  signOutButton: {
    marginHorizontal: spacing.screenHorizontal,
    marginTop: spacing.xl,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  appName: {
    ...typography.styles.h5,
    color: colors.text,
  },
  appVersion: {
    ...typography.styles.caption,
    color: colors.textMuted,
  },
  networkBadge: {
    ...typography.styles.caption,
    color: colors.primary,
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.xs,
    marginTop: spacing.sm,
  },
  bottomPadding: {
    height: spacing['3xl'],
  },
  // Claimable banner styles
  claimableBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '20',
    marginHorizontal: spacing.screenHorizontal,
    marginVertical: spacing.md,
    padding: spacing.md,
    borderRadius: spacing.cardRadius,
    borderWidth: 1,
    borderColor: colors.success + '40',
  },
  claimableIcon: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  claimableTextContainer: {
    flex: 1,
  },
  claimableTitle: {
    ...typography.styles.label,
    color: colors.success,
    fontWeight: '700',
  },
  claimableAmount: {
    ...typography.styles.caption,
    color: colors.success,
    marginTop: 2,
  },
  claimableArrow: {
    fontSize: 20,
    color: colors.success,
    fontWeight: '700',
  },
});
