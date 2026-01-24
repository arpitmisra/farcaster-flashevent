import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { colors, typography, spacing } from '../../styles/theme';
import { MARKET_TYPES, MARKET_TYPE_ICONS, MARKET_TYPE_LABELS } from '../../config/contracts';
import config from '../../config';

// Lightweight logger for UI interactions on this screen
const logger = {
  info: (msg, data) => console.log('[CreateMarket]', msg, data || ''),
  error: (msg, data) => console.error('[CreateMarket]', msg, data || ''),
};

const TEMPLATES = [
  {
    type: MARKET_TYPES.PRICE_TOUCH,
    icon: MARKET_TYPE_ICONS[MARKET_TYPES.PRICE_TOUCH],
    label: MARKET_TYPE_LABELS[MARKET_TYPES.PRICE_TOUCH],
    description: '"Will [ASSET] touch [PRICE] in [TIME]?"',
    source: 'Chainlink',
  },
  {
    type: MARKET_TYPES.SPORTS,
    icon: MARKET_TYPE_ICONS[MARKET_TYPES.SPORTS],
    label: MARKET_TYPE_LABELS[MARKET_TYPES.SPORTS],
    description: '"Will [TEAM] win against [OPPONENT]?"',
    source: 'Sports API',
  },
  {
    type: MARKET_TYPES.ONCHAIN_EVENT,
    icon: MARKET_TYPE_ICONS[MARKET_TYPES.ONCHAIN_EVENT],
    label: MARKET_TYPE_LABELS[MARKET_TYPES.ONCHAIN_EVENT],
    description: '"Will [ADDRESS] do [ACTION] in [TIME]?"',
    source: 'Blockchain',
  },
  {
    type: MARKET_TYPES.API_COUNT,
    icon: MARKET_TYPE_ICONS[MARKET_TYPES.API_COUNT],
    label: MARKET_TYPE_LABELS[MARKET_TYPES.API_COUNT],
    description: '"Will [@USER] post [N] times in [TIME]?"',
    source: 'API + ZK',
  },
];

export default function CreateMarketScreen({ navigation }) {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formData, setFormData] = useState({});
  const [preview, setPreview] = useState('');
  const [autoCast, setAutoCast] = useState(true);

  const handleTemplateSelect = (template) => {
    logger.info('Template selected', template?.type);
    setSelectedTemplate(template);
    setFormData({});
    setPreview('');
  };

  const updateFormData = (key, value) => {
    logger.info('Form update', { key, value });
    const newData = { ...formData, [key]: value };
    setFormData(newData);
    generatePreview(selectedTemplate?.type, newData);
  };

  const generatePreview = (type, data) => {
    logger.info('Generate preview', { type, data });
    switch (type) {
      case MARKET_TYPES.PRICE_TOUCH:
        if (data.asset && data.price && data.duration) {
          setPreview(
            `Will ${data.asset} touch $${data.price} in the next ${data.duration}?`
          );
        }
        break;
      case MARKET_TYPES.ONCHAIN_EVENT:
        if (data.address && data.action && data.duration) {
          setPreview(
            `Will ${data.address.slice(0, 8)}... ${data.action} in the next ${data.duration}?`
          );
        }
        break;
      case MARKET_TYPES.SPORTS:
        if (data.team1 && data.team2 && data.sport && data.matchDate) {
          const betType = data.betType || 'win';
          if (betType === 'win') {
            setPreview(
              `[SPORTS:${data.sport.toUpperCase()}] Will ${data.team1} beat ${data.team2}?`
            );
          } else if (betType === 'draw') {
            setPreview(
              `[SPORTS:${data.sport.toUpperCase()}] Will ${data.team1} vs ${data.team2} end in a draw?`
            );
          } else if (betType === 'over') {
            setPreview(
              `[SPORTS:${data.sport.toUpperCase()}] Will ${data.team1} vs ${data.team2} total score be over ${data.totalGoals || '2.5'}?`
            );
          }
        }
        break;
      case MARKET_TYPES.API_COUNT:
        if (data.username && data.count && data.duration) {
          setPreview(
            `Will @${data.username} tweet ${data.count} times in the next ${data.duration}?`
          );
        }
        break;
      default:
        setPreview('');
    }
  };

  const handleContinue = () => {
    logger.info('Continue pressed', { hasTemplate: !!selectedTemplate, hasPreview: !!preview, formData });
    if (!selectedTemplate || !preview) return;
    
    navigation.navigate('ConfirmMarket', {
      template: selectedTemplate,
      formData,
      preview,
      autoCast,
    });
  };

  const renderTemplateForm = () => {
    if (!selectedTemplate) return null;

    switch (selectedTemplate.type) {
      case MARKET_TYPES.PRICE_TOUCH:
        return (
          <View style={styles.form}>
            <Text style={styles.formTitle}>PRICE_TOUCH PARAMETERS</Text>
            
            <Text style={styles.label}>Asset</Text>
            <View style={styles.assetButtons}>
              {config.SUPPORTED_ASSETS.map((asset) => (
                <TouchableOpacity
                  key={asset.symbol}
                  style={[
                    styles.assetButton,
                    formData.asset === asset.symbol && styles.assetButtonActive,
                  ]}
                  onPress={() => updateFormData('asset', asset.symbol)}
                >
                  <Text style={styles.assetIcon}>{asset.icon}</Text>
                  <Text
                    style={[
                      styles.assetText,
                      formData.asset === asset.symbol && styles.assetTextActive,
                    ]}
                  >
                    {asset.symbol}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label="Target Price ($)"
              placeholder="3500.00"
              keyboardType="decimal-pad"
              value={formData.price}
              onChangeText={(val) => updateFormData('price', val)}
            />

            <Text style={styles.label}>Duration</Text>
            <View style={styles.durationButtons}>
              {config.MARKET_DURATIONS.map((dur) => (
                <TouchableOpacity
                  key={dur.value}
                  style={[
                    styles.durationButton,
                    formData.duration === dur.label && styles.durationButtonActive,
                  ]}
                  onPress={() => updateFormData('duration', dur.label)}
                >
                  <Text
                    style={[
                      styles.durationText,
                      formData.duration === dur.label && styles.durationTextActive,
                    ]}
                  >
                    {dur.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case MARKET_TYPES.ONCHAIN_EVENT:
        return (
          <View style={styles.form}>
            <Text style={styles.formTitle}>ONCHAIN_EVENT PARAMETERS</Text>
            
            <Input
              label="Target Address"
              placeholder="0x..."
              autoCapitalize="none"
              value={formData.address}
              onChangeText={(val) => updateFormData('address', val)}
            />

            <Input
              label="Action"
              placeholder="make a transaction"
              value={formData.action}
              onChangeText={(val) => updateFormData('action', val)}
            />

            <Text style={styles.label}>Duration</Text>
            <View style={styles.durationButtons}>
              {config.MARKET_DURATIONS.map((dur) => (
                <TouchableOpacity
                  key={dur.value}
                  style={[
                    styles.durationButton,
                    formData.duration === dur.label && styles.durationButtonActive,
                  ]}
                  onPress={() => updateFormData('duration', dur.label)}
                >
                  <Text
                    style={[
                      styles.durationText,
                      formData.duration === dur.label && styles.durationTextActive,
                    ]}
                  >
                    {dur.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case MARKET_TYPES.SPORTS:
        return (
          <View style={styles.form}>
            <Text style={styles.formTitle}>⚽ SPORTS MARKET PARAMETERS</Text>
            
            <Text style={styles.label}>Sport</Text>
            <View style={styles.assetButtons}>
              {[
                { id: 'soccer', icon: '⚽', label: 'Football' },
                { id: 'cricket', icon: '🏏', label: 'Cricket' },
                { id: 'basketball', icon: '🏀', label: 'NBA' },
                { id: 'american_football', icon: '🏈', label: 'NFL' },
                { id: 'tennis', icon: '🎾', label: 'Tennis' },
              ].map((sport) => (
                <TouchableOpacity
                  key={sport.id}
                  style={[
                    styles.assetButton,
                    formData.sport === sport.id && styles.assetButtonActive,
                  ]}
                  onPress={() => updateFormData('sport', sport.id)}
                >
                  <Text style={styles.assetIcon}>{sport.icon}</Text>
                  <Text
                    style={[
                      styles.assetText,
                      formData.sport === sport.id && styles.assetTextActive,
                    ]}
                  >
                    {sport.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label="Team 1 (Your pick to win)"
              placeholder="e.g., Manchester United, India, Lakers"
              autoCapitalize="words"
              value={formData.team1}
              onChangeText={(val) => updateFormData('team1', val)}
            />

            <Input
              label="Team 2 (Opponent)"
              placeholder="e.g., Liverpool, Australia, Celtics"
              autoCapitalize="words"
              value={formData.team2}
              onChangeText={(val) => updateFormData('team2', val)}
            />

            <Text style={styles.label}>Bet Type</Text>
            <View style={styles.durationButtons}>
              {[
                { id: 'win', label: '🏆 Team 1 Wins' },
                { id: 'draw', label: '🤝 Draw' },
                { id: 'over', label: '📊 Over/Under' },
              ].map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.durationButton,
                    formData.betType === type.id && styles.durationButtonActive,
                  ]}
                  onPress={() => updateFormData('betType', type.id)}
                >
                  <Text
                    style={[
                      styles.durationText,
                      formData.betType === type.id && styles.durationTextActive,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {formData.betType === 'over' && (
              <Input
                label="Total Goals/Points Line"
                placeholder="2.5"
                keyboardType="decimal-pad"
                value={formData.totalGoals}
                onChangeText={(val) => updateFormData('totalGoals', val)}
              />
            )}

            <Input
              label="Match Date & Time"
              placeholder="e.g., 2026-01-25 20:00"
              value={formData.matchDate}
              onChangeText={(val) => updateFormData('matchDate', val)}
            />

            <View style={styles.zkNote}>
              <Text style={styles.zkIcon}>🏟️</Text>
              <Text style={styles.zkText}>
                This market will auto-resolve based on official match results from sports APIs (TheSportsDB, ESPN).
              </Text>
            </View>
          </View>
        );

      case MARKET_TYPES.API_COUNT:
        return (
          <View style={styles.form}>
            <Text style={styles.formTitle}>API_COUNT PARAMETERS</Text>
            
            <Input
              label="Twitter Username"
              placeholder="elonmusk"
              autoCapitalize="none"
              leftIcon={<Text style={styles.inputIcon}>@</Text>}
              value={formData.username}
              onChangeText={(val) => updateFormData('username', val)}
            />

            <Input
              label="Minimum Tweets"
              placeholder="1"
              keyboardType="number-pad"
              value={formData.count}
              onChangeText={(val) => updateFormData('count', val)}
            />

            <Text style={styles.label}>Duration</Text>
            <View style={styles.durationButtons}>
              {config.MARKET_DURATIONS.map((dur) => (
                <TouchableOpacity
                  key={dur.value}
                  style={[
                    styles.durationButton,
                    formData.duration === dur.label && styles.durationButtonActive,
                  ]}
                  onPress={() => updateFormData('duration', dur.label)}
                >
                  <Text
                    style={[
                      styles.durationText,
                      formData.duration === dur.label && styles.durationTextActive,
                    ]}
                  >
                    {dur.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.zkNote}>
              <Text style={styles.zkIcon}>🔒</Text>
              <Text style={styles.zkText}>
                This market will be resolved using ZK proofs for trustless verification
              </Text>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Template Selection */}
      <Text style={styles.sectionTitle}>SELECT TEMPLATE</Text>
      
      {TEMPLATES.map((template) => (
        <TouchableOpacity
          key={template.type}
          onPress={() => handleTemplateSelect(template)}
          activeOpacity={0.8}
        >
          <Card
            style={[
              styles.templateCard,
              selectedTemplate?.type === template.type && styles.templateCardActive,
            ]}
          >
            <View style={styles.templateHeader}>
              <Text style={styles.templateIcon}>{template.icon}</Text>
              <Text style={styles.templateLabel}>{template.label}</Text>
              {selectedTemplate?.type === template.type && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </View>
            <Text style={styles.templateDescription}>{template.description}</Text>
            <Text style={styles.templateSource}>Source: {template.source}</Text>
          </Card>
        </TouchableOpacity>
      ))}

      {/* Form */}
      {renderTemplateForm()}

      {/* Preview */}
      {preview && (
        <View style={styles.previewSection}>
          <Text style={styles.sectionTitle}>📝 PREVIEW</Text>
          <Card style={styles.previewCard}>
            <Text style={styles.previewText}>"{preview}"</Text>
            <Text style={styles.previewSource}>
              Source: {selectedTemplate?.source}
            </Text>
          </Card>

          {/* Auto-cast toggle */}
          <TouchableOpacity
            style={styles.autoCastRow}
            onPress={() => setAutoCast(!autoCast)}
          >
            <Text style={styles.autoCastText}>Auto-cast to Farcaster</Text>
            <View
              style={[
                styles.checkbox,
                autoCast && styles.checkboxActive,
              ]}
            >
              {autoCast && <Text style={styles.checkboxCheck}>✓</Text>}
            </View>
          </TouchableOpacity>

          {/* Fee info */}
          <Text style={styles.feeText}>
            Creation Fee: {config.MARKET_CREATION_FEE} ETH
          </Text>

          {/* Continue button */}
          <Button
            title="Continue →"
            onPress={handleContinue}
            style={styles.continueButton}
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
    padding: spacing.screenHorizontal,
  },
  sectionTitle: {
    ...typography.styles.label,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  templateCard: {
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  templateCardActive: {
    borderColor: colors.primary,
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  templateIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  templateLabel: {
    ...typography.styles.h5,
    color: colors.text,
    flex: 1,
  },
  checkmark: {
    fontSize: 20,
    color: colors.primary,
  },
  templateDescription: {
    ...typography.styles.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  templateSource: {
    ...typography.styles.caption,
    color: colors.textMuted,
  },
  form: {
    marginTop: spacing.lg,
  },
  formTitle: {
    ...typography.styles.label,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  label: {
    ...typography.styles.label,
    color: colors.text,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  assetButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  assetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.sm,
    backgroundColor: colors.backgroundCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  assetButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '20',
  },
  assetIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  assetText: {
    ...typography.styles.label,
    color: colors.textSecondary,
  },
  assetTextActive: {
    color: colors.primary,
  },
  durationButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  durationButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.sm,
    backgroundColor: colors.backgroundCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  durationButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '20',
  },
  durationText: {
    ...typography.styles.label,
    color: colors.textSecondary,
  },
  durationTextActive: {
    color: colors.primary,
  },
  inputIcon: {
    color: colors.textMuted,
    fontSize: 16,
  },
  zkNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '10',
    padding: spacing.md,
    borderRadius: spacing.sm,
    marginTop: spacing.md,
  },
  zkIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  zkText: {
    ...typography.styles.bodySmall,
    color: colors.primary,
    flex: 1,
  },
  previewSection: {
    marginTop: spacing.xl,
  },
  previewCard: {
    alignItems: 'center',
  },
  previewText: {
    ...typography.styles.h5,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  previewSource: {
    ...typography.styles.caption,
    color: colors.primary,
  },
  autoCastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  autoCastText: {
    ...typography.styles.body,
    color: colors.text,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxCheck: {
    color: colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  feeText: {
    ...typography.styles.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  continueButton: {
    marginTop: spacing.lg,
  },
  bottomPadding: {
    height: spacing['3xl'],
  },
});
