import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../../styles/theme';

export default function OddsBar({
  yesPercent,
  noPercent,
  height = 8,
  showLabels = true,
  style,
}) {
  return (
    <View style={[styles.container, style]}>
      {showLabels && (
        <View style={styles.labels}>
          <Text style={styles.yesLabel}>YES {Math.round(yesPercent)}%</Text>
          <Text style={styles.noLabel}>NO {Math.round(noPercent)}%</Text>
        </View>
      )}
      
      <View style={[styles.bar, { height }]}>
        <View
          style={[
            styles.yesFill,
            { width: `${yesPercent}%` },
          ]}
        />
        <View
          style={[
            styles.noFill,
            { width: `${noPercent}%` },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  yesLabel: {
    ...typography.styles.labelSmall,
    color: colors.yes,
  },
  noLabel: {
    ...typography.styles.labelSmall,
    color: colors.no,
  },
  bar: {
    flexDirection: 'row',
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: colors.backgroundElevated,
  },
  yesFill: {
    backgroundColor: colors.yes,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  noFill: {
    backgroundColor: colors.no,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
});
