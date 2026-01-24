import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../../styles/theme';

export default function CountdownTimer({
  endTime,
  compact = false,
  onExpire,
  style,
}) {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  function calculateTimeLeft() {
    const now = Date.now();
    const end = typeof endTime === 'number' ? endTime : new Date(endTime).getTime();
    const diff = end - now;

    if (diff <= 0) {
      return { expired: true };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds, expired: false };
  }

  useEffect(() => {
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);

      if (newTimeLeft.expired && onExpire) {
        onExpire();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime]);

  if (timeLeft.expired) {
    return (
      <View style={[styles.container, style]}>
        <Text style={[styles.expired, compact && styles.compactText]}>Ended</Text>
      </View>
    );
  }

  const formatTime = () => {
    const { days, hours, minutes, seconds } = timeLeft;

    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const isUrgent = timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes < 30;

  if (compact) {
    return (
      <View style={[styles.container, style]}>
        <Text style={[styles.compactText, isUrgent && styles.urgent]}>
          ⏱️ {formatTime()}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.icon}>⏱️</Text>
      <Text style={[styles.text, isUrgent && styles.urgent]}>{formatTime()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  text: {
    ...typography.styles.bodySmall,
    color: colors.textSecondary,
  },
  compactText: {
    ...typography.styles.captionSmall,
    color: colors.textSecondary,
  },
  urgent: {
    color: colors.warning,
  },
  expired: {
    ...typography.styles.bodySmall,
    color: colors.textMuted,
  },
});
