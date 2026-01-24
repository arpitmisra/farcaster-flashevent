/**
 * Price Feed Screen - Live cryptocurrency prices
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '../../components/common/Card';
import { colors, typography, spacing } from '../../styles/theme';
import priceService from '../../services/priceService';
import socketService from '../../services/socketService';

// Asset icons (emoji for simplicity)
const ASSET_ICONS = {
  ETH: '⟠',
  BTC: '₿',
  SOL: '◎',
  USDC: '💵',
  LINK: '⬡',
  UNI: '🦄',
  AAVE: '👻',
  MATIC: '💜',
  ARB: '🔵',
  OP: '🔴',
};

export default function PriceFeedScreen({ navigation }) {
  const queryClient = useQueryClient();
  const [isLive, setIsLive] = useState(false);

  // Fetch prices
  const {
    data: prices,
    isLoading,
    isRefetching,
    refetch,
    error,
  } = useQuery({
    queryKey: ['prices'],
    queryFn: () => priceService.fetchPrices(),
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000,
  });

  // Subscribe to real-time updates
  useEffect(() => {
    let unsubscribe;

    const setupWebSocket = async () => {
      try {
        await socketService.connect();
        setIsLive(true);

        unsubscribe = priceService.subscribeToUpdates((newPrices) => {
          queryClient.setQueryData(['prices'], newPrices);
        });
      } catch (error) {
        console.error('WebSocket connection failed:', error);
        setIsLive(false);
      }
    };

    setupWebSocket();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [queryClient]);

  const priceList = prices ? Object.values(prices) : [];

  const renderPriceItem = useCallback(({ item }) => {
    const isPositive = item.change24h >= 0;
    
    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('AssetDetail', { symbol: item.symbol })}
      >
        <Card style={styles.priceCard}>
          <View style={styles.assetInfo}>
            <View style={styles.iconContainer}>
              <Text style={styles.assetIcon}>
                {ASSET_ICONS[item.symbol] || '🪙'}
              </Text>
            </View>
            <View style={styles.assetDetails}>
              <Text style={styles.assetSymbol}>{item.symbol}</Text>
              <Text style={styles.assetName}>{item.name}</Text>
            </View>
          </View>

          <View style={styles.priceInfo}>
            <Text style={styles.price}>
              {priceService.formatPrice(item.price)}
            </Text>
            <View style={[
              styles.changeBadge,
              isPositive ? styles.changeBadgePositive : styles.changeBadgeNegative,
            ]}>
              <Text style={[
                styles.changeText,
                isPositive ? styles.changeTextPositive : styles.changeTextNegative,
              ]}>
                {priceService.formatChange(item.change24h)}
              </Text>
            </View>
          </View>

          <View style={styles.volumeInfo}>
            <Text style={styles.volumeLabel}>24h Vol</Text>
            <Text style={styles.volumeValue}>
              {priceService.formatVolume(item.volume24h)}
            </Text>
          </View>
        </Card>
      </TouchableOpacity>
    );
  }, [navigation]);

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <Text style={styles.title}>Price Feed</Text>
        <View style={styles.liveIndicator}>
          <View style={[styles.liveDot, isLive && styles.liveDotActive]} />
          <Text style={[styles.liveText, isLive && styles.liveTextActive]}>
            {isLive ? 'LIVE' : 'OFFLINE'}
          </Text>
        </View>
      </View>
      <Text style={styles.subtitle}>
        Real-time cryptocurrency prices
      </Text>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📊</Text>
      <Text style={styles.emptyTitle}>No price data available</Text>
      <Text style={styles.emptyText}>
        Pull down to refresh
      </Text>
    </View>
  );

  if (isLoading && !prices) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading prices...</Text>
        </View>
      </View>
    );
  }

  if (error && !prices) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Failed to load prices</Text>
          <Text style={styles.errorText}>{error.message}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refetch}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={priceList}
        renderItem={renderPriceItem}
        keyExtractor={(item, index) => item?.symbol || `price-${index}`}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
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
    marginBottom: spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textSecondary,
    marginRight: spacing.xs,
  },
  liveDotActive: {
    backgroundColor: colors.success,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  liveTextActive: {
    color: colors.success,
  },
  priceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  assetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  assetIcon: {
    fontSize: 24,
  },
  assetDetails: {
    flex: 1,
  },
  assetSymbol: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  assetName: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  priceInfo: {
    alignItems: 'flex-end',
    marginRight: spacing.md,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  changeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  changeBadgePositive: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  changeBadgeNegative: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  changeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  changeTextPositive: {
    color: colors.success,
  },
  changeTextNegative: {
    color: colors.error,
  },
  volumeInfo: {
    alignItems: 'flex-end',
    minWidth: 70,
  },
  volumeLabel: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  volumeValue: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  retryButtonText: {
    color: colors.text,
    fontWeight: '600',
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
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
