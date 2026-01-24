import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Card from '../common/Card';
import Avatar from '../common/Avatar';
import OddsBar from './OddsBar';
import CountdownTimer from './CountdownTimer';
import Button from '../common/Button';
import { colors, typography, spacing } from '../../styles/theme';
import { MARKET_TYPE_ICONS, MARKET_TYPE_LABELS } from '../../config/contracts';
import { formatEther } from '../../utils/format';

export default function MarketCard({
  market,
  onBetYes,
  onBetNo,
  showActions = true,
  compact = false,
  style,
}) {
  const navigation = useNavigation();

  const {
    address,
    question,
    marketType,
    creator,
    yesPool,
    noPool,
    totalPool,
    bettorCount,
    endTime,
    resolved,
    outcome,
  } = market;

  // Calculate odds
  const total = parseFloat(yesPool) + parseFloat(noPool);
  const yesOdds = total > 0 ? (parseFloat(yesPool) / total) * 100 : 50;
  const noOdds = total > 0 ? (parseFloat(noPool) / total) * 100 : 50;

  const handlePress = () => {
    navigation.navigate('MarketDetail', { marketAddress: address, market });
  };

  const handleCreatorPress = () => {
    if (creator?.username) {
      navigation.navigate('UserProfile', { username: creator.username });
    }
  };

  if (compact) {
    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
        <Card style={[styles.compactContainer, style]}>
          <View style={styles.compactHeader}>
            <Text style={styles.typeIcon}>{MARKET_TYPE_ICONS[marketType]}</Text>
            <Text style={styles.compactQuestion} numberOfLines={1}>
              {question}
            </Text>
          </View>
          <OddsBar yesPercent={yesOdds} noPercent={noOdds} height={6} />
          <View style={styles.compactFooter}>
            <Text style={styles.compactStat}>💰 {formatEther(totalPool)} ETH</Text>
            <CountdownTimer endTime={endTime} compact />
          </View>
        </Card>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <Card style={[styles.container, style]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.typeContainer}>
            <Text style={styles.typeIcon}>{MARKET_TYPE_ICONS[marketType]}</Text>
            <Text style={styles.typeLabel}>{MARKET_TYPE_LABELS[marketType]}</Text>
          </View>
          
          {marketType === 2 && (
            <View style={styles.zkBadge}>
              <Text style={styles.zkText}>🔒 ZK-Verified</Text>
            </View>
          )}
        </View>

        {/* Creator */}
        <TouchableOpacity
          style={styles.creator}
          onPress={handleCreatorPress}
          activeOpacity={0.7}
        >
          <Avatar
            source={creator?.pfp_url ? { uri: creator.pfp_url } : null}
            name={creator?.display_name || creator?.username}
            size="xs"
          />
          <Text style={styles.creatorName}>
            @{creator?.username || 'unknown'}
          </Text>
        </TouchableOpacity>

        {/* Question */}
        <Text style={styles.question}>{question}</Text>

        {/* Resolved badge */}
        {resolved && (
          <View
            style={[
              styles.resolvedBadge,
              outcome ? styles.resolvedYes : styles.resolvedNo,
            ]}
          >
            <Text style={styles.resolvedText}>
              {outcome ? '✅ Resolved YES' : '❌ Resolved NO'}
            </Text>
          </View>
        )}

        {/* Odds bar */}
        {!resolved && (
          <View style={styles.oddsContainer}>
            <OddsBar yesPercent={yesOdds} noPercent={noOdds} />
          </View>
        )}

        {/* Stats */}
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statIcon}>💰</Text>
            <Text style={styles.statValue}>{formatEther(totalPool)} ETH</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statIcon}>👥</Text>
            <Text style={styles.statValue}>{bettorCount}</Text>
          </View>
          <View style={styles.stat}>
            <CountdownTimer endTime={endTime} />
          </View>
        </View>

        {/* Action buttons */}
        {showActions && !resolved && (
          <View style={styles.actions}>
            <Button
              title="BET YES"
              variant="yes"
              size="sm"
              onPress={() => onBetYes && onBetYes(market)}
              style={styles.actionButton}
            />
            <Button
              title="BET NO"
              variant="no"
              size="sm"
              onPress={() => onBetNo && onBetNo(market)}
              style={styles.actionButton}
            />
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.cardMargin,
  },
  compactContainer: {
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  typeLabel: {
    ...typography.styles.labelSmall,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  zkBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.sm,
  },
  zkText: {
    ...typography.styles.captionSmall,
    color: colors.primary,
  },
  creator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  creatorName: {
    ...typography.styles.caption,
    color: colors.primary,
    marginLeft: spacing.xs,
  },
  question: {
    ...typography.styles.h5,
    color: colors.text,
    marginBottom: spacing.md,
  },
  resolvedBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: spacing.sm,
    marginBottom: spacing.md,
  },
  resolvedYes: {
    backgroundColor: colors.yesBackground,
  },
  resolvedNo: {
    backgroundColor: colors.noBackground,
  },
  resolvedText: {
    ...typography.styles.label,
    color: colors.text,
  },
  oddsContainer: {
    marginBottom: spacing.md,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  statValue: {
    ...typography.styles.bodySmall,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  
  // Compact styles
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  compactQuestion: {
    ...typography.styles.bodySmall,
    color: colors.text,
    flex: 1,
  },
  compactFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  compactStat: {
    ...typography.styles.captionSmall,
    color: colors.textSecondary,
  },
});
