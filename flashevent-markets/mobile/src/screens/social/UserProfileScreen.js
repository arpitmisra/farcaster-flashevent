import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Card from '../../components/common/Card';
import Avatar from '../../components/common/Avatar';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import MarketCard from '../../components/market/MarketCard';
import { colors, typography, spacing } from '../../styles/theme';

const fetchUserProfile = async (userId) => {
  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 800));
  
  return {
    fid: userId,
    username: 'vitalik.eth',
    displayName: 'Vitalik Buterin',
    bio: 'Ethereum co-founder. Passionate about crypto, economics, and decentralization.',
    avatar: null,
    verified: true,
    followers: 234567,
    following: 1234,
    stats: {
      totalBets: 156,
      winRate: 68,
      totalVolume: 45.6,
      marketsCreated: 23,
    },
    recentMarkets: [
      {
        id: '1',
        question: 'Will ETH hit $5000 before EOY?',
        yesPercent: 62,
        totalVolume: 12.5,
        endsAt: Date.now() + 86400000 * 30,
        status: 'active',
      },
    ],
    recentBets: [
      {
        id: '1',
        market: 'Will ETH touch $4000 today?',
        side: 'YES',
        amount: 0.5,
        status: 'active',
      },
    ],
  };
};

export default function UserProfileScreen({ route, navigation }) {
  const { userId } = route.params;

  const {
    data: profile,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['userProfile', userId],
    queryFn: () => fetchUserProfile(userId),
    enabled: !!userId,
  });

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading profile..." />;
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>❌</Text>
        <Text style={styles.errorText}>User not found</Text>
        <Button
          title="Go Back"
          variant="outline"
          onPress={() => navigation.goBack()}
        />
      </View>
    );
  }

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={colors.primary}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Avatar name={profile.displayName} size={80} />
        <View style={styles.headerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.displayName}>{profile.displayName}</Text>
            {profile.verified && <Text style={styles.verified}>✓</Text>}
          </View>
          <Text style={styles.username}>@{profile.username}</Text>
          <Text style={styles.fid}>FID: {profile.fid}</Text>
        </View>
      </View>

      {/* Bio */}
      <Text style={styles.bio}>{profile.bio}</Text>

      {/* Follow stats */}
      <View style={styles.followStats}>
        <TouchableOpacity style={styles.followStat}>
          <Text style={styles.followCount}>{formatNumber(profile.followers)}</Text>
          <Text style={styles.followLabel}>Followers</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.followStat}>
          <Text style={styles.followCount}>{formatNumber(profile.following)}</Text>
          <Text style={styles.followLabel}>Following</Text>
        </TouchableOpacity>
      </View>

      {/* Follow button */}
      <View style={styles.actions}>
        <Button
          title="Follow"
          onPress={() => {}}
          style={styles.followButton}
        />
        <Button
          title="Message"
          variant="outline"
          onPress={() => {}}
          style={styles.messageButton}
        />
      </View>

      {/* Stats */}
      <Text style={styles.sectionTitle}>PREDICTION STATS</Text>
      <View style={styles.statsGrid}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{profile.stats.totalBets}</Text>
          <Text style={styles.statLabel}>Total Bets</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, styles.winRateValue]}>
            {profile.stats.winRate}%
          </Text>
          <Text style={styles.statLabel}>Win Rate</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{profile.stats.totalVolume}</Text>
          <Text style={styles.statLabel}>ETH Volume</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{profile.stats.marketsCreated}</Text>
          <Text style={styles.statLabel}>Markets</Text>
        </Card>
      </View>

      {/* Created Markets */}
      <Text style={styles.sectionTitle}>MARKETS CREATED</Text>
      {profile.recentMarkets.length > 0 ? (
        profile.recentMarkets.map((market) => (
          <MarketCard
            key={market.id}
            market={market}
            onPress={() => navigation.navigate('MarketDetail', { marketId: market.id })}
          />
        ))
      ) : (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>No markets created yet</Text>
        </Card>
      )}

      {/* Recent Activity */}
      <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
      {profile.recentBets.length > 0 ? (
        profile.recentBets.map((bet) => (
          <Card key={bet.id} style={styles.activityCard}>
            <View style={styles.activityHeader}>
              <Text style={styles.activityAction}>
                Bet{' '}
                <Text
                  style={bet.side === 'YES' ? styles.yesText : styles.noText}
                >
                  {bet.side}
                </Text>
              </Text>
              <Text style={styles.activityAmount}>{bet.amount} ETH</Text>
            </View>
            <Text style={styles.activityMarket}>{bet.market}</Text>
          </Card>
        ))
      ) : (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>No recent activity</Text>
        </Card>
      )}

      {/* View on Farcaster */}
      <TouchableOpacity style={styles.farcasterLink}>
        <Text style={styles.farcasterLinkText}>
          View full profile on Farcaster →
        </Text>
      </TouchableOpacity>

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
    marginLeft: spacing.md,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  displayName: {
    ...typography.styles.h4,
    color: colors.text,
  },
  verified: {
    color: colors.primary,
    fontSize: 18,
    marginLeft: spacing.xs,
  },
  username: {
    ...typography.styles.body,
    color: colors.textSecondary,
  },
  fid: {
    ...typography.styles.caption,
    color: colors.textMuted,
  },
  bio: {
    ...typography.styles.body,
    color: colors.textSecondary,
    paddingHorizontal: spacing.screenHorizontal,
    marginBottom: spacing.lg,
  },
  followStats: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screenHorizontal,
    marginBottom: spacing.lg,
  },
  followStat: {
    marginRight: spacing.xl,
  },
  followCount: {
    ...typography.styles.h5,
    color: colors.text,
  },
  followLabel: {
    ...typography.styles.caption,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screenHorizontal,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  followButton: {
    flex: 1,
  },
  messageButton: {
    flex: 1,
  },
  sectionTitle: {
    ...typography.styles.label,
    color: colors.textSecondary,
    marginHorizontal: spacing.screenHorizontal,
    marginTop: spacing.lg,
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
    ...typography.styles.h4,
    color: colors.text,
  },
  winRateValue: {
    color: colors.success,
  },
  statLabel: {
    ...typography.styles.caption,
    color: colors.textMuted,
  },
  activityCard: {
    marginHorizontal: spacing.screenHorizontal,
    marginBottom: spacing.sm,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  activityAction: {
    ...typography.styles.body,
    color: colors.text,
  },
  yesText: {
    color: colors.yes,
    fontWeight: 'bold',
  },
  noText: {
    color: colors.no,
    fontWeight: 'bold',
  },
  activityAmount: {
    ...typography.styles.body,
    color: colors.textSecondary,
  },
  activityMarket: {
    ...typography.styles.bodySmall,
    color: colors.textMuted,
  },
  emptyCard: {
    marginHorizontal: spacing.screenHorizontal,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.styles.body,
    color: colors.textMuted,
  },
  farcasterLink: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  farcasterLinkText: {
    ...typography.styles.body,
    color: colors.primary,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.styles.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  bottomPadding: {
    height: spacing['3xl'],
  },
});
