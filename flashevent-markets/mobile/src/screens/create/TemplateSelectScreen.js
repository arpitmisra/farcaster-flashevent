/**
 * TemplateSelectScreen - Select a template for creating a market
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { colors, typography, spacing } from '../../styles/theme';

const TEMPLATES = [
  {
    id: 'crypto',
    title: '💰 Crypto Price',
    description: 'Will [token] reach [price] by [date]?',
    example: 'Will BTC reach $150,000 by end of January 2026?',
  },
  {
    id: 'sports',
    title: '⚽ Sports',
    description: 'Will [team] win [event]?',
    example: 'Will Argentina win the 2026 World Cup?',
  },
  {
    id: 'esports',
    title: '🎮 Esports',
    description: 'Will [team] win [tournament]?',
    example: 'Will T1 win Worlds 2026?',
  },
  {
    id: 'politics',
    title: '🗳️ Politics',
    description: 'Will [candidate/party] win [election]?',
    example: 'Will the Democrats win the 2028 US Presidential Election?',
  },
  {
    id: 'tech',
    title: '🚀 Tech & Product',
    description: 'Will [company] launch [product] by [date]?',
    example: 'Will Apple launch AR glasses in 2026?',
  },
  {
    id: 'custom',
    title: '✏️ Custom',
    description: 'Create your own yes/no question',
    example: 'Any question with a clear yes/no outcome',
  },
];

export default function TemplateSelectScreen({ navigation }) {
  const handleSelectTemplate = (template) => {
    navigation.navigate('CreateMarket', { template });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Choose a Template</Text>
        <Text style={styles.subtitle}>
          Select a category to get started with your prediction market
        </Text>

        <View style={styles.grid}>
          {TEMPLATES.map((template) => (
            <TouchableOpacity
              key={template.id}
              style={styles.card}
              onPress={() => handleSelectTemplate(template)}
              activeOpacity={0.7}
            >
              <Text style={styles.cardTitle}>{template.title}</Text>
              <Text style={styles.cardDescription}>{template.description}</Text>
              <Text style={styles.cardExample}>e.g., "{template.example}"</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  grid: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  cardDescription: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  cardExample: {
    ...typography.caption,
    color: colors.primary,
    fontStyle: 'italic',
  },
});
