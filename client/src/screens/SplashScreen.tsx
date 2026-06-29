import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../theme';

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.82)).current;
  const barWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }),
      Animated.timing(barWidth, { toValue: 1, duration: 2400, useNativeDriver: false }),
    ]).start();

    const t = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => onFinish());
    }, 2600);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={s.container}>
      <View style={s.glowCenter} />

      {/* Faint math symbols */}
      <Text style={[s.symbol, { top: '17%', left: '9%', fontSize: 20 }]}>+</Text>
      <Text style={[s.symbol, { top: '24%', right: '11%', fontSize: 15 }]}>×</Text>
      <Text style={[s.symbol, { bottom: '33%', left: '13%', fontSize: 17 }]}>−</Text>
      <Text style={[s.symbol, { bottom: '24%', right: '10%', fontSize: 19 }]}>+</Text>
      <Text style={[s.symbol, { top: '13%', right: '30%', fontSize: 13 }]}>÷</Text>

      <Animated.View style={[s.content, { opacity: fade, transform: [{ scale }] }]}>
        <LinearGradient
          colors={['#0ECE8F', '#00D4FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.logoBox}
        >
          <Text style={s.divideSymbol}>÷</Text>
        </LinearGradient>

        <Text style={s.titleRow}>
          <Text style={s.titleMath}>Math </Text>
          <Text style={s.titleDuel}>Duel</Text>
        </Text>

        <Text style={s.tagline}>Think Fast. Solve Faster.</Text>
      </Animated.View>

      {/* Loading bar at bottom */}
      <View style={s.loadingContainer}>
        <View style={s.barTrack}>
          <Animated.View
            style={[
              s.barFill,
              {
                width: barWidth.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '90%'],
                }),
              },
            ]}
          />
        </View>
        <Text style={s.loadingText}>Loading your arena...</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowCenter: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#0ECE8F',
    opacity: 0.04,
    top: '25%',
  },
  symbol: {
    position: 'absolute',
    color: '#1B3028',
    fontWeight: '700',
  },
  content: {
    alignItems: 'center',
  },
  logoBox: {
    width: 88,
    height: 88,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  divideSymbol: {
    fontSize: 42,
    color: '#FFF',
    fontWeight: '300',
    lineHeight: 50,
    includeFontPadding: false,
  },
  titleRow: {
    fontSize: 40,
    lineHeight: 48,
    marginBottom: 12,
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
    fontSize: 15,
    color: COLORS.textSecondary,
    fontWeight: '400',
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 72,
    width: '58%',
    alignItems: 'center',
    gap: 10,
  },
  barTrack: {
    width: '100%',
    height: 3,
    backgroundColor: '#1A2235',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  loadingText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '400',
  },
});
