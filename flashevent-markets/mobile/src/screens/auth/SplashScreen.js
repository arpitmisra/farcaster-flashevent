import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing } from '../../styles/theme';

const { width, height } = Dimensions.get('window');

export default function SplashScreen({ navigation }) {
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(50);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleSignIn = () => {
    navigation.navigate('FarcasterAuth');
  };

  return (
    <View style={styles.container}>
      {/* Background gradient */}
      <LinearGradient
        colors={[colors.background, '#1a0a2e', colors.background]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Animated content */}
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoIcon}>⚡🔮⚡</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>FLASHEVENT</Text>
        <Text style={styles.subtitle}>MARKETS</Text>

        {/* Tagline */}
        <Text style={styles.tagline}>
          Predict the Future.{'\n'}Win on Farcaster.
        </Text>

        {/* Sign in button */}
        <TouchableOpacity
          style={styles.signInButton}
          onPress={handleSignIn}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={colors.gradientPrimary}
            style={styles.signInGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.farcasterIcon}>🟣</Text>
            <Text style={styles.signInText}>Sign in with Farcaster</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Powered by */}
        <View style={styles.poweredBy}>
          <Text style={styles.poweredByText}>Powered by:</Text>
          <Text style={styles.techStack}>Monad • x402 • ZK Proofs</Text>
        </View>
      </Animated.View>

      {/* Decorative elements */}
      <View style={styles.decorTop} />
      <View style={styles.decorBottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.screenHorizontal,
  },
  logoContainer: {
    marginBottom: spacing.lg,
  },
  logoIcon: {
    fontSize: 64,
  },
  title: {
    ...typography.styles.h1,
    color: colors.text,
    letterSpacing: 4,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.styles.h3,
    color: colors.primary,
    letterSpacing: 8,
    marginBottom: spacing.xl,
  },
  tagline: {
    ...typography.styles.bodyLarge,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: spacing['3xl'],
  },
  signInButton: {
    width: '100%',
    maxWidth: 300,
    borderRadius: spacing.buttonBorderRadius,
    overflow: 'hidden',
    marginBottom: spacing['3xl'],
  },
  signInGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.buttonPaddingVertical,
    paddingHorizontal: spacing.buttonPaddingHorizontal,
  },
  farcasterIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  signInText: {
    ...typography.styles.button,
    color: colors.white,
  },
  poweredBy: {
    alignItems: 'center',
    position: 'absolute',
    bottom: spacing['3xl'],
  },
  poweredByText: {
    ...typography.styles.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  techStack: {
    ...typography.styles.label,
    color: colors.textSecondary,
  },
  decorTop: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.primary,
    opacity: 0.1,
  },
  decorBottom: {
    position: 'absolute',
    bottom: -150,
    left: -150,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: colors.secondary,
    opacity: 0.05,
  },
});
