import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Keyboard,
  Alert,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { COLORS } from '../theme';

interface Props {
  serverUrl: string;
  onLoginSuccess: (
    username: string,
    email: string,
    xp: number,
    wins: number,
    token: string,
    userId: number
  ) => void;
}

type Mode = 'login' | 'register';

export default function LoginScreen({ serverUrl, onLoginSuccess }: Props) {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const passwordRef = useRef<TextInput>(null);

  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  };

  const handleSubmit = async () => {
    if (!username.trim() || !password) {
      triggerShake();
      Alert.alert('Missing fields', 'Please enter your username and password.');
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === 'register' ? '/auth/register' : '/auth/login';
      const res = await fetch(`${serverUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        triggerShake();
        Alert.alert(mode === 'register' ? 'Registration Failed' : 'Sign In Failed', data.error || 'Something went wrong.');
        return;
      }

      // Persist JWT securely on native
      if (Platform.OS !== 'web') {
        await SecureStore.setItemAsync('jwt_token', data.token);
      }

      onLoginSuccess(
        data.user.username,
        '',
        data.user.xp,
        data.user.wins,
        data.token,
        data.user.id
      );
    } catch (err) {
      triggerShake();
      Alert.alert('Connection Error', 'Could not reach the Arena server. Make sure it is running.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(m => (m === 'login' ? 'register' : 'login'));
    setUsername('');
    setPassword('');
  };

  return (
    <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.container}
      >
        {/* ── Logo ── */}
        <View style={s.logoContainer}>
          <LinearGradient
            colors={['#0ECE8F', '#00D4FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.logoIconWrap}
          >
            <Text style={s.logoSymbol}>÷</Text>
          </LinearGradient>
          <Text style={s.title}>MATH DUEL</Text>
          <Text style={s.subtitle}>ENTER THE ARENA</Text>
        </View>

        {/* ── Card ── */}
        <Animated.View style={[s.card, { transform: [{ translateX: shakeAnim }] }]}>
          {/* Mode toggle tabs */}
          <View style={s.tabRow}>
            <TouchableOpacity
              style={[s.tab, mode === 'login' && s.tabActive]}
              onPress={() => setMode('login')}
              activeOpacity={0.8}
            >
              <Text style={[s.tabText, mode === 'login' && s.tabTextActive]}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tab, mode === 'register' && s.tabActive]}
              onPress={() => setMode('register')}
              activeOpacity={0.8}
            >
              <Text style={[s.tabText, mode === 'register' && s.tabTextActive]}>Create Account</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.cardDesc}>
            {mode === 'register'
              ? 'Choose a unique duelist tag and password to enter the arena.'
              : 'Welcome back, duelist. Sign in to resume your rank.'}
          </Text>

          {/* Username field */}
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>USERNAME</Text>
            <View style={s.inputRow}>
              <Ionicons name="person-outline" size={18} color={COLORS.textSecondary} style={s.inputIcon} />
              <TextInput
                style={s.input}
                value={username}
                onChangeText={setUsername}
                placeholder="e.g. ArenaKing99"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                maxLength={20}
              />
            </View>
          </View>

          {/* Password field */}
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>PASSWORD {mode === 'register' && <Text style={s.fieldHint}>(min. 6 chars)</Text>}</Text>
            <View style={s.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.textSecondary} style={s.inputIcon} />
              <TextInput
                ref={passwordRef}
                style={s.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={s.eyeBtn}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={COLORS.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[s.btn, loading && { opacity: 0.65 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#0ECE8F', '#11D4A8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.btnGradient}
            >
              {loading ? (
                <ActivityIndicator color="#071510" size="small" />
              ) : (
                <>
                  <Text style={s.btnText}>
                    {mode === 'register' ? 'CREATE & ENTER' : 'SIGN IN'}
                  </Text>
                  <Ionicons name="arrow-forward" size={20} color="#071510" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Switch mode link */}
          <TouchableOpacity style={s.switchRow} onPress={switchMode} disabled={loading}>
            <Text style={s.switchText}>
              {mode === 'login'
                ? "Don't have an account? "
                : 'Already have an account? '}
              <Text style={s.switchLink}>
                {mode === 'login' ? 'Create one' : 'Sign in'}
              </Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <Text style={s.footer}>Math Duel Arena · v1.4.0</Text>
      </KeyboardAvoidingView>
    </Pressable>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  // Logo
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logoIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#0ECE8F',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  logoSymbol: { fontSize: 44, color: '#FFF', fontWeight: '300' },
  title: { fontSize: 32, fontWeight: '900', color: COLORS.text, letterSpacing: 2.5 },
  subtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 4,
    marginTop: 8,
  },

  // Card
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 6,
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 4,
    marginBottom: 18,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  tabTextActive: { color: '#071510', fontWeight: '900' },

  cardDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 20,
    textAlign: 'center',
  },

  // Fields
  fieldWrap: { marginBottom: 14 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 1.2,
    marginBottom: 8,
    marginLeft: 2,
  },
  fieldHint: { fontSize: 9, fontWeight: '600', color: COLORS.textMuted },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: COLORS.text, fontWeight: '600' },
  eyeBtn: { padding: 4 },

  // Submit button
  btn: { height: 54, borderRadius: 14, overflow: 'hidden', marginTop: 6 },
  btnGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  btnText: { fontSize: 16, fontWeight: '900', color: '#071510', letterSpacing: 0.8 },

  // Switch
  switchRow: { alignItems: 'center', paddingTop: 18, paddingBottom: 4 },
  switchText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  switchLink: { color: COLORS.primary, fontWeight: '800' },

  footer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
});
