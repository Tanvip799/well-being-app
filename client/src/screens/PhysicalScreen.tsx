import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated, Easing, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';

const { width } = Dimensions.get('window');

export default function PhysicalScreen() {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const startShineAnimation = () => {
      animatedValue.setValue(0);
      Animated.loop(
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 3500,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: Platform.OS !== 'web',
        })
      ).start();
    };

    startShineAnimation();
  }, [animatedValue]);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-width * 1.2, width * 1.2],
  });

  return (
    <View style={styles.container}>
      {/* Flat Card Container */}
      <View style={styles.card}>
        {/* Subtle sliding light reflection (metallic shine) */}
        <Animated.View style={[styles.shineContainer, { transform: [{ translateX }, { skewX: '-20deg' }] }]}>
          <LinearGradient
            colors={['transparent', 'rgba(255, 255, 255, 0.01)', 'rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.01)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Minimal Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="barbell-outline" size={32} color={COLORS.primary} />
        </View>

        <Text style={styles.title}>Physical Duel</Text>
        <Text style={styles.subtitle}>Test your reflexes and spatial coordination in real-time movement challenges.</Text>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>COMING SOON</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  card: {
    width: '85%',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceLight,
    paddingVertical: 45,
    paddingHorizontal: 25,
    alignItems: 'center',
    overflow: 'hidden',
  },
  shineContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: width,
    height: '100%',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 28,
    paddingHorizontal: 15,
  },
  badge: {
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 1,
  },
});
