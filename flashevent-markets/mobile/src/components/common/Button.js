import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing } from '../../styles/theme';

export default function Button({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary', // 'primary' | 'secondary' | 'outline' | 'ghost' | 'yes' | 'no'
  size = 'md', // 'sm' | 'md' | 'lg'
  icon,
  iconPosition = 'left',
  fullWidth = true,
  style,
  textStyle,
  ...props
}) {
  const isDisabled = disabled || loading;

  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          container: styles.secondaryContainer,
          text: styles.secondaryText,
        };
      case 'outline':
        return {
          container: styles.outlineContainer,
          text: styles.outlineText,
        };
      case 'ghost':
        return {
          container: styles.ghostContainer,
          text: styles.ghostText,
        };
      case 'yes':
        return {
          container: styles.yesContainer,
          text: styles.yesText,
        };
      case 'no':
        return {
          container: styles.noContainer,
          text: styles.noText,
        };
      default:
        return {
          container: {},
          text: styles.primaryText,
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          container: styles.sizeSm,
          text: styles.textSm,
        };
      case 'lg':
        return {
          container: styles.sizeLg,
          text: styles.textLg,
        };
      default:
        return {
          container: styles.sizeMd,
          text: styles.textMd,
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  const content = (
    <View style={styles.content}>
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? colors.primary : colors.white}
          size="small"
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <Text style={styles.icon}>{icon}</Text>
          )}
          <Text
            style={[
              styles.text,
              variantStyles.text,
              sizeStyles.text,
              textStyle,
              isDisabled && styles.textDisabled,
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === 'right' && (
            <Text style={styles.icon}>{icon}</Text>
          )}
        </>
      )}
    </View>
  );

  // Primary button with gradient
  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.8}
        style={[fullWidth && styles.fullWidth, style]}
        {...props}
      >
        <LinearGradient
          colors={isDisabled ? [colors.backgroundElevated, colors.backgroundElevated] : colors.gradientPrimary}
          style={[styles.container, sizeStyles.container]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          {content}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  // Yes button with gradient
  if (variant === 'yes') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.8}
        style={[fullWidth && styles.fullWidth, style]}
        {...props}
      >
        <LinearGradient
          colors={isDisabled ? [colors.backgroundElevated, colors.backgroundElevated] : colors.gradientSuccess}
          style={[styles.container, sizeStyles.container]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          {content}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  // No button with gradient
  if (variant === 'no') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.8}
        style={[fullWidth && styles.fullWidth, style]}
        {...props}
      >
        <LinearGradient
          colors={isDisabled ? [colors.backgroundElevated, colors.backgroundElevated] : colors.gradientError}
          style={[styles.container, sizeStyles.container]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          {content}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  // Other variants
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        styles.container,
        variantStyles.container,
        sizeStyles.container,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
      {...props}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: spacing.buttonBorderRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  text: {
    ...typography.styles.button,
    color: colors.white,
  },
  icon: {
    marginHorizontal: spacing.xs,
    fontSize: 18,
  },
  
  // Size variants
  sizeSm: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  sizeMd: {
    paddingVertical: spacing.buttonPaddingVertical,
    paddingHorizontal: spacing.buttonPaddingHorizontal,
  },
  sizeLg: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  textSm: {
    ...typography.styles.buttonSmall,
  },
  textMd: {
    ...typography.styles.button,
  },
  textLg: {
    fontSize: 18,
    fontWeight: '600',
  },
  
  // Variant: Primary (handled by gradient)
  primaryText: {
    color: colors.white,
  },
  
  // Variant: Secondary
  secondaryContainer: {
    backgroundColor: colors.backgroundElevated,
  },
  secondaryText: {
    color: colors.text,
  },
  
  // Variant: Outline
  outlineContainer: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  outlineText: {
    color: colors.primary,
  },
  
  // Variant: Ghost
  ghostContainer: {
    backgroundColor: 'transparent',
  },
  ghostText: {
    color: colors.primary,
  },
  
  // Variant: Yes
  yesText: {
    color: colors.white,
  },
  
  // Variant: No
  noText: {
    color: colors.white,
  },
  
  // Disabled state
  disabled: {
    opacity: 0.5,
  },
  textDisabled: {
    opacity: 0.7,
  },
});
