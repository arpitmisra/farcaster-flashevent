/**
 * Social Feed Screen - Farcaster Integration
 * Shows real Farcaster feed, followers, following, and posts
 */

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
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Card from '../../components/common/Card';
import Avatar from '../../components/common/Avatar';
import { colors, typography, spacing } from '../../styles/theme';
import { useAuthStore } from '../../store/authStore';
import farcasterService from '../../services/farcasterService';

const TABS = ['Feed', 'Following', 'Followers'];

// Format time ago
const formatTimeAgo = (timestamp) => {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return new Date(timestamp).toLocaleDateString();
};

export default function SocialFeedScreen({ navigation }) {
  const queryClient = useQueryClient();
  const { user, fid, signerUuid, isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState('Feed');
  const [newCastText, setNewCastText] = useState('');

  // Fetch feed
  const {
    data: feedData,
    isLoading: feedLoading,
    isRefetching: feedRefetching,
    refetch: refetchFeed,
    error: feedError,
  } = useQuery({
    queryKey: ['farcasterFeed', activeTab, fid],
    queryFn: async () => {
      if (!fid) throw new Error('Not authenticated');
      
      if (activeTab === 'Feed') {
        const response = await farcasterService.getFeed(fid, 'following', 25);
        return { type: 'casts', items: response.casts || [] };
      } else if (activeTab === 'Following') {
        const response = await farcasterService.getFollowing(fid, 50);
        return { type: 'users', items: response.users || [] };
      } else if (activeTab === 'Followers') {
        const response = await farcasterService.getFollowers(fid, 50);
        return { type: 'users', items: response.users || [] };
      }
      return { type: 'casts', items: [] };
    },
    enabled: isAuthenticated && !!fid,
    staleTime: 30000,
  });

  // Like cast mutation
  const likeMutation = useMutation({
    mutationFn: async (hash) => {
      return farcasterService.likeCast(signerUuid, hash);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['farcasterFeed']);
    },
    onError: (error) => {
      Alert.alert('Error', 'Failed to like cast');
    },
  });

  // Recast mutation
  const recastMutation = useMutation({
    mutationFn: async (hash) => {
      return farcasterService.recast(signerUuid, hash);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['farcasterFeed']);
    },
    onError: (error) => {
      Alert.alert('Error', 'Failed to recast');
    },
  });

  // Post cast mutation
  const postCastMutation = useMutation({
    mutationFn: async (text) => {
      return farcasterService.publishCast(signerUuid, text);
    },
    onSuccess: () => {
      setNewCastText('');
      queryClient.invalidateQueries(['farcasterFeed']);
      Alert.alert('Success', 'Cast posted!');
    },
    onError: (error) => {
      Alert.alert('Error', 'Failed to post cast');
    },
  });

  // Follow user mutation
  const followMutation = useMutation({
    mutationFn: async (targetFid) => {
      return farcasterService.followUser(signerUuid, targetFid);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['farcasterFeed']);
    },
    onError: (error) => {
      Alert.alert('Error', 'Failed to follow user');
    },
  });

  const handlePostCast = () => {
    if (!newCastText.trim()) return;
    postCastMutation.mutate(newCastText.trim());
  };

  const renderCastItem = useCallback(({ item }) => {
    const cast = item;
    const author = cast.author || {};
    
    return (
      <Card style={styles.castCard}>
        <View style={styles.castHeader}>
          {author.pfp_url ? (
            <Image source={{ uri: author.pfp_url }} style={styles.avatar} />
          ) : (
            <Avatar name={author.display_name || 'User'} size={44} />
          )}
          <View style={styles.castHeaderInfo}>
            <View style={styles.userRow}>
              <Text style={styles.displayName} numberOfLines={1}>
                {author.display_name || 'Anonymous'}
              </Text>
              {author.power_badge && <Text style={styles.verified}>⚡</Text>}
            </View>
            <Text style={styles.username}>@{author.username || 'unknown'}</Text>
          </View>
          <Text style={styles.timestamp}>
            {formatTimeAgo(new Date(cast.timestamp).getTime())}
          </Text>
        </View>

        <Text style={styles.castText}>{cast.text}</Text>

        {/* Embeds (images, links) */}
        {cast.embeds && cast.embeds.length > 0 && (
          <View style={styles.embedsContainer}>
            {cast.embeds.map((embed, index) => {
              if (embed.url && embed.url.match(/\.(jpg|jpeg|png|gif|webp)/i)) {
                return (
                  <Image
                    key={index}
                    source={{ uri: embed.url }}
                    style={styles.embedImage}
                    resizeMode="cover"
                  />
                );
              }
              if (embed.url) {
                return (
                  <TouchableOpacity key={index} style={styles.embedLink}>
                    <Text style={styles.embedLinkText} numberOfLines={1}>
                      🔗 {embed.url}
                    </Text>
                  </TouchableOpacity>
                );
              }
              return null;
            })}
          </View>
        )}

        <View style={styles.castActions}>
          <TouchableOpacity 
            style={styles.castAction}
            onPress={() => navigation.navigate('CastDetail', { hash: cast.hash })}
          >
            <Text style={styles.actionIcon}>💬</Text>
            <Text style={styles.actionCount}>{cast.replies?.count || 0}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.castAction}
            onPress={() => recastMutation.mutate(cast.hash)}
          >
            <Text style={styles.actionIcon}>🔄</Text>
            <Text style={styles.actionCount}>{cast.reactions?.recasts_count || 0}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.castAction}
            onPress={() => likeMutation.mutate(cast.hash)}
          >
            <Text style={styles.actionIcon}>❤️</Text>
            <Text style={styles.actionCount}>{cast.reactions?.likes_count || 0}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.castAction}>
            <Text style={styles.actionIcon}>📤</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  }, [navigation, likeMutation, recastMutation]);

  const renderUserItem = useCallback(({ item }) => {
    const userItem = item.user || item;
    
    return (
      <Card style={styles.userCard}>
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => navigation.navigate('UserProfile', { fid: userItem.fid })}
        >
          {userItem.pfp_url ? (
            <Image source={{ uri: userItem.pfp_url }} style={styles.avatar} />
          ) : (
            <Avatar name={userItem.display_name || 'User'} size={48} />
          )}
          <View style={styles.userDetails}>
            <View style={styles.userRow}>
              <Text style={styles.displayName} numberOfLines={1}>
                {userItem.display_name || 'Anonymous'}
              </Text>
              {userItem.power_badge && <Text style={styles.verified}>⚡</Text>}
            </View>
            <Text style={styles.username}>@{userItem.username || 'unknown'}</Text>
            {userItem.profile?.bio?.text && (
              <Text style={styles.bio} numberOfLines={2}>
                {userItem.profile.bio.text}
              </Text>
            )}
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.followButton}
          onPress={() => followMutation.mutate(userItem.fid)}
        >
          <Text style={styles.followButtonText}>Follow</Text>
        </TouchableOpacity>
      </Card>
    );
  }, [navigation, followMutation]);

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.title}>🔮 Social Feed</Text>
      
      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* New Cast Input */}
      {activeTab === 'Feed' && signerUuid && (
        <Card style={styles.newCastCard}>
          <TextInput
            style={styles.newCastInput}
            placeholder="What's happening?"
            placeholderTextColor={colors.textSecondary}
            value={newCastText}
            onChangeText={setNewCastText}
            multiline
            maxLength={320}
          />
          <View style={styles.newCastActions}>
            <Text style={styles.charCount}>{newCastText.length}/320</Text>
            <TouchableOpacity
              style={[
                styles.postButton,
                (!newCastText.trim() || postCastMutation.isPending) && styles.postButtonDisabled,
              ]}
              onPress={handlePostCast}
              disabled={!newCastText.trim() || postCastMutation.isPending}
            >
              {postCastMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <Text style={styles.postButtonText}>Cast</Text>
              )}
            </TouchableOpacity>
          </View>
        </Card>
      )}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      {!isAuthenticated ? (
        <>
          <Text style={styles.emptyIcon}>🔐</Text>
          <Text style={styles.emptyTitle}>Login Required</Text>
          <Text style={styles.emptyText}>
            Sign in with Farcaster to see your feed
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.navigate('Auth')}
          >
            <Text style={styles.loginButtonText}>Sign In</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyTitle}>No content yet</Text>
          <Text style={styles.emptyText}>
            {activeTab === 'Feed'
              ? 'Follow some users to see their casts'
              : activeTab === 'Following'
              ? "You're not following anyone yet"
              : 'No followers yet'}
          </Text>
        </>
      )}
    </View>
  );

  const items = feedData?.items || [];
  const isUserList = feedData?.type === 'users';

  if (feedLoading && items.length === 0) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        renderItem={isUserList ? renderUserItem : renderCastItem}
        keyExtractor={(item) => item.hash || item.fid?.toString() || Math.random().toString()}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={feedRefetching}
            onRefresh={refetchFeed}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  header: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  newCastCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  newCastInput: {
    fontSize: typography.sizes.md,
    color: colors.text,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  newCastActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  charCount: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  postButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    color: colors.background,
    fontWeight: typography.weights.bold,
    fontSize: typography.sizes.sm,
  },
  castCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  castHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  castHeaderInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  displayName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    maxWidth: 150,
  },
  verified: {
    marginLeft: 4,
    fontSize: 12,
  },
  username: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  timestamp: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  castText: {
    fontSize: typography.sizes.md,
    color: colors.text,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  embedsContainer: {
    marginBottom: spacing.sm,
  },
  embedImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: spacing.xs,
  },
  embedLink: {
    backgroundColor: colors.card,
    padding: spacing.sm,
    borderRadius: 8,
  },
  embedLinkText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
  },
  castActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  castAction: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xs,
  },
  actionIcon: {
    fontSize: 16,
  },
  actionCount: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userDetails: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  bio: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 4,
  },
  followButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
  },
  followButtonText: {
    color: colors.background,
    fontWeight: typography.weights.bold,
    fontSize: typography.sizes.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  loginButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  loginButtonText: {
    color: colors.background,
    fontWeight: typography.weights.bold,
  },
});
