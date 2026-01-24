import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  TextInput,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Card from '../../components/common/Card';
import Avatar from '../../components/common/Avatar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { colors, typography, spacing } from '../../styles/theme';
import { useAuthStore } from '../../store/authStore';
import { formatTimeAgo } from '../../utils/format';
import { neynarService } from '../../services/neynarService';

const TABS = ['For You', 'Following', 'Markets'];

// Fetch feed from backend API (which uses Neynar)
const fetchSocialFeed = async (tab, fid) => {
  if (!fid) {
    throw new Error('Not authenticated');
  }

  try {
    let feedType = 'trending';
    if (tab === 'Following') {
      feedType = 'following';
    }

    console.log('[SocialFeed] Fetching feed:', { fid, feedType });
    const response = await neynarService.getFeed(fid, feedType, 25);
    
    // Transform Farcaster casts to our feed format
    const casts = response.casts || [];
    console.log('[SocialFeed] Received', casts.length, 'casts');
    
    return casts.map((cast) => ({
      id: cast.hash,
      type: 'cast',
      user: {
        fid: cast.author?.fid,
        username: cast.author?.username,
        displayName: cast.author?.display_name,
        avatar: cast.author?.pfp_url,
        verified: cast.author?.power_badge || false,
      },
      text: cast.text,
      embeds: cast.embeds || [],
      timestamp: new Date(cast.timestamp).getTime(),
      reactions: {
        likes: cast.reactions?.likes_count || 0,
        recasts: cast.reactions?.recasts_count || 0,
        replies: cast.replies?.count || 0,
      },
      hash: cast.hash,
    }));
  } catch (error) {
    console.error('[SocialFeed] Error fetching feed:', error);
    // Return empty array instead of throwing to prevent error screen
    return [];
  }
};

export default function SocialFeedScreen({ navigation }) {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('For You');

  const {
    data: feed,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['socialFeed', activeTab, user?.fid],
    queryFn: () => fetchSocialFeed(activeTab, user?.fid),
    enabled: !!user?.fid,
  });

  const renderFeedItem = ({ item }) => {
    switch (item.type) {
      case 'bet':
        return (
          <Card style={styles.feedCard}>
            <View style={styles.feedHeader}>
              <Avatar name={item.user.displayName} size={40} />
              <View style={styles.feedHeaderInfo}>
                <View style={styles.userRow}>
                  <Text style={styles.displayName}>{item.user.displayName}</Text>
                  {item.user.verified && <Text style={styles.verified}>✓</Text>}
                </View>
                <Text style={styles.username}>@{item.user.username}</Text>
              </View>
              <Text style={styles.timestamp}>{formatTimeAgo(item.timestamp)}</Text>
            </View>

            <View style={styles.feedContent}>
              <Text style={styles.actionText}>
                <Text style={styles.actionBold}>{item.action}</Text>{' '}
                for {item.amount} ETH
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('MarketDetail', { marketId: item.market.id })}
              >
                <Card style={styles.marketPreview}>
                  <Text style={styles.marketQuestion}>{item.market.question}</Text>
                </Card>
              </TouchableOpacity>
            </View>

            <View style={styles.feedActions}>
              <TouchableOpacity style={styles.feedAction}>
                <Text style={styles.actionIcon}>❤️</Text>
                <Text style={styles.actionCount}>{item.reactions.likes}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.feedAction}>
                <Text style={styles.actionIcon}>🔄</Text>
                <Text style={styles.actionCount}>{item.reactions.recasts}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.feedAction}>
                <Text style={styles.actionIcon}>💬</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.feedAction}>
                <Text style={styles.actionIcon}>📤</Text>
              </TouchableOpacity>
            </View>
          </Card>
        );

      case 'create':
        return (
          <Card style={styles.feedCard}>
            <View style={styles.feedHeader}>
              <Avatar name={item.user.displayName} size={40} />
              <View style={styles.feedHeaderInfo}>
                <View style={styles.userRow}>
                  <Text style={styles.displayName}>{item.user.displayName}</Text>
                  {item.user.verified && <Text style={styles.verified}>✓</Text>}
                </View>
                <Text style={styles.username}>@{item.user.username}</Text>
              </View>
              <Text style={styles.timestamp}>{formatTimeAgo(item.timestamp)}</Text>
            </View>

            <View style={styles.feedContent}>
              <Text style={styles.actionText}>
                <Text style={styles.actionBold}>{item.action}</Text>
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('MarketDetail', { marketId: item.market.id })}
              >
                <Card style={styles.marketPreviewNew}>
                  <Text style={styles.newBadge}>🆕 NEW</Text>
                  <Text style={styles.marketQuestion}>{item.market.question}</Text>
                </Card>
              </TouchableOpacity>
            </View>

            <View style={styles.feedActions}>
              <TouchableOpacity style={styles.feedAction}>
                <Text style={styles.actionIcon}>❤️</Text>
                <Text style={styles.actionCount}>{item.reactions.likes}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.feedAction}>
                <Text style={styles.actionIcon}>🔄</Text>
                <Text style={styles.actionCount}>{item.reactions.recasts}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.feedAction}>
                <Text style={styles.actionIcon}>💬</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.feedAction}>
                <Text style={styles.actionIcon}>📤</Text>
              </TouchableOpacity>
            </View>
          </Card>
        );

      case 'win':
        return (
          <Card style={[styles.feedCard, styles.winCard]}>
            <View style={styles.feedHeader}>
              <Avatar name={item.user.displayName} size={40} />
              <View style={styles.feedHeaderInfo}>
                <View style={styles.userRow}>
                  <Text style={styles.displayName}>{item.user.displayName}</Text>
                  {item.user.verified && <Text style={styles.verified}>✓</Text>}
                </View>
                <Text style={styles.username}>@{item.user.username}</Text>
              </View>
              <Text style={styles.timestamp}>{formatTimeAgo(item.timestamp)}</Text>
            </View>

            <View style={styles.feedContent}>
              <View style={styles.winBanner}>
                <Text style={styles.winEmoji}>🎉</Text>
                <Text style={styles.winText}>{item.action} +{item.payout} ETH!</Text>
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate('MarketDetail', { marketId: item.market.id })}
              >
                <Card style={styles.marketPreview}>
                  <Text style={styles.marketQuestion}>{item.market.question}</Text>
                </Card>
              </TouchableOpacity>
            </View>

            <View style={styles.feedActions}>
              <TouchableOpacity style={styles.feedAction}>
                <Text style={styles.actionIcon}>❤️</Text>
                <Text style={styles.actionCount}>{item.reactions.likes}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.feedAction}>
                <Text style={styles.actionIcon}>🔄</Text>
                <Text style={styles.actionCount}>{item.reactions.recasts}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.feedAction}>
                <Text style={styles.actionIcon}>💬</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.feedAction}>
                <Text style={styles.actionIcon}>📤</Text>
              </TouchableOpacity>
            </View>
          </Card>
        );

      case 'resolution':
        return (
          <Card style={styles.feedCard}>
            <View style={styles.resolutionHeader}>
              <Text style={styles.resolutionIcon}>⚖️</Text>
              <Text style={styles.resolutionTitle}>Market Resolved</Text>
              <Text style={styles.timestamp}>{formatTimeAgo(item.timestamp)}</Text>
            </View>

            <TouchableOpacity
              onPress={() => navigation.navigate('MarketDetail', { marketId: item.market.id })}
            >
              <Card style={styles.marketPreview}>
                <Text style={styles.marketQuestion}>{item.market.question}</Text>
                <View
                  style={[
                    styles.outcomeBadge,
                    item.outcome === 'YES' ? styles.outcomeYes : styles.outcomeNo,
                  ]}
                >
                  <Text
                    style={[
                      styles.outcomeText,
                      item.outcome === 'YES'
                        ? styles.outcomeTextYes
                        : styles.outcomeTextNo,
                    ]}
                  >
                    Resolved: {item.outcome}
                  </Text>
                </View>
              </Card>
            </TouchableOpacity>

            <View style={styles.feedActions}>
              <TouchableOpacity style={styles.feedAction}>
                <Text style={styles.actionIcon}>❤️</Text>
                <Text style={styles.actionCount}>{item.reactions.likes}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.feedAction}>
                <Text style={styles.actionIcon}>🔄</Text>
                <Text style={styles.actionCount}>{item.reactions.recasts}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.feedAction}>
                <Text style={styles.actionIcon}>💬</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.feedAction}>
                <Text style={styles.actionIcon}>📤</Text>
              </TouchableOpacity>
            </View>
          </Card>
        );

      default:
        return null;
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.tabTextActive,
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📡</Text>
      <Text style={styles.emptyTitle}>No activity yet</Text>
      <Text style={styles.emptyText}>
        Follow more users or browse markets to see activity here.
      </Text>
    </View>
  );

  if (!user?.fid) {
    return (
      <View style={styles.container}>
        <View style={styles.authContainer}>
          <Text style={styles.authIcon}>🔐</Text>
          <Text style={styles.authTitle}>Connect Farcaster</Text>
          <Text style={styles.authText}>
            Sign in with Farcaster to see your social feed, follow users, and share your predictions.
          </Text>
          <TouchableOpacity 
            style={styles.authButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.authButtonText}>Go to Profile to Connect</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading feed..." />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={feed}
        renderItem={renderFeedItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
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
  header: {
    padding: spacing.screenHorizontal,
    paddingBottom: spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundCard,
    borderRadius: spacing.sm,
    padding: spacing.xs,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: spacing.xs,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    ...typography.styles.label,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.white,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: spacing['3xl'],
  },
  feedCard: {
    marginHorizontal: spacing.screenHorizontal,
    marginBottom: spacing.md,
  },
  winCard: {
    borderColor: colors.success + '40',
    borderWidth: 1,
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  feedHeaderInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  displayName: {
    ...typography.styles.body,
    color: colors.text,
    fontWeight: '600',
  },
  verified: {
    color: colors.primary,
    marginLeft: 4,
    fontSize: 14,
  },
  username: {
    ...typography.styles.bodySmall,
    color: colors.textMuted,
  },
  timestamp: {
    ...typography.styles.caption,
    color: colors.textMuted,
  },
  feedContent: {
    marginBottom: spacing.md,
  },
  actionText: {
    ...typography.styles.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  actionBold: {
    color: colors.text,
    fontWeight: '600',
  },
  marketPreview: {
    backgroundColor: colors.backgroundElevated,
    padding: spacing.md,
  },
  marketPreviewNew: {
    backgroundColor: colors.primary + '10',
    padding: spacing.md,
  },
  newBadge: {
    ...typography.styles.caption,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  marketQuestion: {
    ...typography.styles.body,
    color: colors.text,
  },
  winBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '20',
    padding: spacing.sm,
    borderRadius: spacing.sm,
    marginBottom: spacing.sm,
  },
  winEmoji: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  winText: {
    ...typography.styles.body,
    color: colors.success,
    fontWeight: 'bold',
  },
  resolutionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  resolutionIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  resolutionTitle: {
    ...typography.styles.body,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
  },
  outcomeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.xs,
    marginTop: spacing.sm,
  },
  outcomeYes: {
    backgroundColor: colors.yes + '20',
  },
  outcomeNo: {
    backgroundColor: colors.no + '20',
  },
  outcomeText: {
    ...typography.styles.caption,
    fontWeight: 'bold',
  },
  outcomeTextYes: {
    color: colors.yes,
  },
  outcomeTextNo: {
    color: colors.no,
  },
  feedActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  feedAction: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xs,
  },
  actionIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  actionCount: {
    ...typography.styles.caption,
    color: colors.textMuted,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['3xl'],
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.styles.h4,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.styles.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  authContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  authIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  authText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  authButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 12,
  },
  authButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
