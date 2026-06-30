import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, Easing, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../theme';

const { width } = Dimensions.get('window');

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.82)).current;
  const barWidth = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const isWeb = Platform.OS === 'web';
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: !isWeb }),
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: !isWeb }),
      Animated.timing(barWidth, { toValue: 1, duration: 2200, useNativeDriver: false }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: !isWeb }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: !isWeb }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: !isWeb }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: !isWeb }),
      ])
    ).start();

    const t = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 450, useNativeDriver: !isWeb }).start(() => onFinish());
    }, 2500);
    return () => clearTimeout(t);
  }, []);

  const floatY1 = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const floatY2 = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 15] });
  const floatY3 = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const floatY4 = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 10] });

  const logoScale = Animated.multiply(scale, pulseAnim);

  return (
    <View style={s.container}>
      <View style={s.glowCenter} />

      <Animated.Text style={[s.symbol, { top: '15%', left: '10%', fontSize: 24, transform: [{ translateY: floatY1 }] }]}>+</Animated.Text>
      <Animated.Text style={[s.symbol, { top: '22%', right: '12%', fontSize: 20, transform: [{ translateY: floatY2 }] }]}>×</Animated.Text>
      <Animated.Text style={[s.symbol, { bottom: '30%', left: '15%', fontSize: 22, transform: [{ translateY: floatY3 }] }]}>−</Animated.Text>
      <Animated.Text style={[s.symbol, { bottom: '22%', right: '14%', fontSize: 26, transform: [{ translateY: floatY4 }] }]}>÷</Animated.Text>
      <Animated.Text style={[s.symbol, { top: '12%', right: '35%', fontSize: 16, transform: [{ translateY: floatY1 }] }]}>=</Animated.Text>
      <Animated.Text style={[s.symbol, { bottom: '45%', right: '8%', fontSize: 18, transform: [{ translateY: floatY3 }] }]}>%</Animated.Text>

      <Animated.View style={[s.content, { opacity: fade, transform: [{ scale: logoScale }] }]}>
        <View style={s.shadowWrapper}>
          <LinearGradient
            colors={[COLORS.primary, COLORS.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.logoBox}
          >
            <Text style={s.divideSymbol}>÷</Text>
          </LinearGradient>
        </View>

        <Text style={s.titleRow}>
          <Text style={s.titleMath}>Math </Text>
          <Text style={s.titleDuel}>Duel</Text>
        </Text>

        <Text style={s.tagline}>Think Fast. Solve Faster.</Text>
      </Animated.View>

      <View style={s.loadingContainer}>
        <View style={s.barTrack}>
          <Animated.View
            style={[
              s.barFill,
              {
                width: barWidth.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
        <Text style={s.loadingText}>LOADING YOUR ARENA...</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070A13',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowCenter: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: COLORS.primaryGlow,
    opacity: 0.12,
    top: '25%',
  },
  symbol: {
    position: 'absolute',
    color: '#1B243B',
    fontWeight: '700',
  },
  content: {
    alignItems: 'center',
  },
  shadowWrapper: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 15,
    marginBottom: 28,
  },
  logoBox: {
    width: 96,
    height: 96,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  divideSymbol: {
    fontSize: 48,
    color: '#FFF',
    fontWeight: '300',
    lineHeight: 52,
    includeFontPadding: false,
  },
  titleRow: {
    fontSize: 44,
    lineHeight: 52,
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  titleMath: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  titleDuel: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  tagline: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 72,
    width: '64%',
    alignItems: 'center',
    gap: 12,
  },
  barTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  loadingText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '700',
    letterSpacing: 2,
  },
});
