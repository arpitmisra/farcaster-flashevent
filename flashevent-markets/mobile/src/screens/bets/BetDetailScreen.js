import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { colors, typography, spacing } from '../../styles/theme';
import { formatTimeAgo, shortenAddress } from '../../utils/format';
import { MARKET_STATUS } from '../../config/contracts';
import config from '../../config';

const fetchBetDetails = async (betId) => {
  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 800));
  
  return {
    id: betId,
    marketId: 'market1',
    question: 'Will ETH touch $4000 in the next 24 hours?',
    side: 'YES',
    amount: 0.1,
    odds: 65,
    potentialPayout: 0.154,
    timestamp: Date.now() - 3600000,
    status: 'active',
    marketStatus: MARKET_STATUS.ACTIVE,
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    market: {
      yesPool: 10.5,
      noPool: 5.2,
      yesPercent: 67,
      noPercent: 33,
      endsAt: Date.now() + 86400000,
      source: 'Chainlink',
      creator: {
        username: 'vitalik.eth',
        fid: 1,
        avatar: null,
      },
    },
  };
};

export default function BetDetailScreen({ route, navigation }) {
  const { betId } = route.params;

  const {
    data: bet,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['betDetail', betId],
    queryFn: () => fetchBetDetails(betId),
    enabled: !!betId,
  });

  const openTxExplorer = () => {
    if (bet?.txHash) {
      Linking.openURL(`${config.MONAD_EXPLORER_URL}/tx/${bet.txHash}`);
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading bet details..." />;
  }

  if (error || !bet) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>❌</Text>
        <Text style={styles.errorText}>Failed to load bet details</Text>
        <Button
          title="Go Back"
          variant="outline"
          onPress={() => navigation.goBack()}
        />
      </View>
    );
  }

  const getStatusColor = () => {
    switch (bet.status) {
      case 'won':
        return colors.success;
      case 'lost':
        return colors.error;
      default:
        return colors.primary;
    }
  };

  const getStatusText = () => {
    switch (bet.status) {
      case 'won':
        return '✓ WON';
      case 'lost':
        return '✗ LOST';
      default:
        return '⏳ ACTIVE';
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Status Banner */}
      <View style={[styles.statusBanner, { backgroundColor: getStatusColor() + '20' }]}>
        <Text style={[styles.statusText, { color: getStatusColor() }]}>
          {getStatusText()}
        </Text>
      </View>

      {/* Bet Summary */}
      <Card style={styles.summaryCard}>
        <Text style={styles.question}>{bet.question}</Text>
        
        <View style={styles.betDetails}>
          <View style={styles.betDetailItem}>
            <Text style={styles.betDetailLabel}>Your Position</Text>
            <View
              style={[
                styles.sideBadge,
                bet.side === 'YES' ? styles.sideBadgeYes : styles.sideBadgeNo,
              ]}
            >
              <Text
                style={[
                  styles.sideBadgeText,
                  bet.side === 'YES'
                    ? styles.sideBadgeTextYes
                    : styles.sideBadgeTextNo,
                ]}
              >
                {bet.side}
              </Text>
            </View>
          </View>

          <View style={styles.betDetailItem}>
            <Text style={styles.betDetailLabel}>Amount Bet</Text>
            <Text style={styles.betDetailValue}>{bet.amount} ETH</Text>
          </View>

          <View style={styles.betDetailItem}>
            <Text style={styles.betDetailLabel}>Odds at Entry</Text>
            <Text style={styles.betDetailValue}>{bet.odds}%</Text>
          </View>

          <View style={styles.betDetailItem}>
            <Text style={styles.betDetailLabel}>
              {bet.status === 'active' ? 'Potential Payout' : 'Result'}
            </Text>
            {bet.status === 'won' ? (
              <Text style={styles.payoutWon}>+{bet.potentialPayout?.toFixed(4)} ETH</Text>
            ) : bet.status === 'lost' ? (
              <Text style={styles.payoutLost}>-{bet.amount} ETH</Text>
            ) : (
              <Text style={styles.betDetailValue}>
                {bet.potentialPayout?.toFixed(4)} ETH
              </Text>
            )}
          </View>
        </View>
      </Card>

      {/* Market Info */}
      <Text style={styles.sectionTitle}>MARKET INFO</Text>
      <Card style={styles.marketCard}>
        <View style={styles.poolsRow}>
          <View style={styles.poolItem}>
            <Text style={styles.poolValue}>{bet.market.yesPool} ETH</Text>
            <Text style={styles.poolLabel}>YES Pool ({bet.market.yesPercent}%)</Text>
          </View>
          <View style={styles.poolItem}>
            <Text style={styles.poolValue}>{bet.market.noPool} ETH</Text>
            <Text style={styles.poolLabel}>NO Pool ({bet.market.noPercent}%)</Text>
          </View>
        </View>

        <View style={styles.oddsBar}>
          <View
            style={[
              styles.oddsBarYes,
              { flex: bet.market.yesPercent },
            ]}
          />
          <View
            style={[
              styles.oddsBarNo,
              { flex: bet.market.noPercent },
            ]}
          />
        </View>

        <View style={styles.marketMeta}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Source</Text>
            <Text style={styles.metaValue}>{bet.market.source}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Creator</Text>
            <Text style={styles.metaValue}>@{bet.market.creator.username}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.viewMarketButton}
          onPress={() => navigation.navigate('MarketDetail', { marketId: bet.marketId })}
        >
          <Text style={styles.viewMarketText}>View Full Market →</Text>
        </TouchableOpacity>
      </Card>

      {/* Transaction Details */}
      <Text style={styles.sectionTitle}>TRANSACTION</Text>
      <Card style={styles.txCard}>
        <View style={styles.txRow}>
          <Text style={styles.txLabel}>Transaction Hash</Text>
          <TouchableOpacity onPress={openTxExplorer}>
            <Text style={styles.txHash}>
              {shortenAddress(bet.txHash, 8)} 🔗
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.txRow}>
          <Text style={styles.txLabel}>Time</Text>
          <Text style={styles.txValue}>{formatTimeAgo(bet.timestamp)}</Text>
        </View>
        <View style={styles.txRow}>
          <Text style={styles.txLabel}>Network</Text>
          <Text style={styles.txValue}>Monad Testnet</Text>
        </View>
      </Card>

      {/* Actions */}
      {bet.status === 'active' && (
        <View style={styles.actions}>
          <Button
            title="View Market"
            onPress={() => navigation.navigate('MarketDetail', { marketId: bet.marketId })}
          />
        </View>
      )}

      {bet.status === 'won' && (
        <View style={styles.actions}>
          <Button
            title="Share Win 🎉"
            onPress={() => {
              // Share to Farcaster
            }}
          />
        </View>
      )}

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  statusBanner: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statusText: {
    ...typography.styles.h4,
    fontWeight: 'bold',
  },
  summaryCard: {
    marginHorizontal: spacing.screenHorizontal,
  },
  question: {
    ...typography.styles.h5,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  betDetails: {
    gap: spacing.md,
  },
  betDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  betDetailLabel: {
    ...typography.styles.body,
    color: colors.textSecondary,
  },
  betDetailValue: {
    ...typography.styles.body,
    color: colors.text,
    fontWeight: '600',
  },
  sideBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: spacing.sm,
  },
  sideBadgeYes: {
    backgroundColor: colors.yes + '20',
  },
  sideBadgeNo: {
    backgroundColor: colors.no + '20',
  },
  sideBadgeText: {
    ...typography.styles.label,
    fontWeight: 'bold',
  },
  sideBadgeTextYes: {
    color: colors.yes,
  },
  sideBadgeTextNo: {
    color: colors.no,
  },
  payoutWon: {
    ...typography.styles.body,
    color: colors.success,
    fontWeight: 'bold',
  },
  payoutLost: {
    ...typography.styles.body,
    color: colors.error,
    fontWeight: 'bold',
  },
  sectionTitle: {
    ...typography.styles.label,
    color: colors.textSecondary,
    marginHorizontal: spacing.screenHorizontal,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  marketCard: {
    marginHorizontal: spacing.screenHorizontal,
  },
  poolsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  poolItem: {
    alignItems: 'center',
  },
  poolValue: {
    ...typography.styles.h5,
    color: colors.text,
  },
  poolLabel: {
    ...typography.styles.caption,
    color: colors.textMuted,
  },
  oddsBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  oddsBarYes: {
    backgroundColor: colors.yes,
  },
  oddsBarNo: {
    backgroundColor: colors.no,
  },
  marketMeta: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaLabel: {
    ...typography.styles.bodySmall,
    color: colors.textMuted,
  },
  metaValue: {
    ...typography.styles.bodySmall,
    color: colors.text,
  },
  viewMarketButton: {
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  viewMarketText: {
    ...typography.styles.body,
    color: colors.primary,
  },
  txCard: {
    marginHorizontal: spacing.screenHorizontal,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  txLabel: {
    ...typography.styles.bodySmall,
    color: colors.textMuted,
  },
  txValue: {
    ...typography.styles.bodySmall,
    color: colors.text,
  },
  txHash: {
    ...typography.styles.bodySmall,
    color: colors.primary,
  },
  actions: {
    marginHorizontal: spacing.screenHorizontal,
    marginTop: spacing.xl,
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
