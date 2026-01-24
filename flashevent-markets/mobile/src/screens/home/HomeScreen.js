import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useMarketStore } from '../../store/marketStore';
import MarketCard from '../../components/market/MarketCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Avatar from '../../components/common/Avatar';
import { contractService } from '../../services/contractService';
import { colors, typography, spacing } from '../../styles/theme';

const TABS = [
  { id: 'following', label: 'Following' },
  { id: 'trending', label: 'Trending' },
  { id: 'new', label: 'New' },
];

export default function HomeScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('trending');
  const user = useAuthStore((state) => state.user);
  const setFilter = useMarketStore((state) => state.setFilter);

  // Fetch markets
  const {
    data: markets,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['markets', activeTab],
    queryFn: () => contractService.getMarkets(activeTab),
    staleTime: 1000 * 60 * 1, // 1 minute
  });

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setFilter(tabId);
  };

  const handleBetYes = (market) => {
    navigation.navigate('MarketDetail', {
      marketAddress: market.address,
      market,
      initialBet: 'yes',
    });
  };

  const handleBetNo = (market) => {
    navigation.navigate('MarketDetail', {
      marketAddress: market.address,
      market,
      initialBet: 'no',
    });
  };

  const handleProfilePress = () => {
    navigation.navigate('Profile');
  };

  const handleNotificationsPress = () => {
    // TODO: Navigate to notifications
  };

  // Check demo mode
  const isDemoMode = contractService.isDemoMode();

  const renderHeader = () => (
    <View style={styles.header}>
      {/* Demo mode banner */}
      {isDemoMode && (
        <View style={styles.demoBanner}>
          <Text style={styles.demoBannerText}>🧪 Demo Mode - No real transactions</Text>
        </View>
      )}
      
      {/* Tab selector */}
      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.activeTab]}
            onPress={() => handleTabChange(tab.id)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.id && styles.activeTabText,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderMarket = useCallback(
    ({ item }) => (
      <MarketCard
        market={item}
        onBetYes={handleBetYes}
        onBetNo={handleBetNo}
      />
    ),
    []
  );

  const renderEmpty = () => (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>🔮</Text>
      <Text style={styles.emptyTitle}>No markets yet</Text>
      <Text style={styles.emptyText}>
        {activeTab === 'following'
          ? "Markets from people you follow will appear here"
          : "Be the first to create a market!"}
      </Text>
    </View>
  );

  if (isLoading) {
    return <LoadingSpinner fullScreen text="Loading markets..." />;
  }

  return (
    <View style={styles.container}>
      {/* Right header buttons */}
      <View style={styles.headerRight}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleNotificationsPress}
        >
          <Text style={styles.headerButtonIcon}>🔔</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleProfilePress}>
          <Avatar
            source={user?.pfp_url ? { uri: user.pfp_url } : null}
            name={user?.display_name || user?.username}
            size="sm"
            showBorder
          />
        </TouchableOpacity>
      </View>

      <FlatList
        data={markets || []}
        renderItem={renderMarket}
        keyExtractor={(item) => item.address}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListFooterComponent={<View style={styles.listFooter} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRight: {
    position: 'absolute',
    top: 0,
    right: spacing.screenHorizontal,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  headerButtonIcon: {
    fontSize: 20,
  },
  header: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  demoBanner: {
    backgroundColor: colors.primary + '30',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.sm,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  demoBannerText: {
    ...typography.styles.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundCard,
    borderRadius: spacing.cardBorderRadius,
    padding: spacing.xs,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: spacing.sm,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    ...typography.styles.label,
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.white,
  },
  list: {
    padding: spacing.screenHorizontal,
    paddingTop: spacing.sm,
    paddingBottom: 100, // Space for tab bar
  },
  listFooter: {
    height: 20,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
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
});
