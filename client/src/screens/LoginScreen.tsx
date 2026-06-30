import React, { useState, useRef, useEffect } from 'react';
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
  Animated,
  StatusBar,
  ScrollView,
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
    userId: string,
    refreshToken?: string,
  ) => void;
}

type Step = 'verify-email' | 'verify-otp' | 'creating-profile-loading' | 'setup-profile';

const MATH_SYMBOLS = ['÷', 'π', 'Σ', '√', '∞'];
const AVATAR_COLORS = ['#0ECE8F', '#00D4FF', '#FF9F0A', '#3A80F6', '#BF5AF2', '#FF375F'];

export default function LoginScreen({ serverUrl, onLoginSuccess }: Props) {
  const [step, setStep] = useState<Step>('verify-email');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [otp, setOtp] = useState('');

  // Themed toast
  const [toast, setToast] = useState<{ msg: string; type: 'error' | 'success' | 'info' } | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<any>(null);
  const showToast = (msg: string, type: 'error' | 'success' | 'info' = 'error') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastAnim.setValue(0);
    Animated.spring(toastAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToast(null));
    }, 3500);
  };

  // Custom Profile Avatar State
  const [selectedSymbol, setSelectedSymbol] = useState(MATH_SYMBOLS[0]);
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);
  
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const usernameCheckTimer = useRef<any>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Animated values for 3rd screen (creating-profile-loading)
  const [loadingPercent, setLoadingPercent] = useState(0);
  const [loadingStep1, setLoadingStep1] = useState('pending'); // 'pending' | 'loading' | 'success'
  const [loadingStep2, setLoadingStep2] = useState('pending');
  const [loadingStep3, setLoadingStep3] = useState('pending');
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Temporary variable to hold the user result if profileExists is true
  const [verifiedUserData, setVerifiedUserData] = useState<any>(null);

  const otpInputRef = useRef<TextInput>(null);

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

  const handleSendOtp = async () => {
    if (!email.trim() || !email.includes('@')) {
      triggerShake();
      showToast('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${serverUrl}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json();
      if (!res.ok) {
        triggerShake();
        showToast(data.error || 'Failed to send code. Try again.');
        return;
      }

      showToast('Code sent! Check your inbox.', 'success');
      setStep('verify-otp');
    } catch (err) {
      triggerShake();
      showToast('Could not connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 6) {
      triggerShake();
      showToast('Please enter the full 6-digit code.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${serverUrl}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: otp.trim(),
        }),
      });

      const data = await res.json();
      console.log('[Auth] OTP Verified Response:', data);
      if (!res.ok) {
        triggerShake();
        showToast(data.error || 'Invalid code. Please try again.');
        return;
      }

      if (data.profileExists && data.user) {
        // Skip profile screen and loading screen completely for existing users!
        if (Platform.OS !== 'web') {
          await SecureStore.setItemAsync('jwt_token', data.token);
          if (data.refreshToken) await SecureStore.setItemAsync('refresh_token', data.refreshToken);
        }
        onLoginSuccess(
          data.user.username,
          email.trim().toLowerCase(),
          data.user.xp,
          data.user.wins,
          data.token,
          data.user.id,
          data.refreshToken,
        );
      } else {
        // Only show loading flow for new users — store tokens AFTER profile is created
        setTempToken(data.token);
        setVerifiedUserData(data);
        setTimeout(() => setStep('creating-profile-loading'), 50);
      }
    } catch (err) {
      triggerShake();
      showToast('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  };

  // Run Screen 3 Animations
  useEffect(() => {
    if (step === 'creating-profile-loading') {
      setLoadingPercent(0);
      setLoadingStep1('loading');
      setLoadingStep2('pending');
      setLoadingStep3('pending');
      rotateAnim.setValue(0);
      progressAnim.setValue(0);

      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        })
      ).start();

      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 3200,
        useNativeDriver: false,
      }).start();

      const listener = progressAnim.addListener(({ value }) => {
        setLoadingPercent(Math.round(value * 100));
      });

      const t1 = setTimeout(() => {
        setLoadingStep1('success');
        setLoadingStep2('loading');
      }, 900);

      const t2 = setTimeout(() => {
        setLoadingStep2('success');
        setLoadingStep3('loading');
      }, 1900);

      const t3 = setTimeout(async () => {
        setLoadingStep3('success');
        try { progressAnim.removeAllListeners(); } catch (e) {}
        setStep('setup-profile');
      }, 3400);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        try { progressAnim.removeAllListeners(); } catch (e) {}
      };
    }
  }, [step]);

  const handleCreateProfile = async () => {
    if (!username.trim() || username.trim().length < 3) {
      triggerShake();
      showToast('Duelist tag must be at least 3 characters.');
      return;
    }
    if (!tempToken) return;

    setLoading(true);
    try {
      const combinedAvatarColor = `${selectedColor}:${selectedSymbol}`;
      const res = await fetch(`${serverUrl}/auth/create-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tempToken}`
        },
        body: JSON.stringify({
          username: username.trim(),
          avatarColor: combinedAvatarColor
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        triggerShake();
        showToast(data.error || 'Failed to configure profile. Try again.');
        return;
      }

      // Profile creation succeeded — now safe to persist both tokens
      if (Platform.OS !== 'web') {
        await SecureStore.setItemAsync('jwt_token', tempToken);
        if (verifiedUserData?.refreshToken) {
          await SecureStore.setItemAsync('refresh_token', verifiedUserData.refreshToken);
        }
      }

      onLoginSuccess(
        data.user.username,
        email.trim().toLowerCase(),
        data.user.xp,
        data.user.wins,
        tempToken,
        data.user.id,
        verifiedUserData?.refreshToken,
      );
    } catch (err) {
      triggerShake();
      showToast('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const widthPercent = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const renderProgressBar = (activeSegments: number, totalSegments = 3) => {
    return (
      <View style={s.segmentRow}>
        {Array(totalSegments).fill(0).map((_, i) => (
          <View
            key={i}
            style={[
              s.segment,
              i < activeSegments && s.segmentActive,
              i === activeSegments - 1 && s.segmentActiveLast,
            ]}
          />
        ))}
      </View>
    );
  };

  return (
    <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.container}
      >
        <StatusBar barStyle="light-content" />

        {step === 'verify-email' && (
          <View style={s.screenContent}>
            <View style={s.topNav}>
              {renderProgressBar(1)}
            </View>

            <View style={[s.centeredStep, { paddingTop: Platform.OS === 'ios' ? 110 : 90 }]}>
            <View style={s.bigLogoWrap}>
              <LinearGradient
                colors={['#0ECE8F', '#00D4FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.glowingIcon}
              >
                <Text style={s.glowingSymbol}>÷</Text>
              </LinearGradient>
            </View>

            <Animated.View style={[s.textGroup, { transform: [{ translateX: shakeAnim }] }]}>
              <Text style={s.mainTitle}>What's your email?</Text>
              <Text style={s.mainDesc}>
                Sign in or create an account with a one-time code — no password needed.
              </Text>

              <View style={s.inputRow}>
                <Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} style={s.mailIcon} />
                <TextInput
                  style={s.textInput}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  onSubmitEditing={handleSendOtp}
                />
              </View>

              <TouchableOpacity
                style={[s.primaryBtn, loading && { opacity: 0.65 }]}
                onPress={handleSendOtp}
                disabled={loading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#0ECE8F', '#00D4FF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.btnGrad}
                >
                  {loading ? (
                    <ActivityIndicator color="#071510" size="small" />
                  ) : (
                    <Text style={s.btnLabel}>Continue</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            <Text style={s.termsText}>
              By continuing you agree to our <Text style={s.termsLink}>Terms & Privacy</Text>.
            </Text>
            </View>
          </View>
        )}

        {step === 'verify-otp' && (
          <View style={s.screenContent}>
            <View style={s.topNav}>
              <TouchableOpacity onPress={() => setStep('verify-email')} style={s.backChevron}>
                <Ionicons name="chevron-back" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
              {renderProgressBar(2)}
            </View>

            <View style={[s.centeredStep, { paddingTop: Platform.OS === 'ios' ? 110 : 90 }]}>
            <Animated.View style={[s.textGroup, { transform: [{ translateX: shakeAnim }] }]}>
              <Text style={s.mainTitle}>Enter the code</Text>
              <View style={s.descRow}>
                <Text style={s.mainDesc}>We sent a 6-digit code to </Text>
                <Text style={s.emailBold}>{email}</Text>
                <TouchableOpacity onPress={() => setStep('verify-email')}>
                  <Text style={s.editLink}> Edit</Text>
                </TouchableOpacity>
              </View>

              <Pressable onPress={() => otpInputRef.current?.focus()} style={s.otpContainer}>
                {Array(6).fill(0).map((_, idx) => {
                  const val = otp[idx] || '';
                  const isFocused = otp.length === idx;
                  return (
                    <View key={idx} style={[s.otpBox, isFocused && s.otpBoxFocused]}>
                      <Text style={s.otpBoxText}>{val}</Text>
                    </View>
                  );
                })}
              </Pressable>

              <TextInput
                ref={otpInputRef}
                style={s.hiddenInput}
                value={otp}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9]/g, '');
                  setOtp(cleaned);
                  if (cleaned.length === 6) {
                    Keyboard.dismiss();
                  }
                }}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />

              <Text style={s.resendText}>Resend code in 9s</Text>

              <TouchableOpacity
                style={[s.primaryBtn, loading && { opacity: 0.65 }, { marginTop: 40 }]}
                onPress={handleVerifyOtp}
                disabled={loading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#0ECE8F', '#00D4FF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.btnGrad}
                >
                  {loading ? (
                    <ActivityIndicator color="#071510" size="small" />
                  ) : (
                    <Text style={s.btnLabel}>Verify & continue</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
            </View>
          </View>
        )}

        {step === 'creating-profile-loading' && (
          <View style={s.screenContent}>
            <View style={s.topNav}>
              {renderProgressBar(2)}
            </View>

            <View style={[s.centeredStep, { paddingTop: Platform.OS === 'ios' ? 110 : 90 }]}>
            <View style={s.loaderOuterWrap}>
              <Animated.View style={[s.rotatingRing, { transform: [{ rotate: spin }] }]}>
                <LinearGradient
                  colors={['#0ECE8F', '#00D4FF', 'transparent']}
                  style={s.gradientRing}
                />
              </Animated.View>
              <View style={s.loaderInnerAvatar}>
                <Text style={s.loaderAvatarSymbol}>÷</Text>
              </View>
            </View>

            <View style={s.textGroup}>
              <Text style={s.mainTitle}>Creating your profile</Text>
              <Text style={s.mainDesc}>Hang tight — we're setting up your arena.</Text>

              <View style={s.progressTrack}>
                <Animated.View style={[s.progressBarFill, { width: widthPercent }]} />
              </View>

              <View style={s.checkList}>
                <View style={s.checkRow}>
                  <View style={[s.circleIcon, loadingStep1 === 'success' && s.circleIconChecked]}>
                    {loadingStep1 === 'success' ? (
                      <Ionicons name="checkmark" size={14} color="#071510" />
                    ) : (
                      <ActivityIndicator size="small" color="#0ECE8F" />
                    )}
                  </View>
                  <Text style={[s.checkLabel, loadingStep1 === 'success' && s.checkLabelCompleted]}>
                    Email verified
                  </Text>
                </View>

                <View style={s.checkRow}>
                  <View style={[
                    s.circleIcon,
                    loadingStep2 === 'success' && s.circleIconChecked,
                    loadingStep2 === 'pending' && s.circleIconPending
                  ]}>
                    {loadingStep2 === 'success' ? (
                      <Ionicons name="checkmark" size={14} color="#071510" />
                    ) : loadingStep2 === 'loading' ? (
                      <ActivityIndicator size="small" color="#0ECE8F" />
                    ) : null}
                  </View>
                  <Text style={[
                    s.checkLabel,
                    loadingStep2 === 'success' && s.checkLabelCompleted,
                    loadingStep2 === 'pending' && s.checkLabelPending
                  ]}>
                    Generating your rating
                  </Text>
                </View>

                <View style={s.checkRow}>
                  <View style={[
                    s.circleIcon,
                    loadingStep3 === 'success' && s.circleIconChecked,
                    loadingStep3 === 'pending' && s.circleIconPending
                  ]}>
                    {loadingStep3 === 'success' ? (
                      <Ionicons name="checkmark" size={14} color="#071510" />
                    ) : loadingStep3 === 'loading' ? (
                      <ActivityIndicator size="small" color="#0ECE8F" />
                    ) : null}
                  </View>
                  <Text style={[
                    s.checkLabel,
                    loadingStep3 === 'success' && s.checkLabelCompleted,
                    loadingStep3 === 'pending' && s.checkLabelPending
                  ]}>
                    Loading your arena
                  </Text>
                </View>
              </View>

              <Text style={s.loadingFooter}>This only takes a moment...</Text>
            </View>
            </View>
          </View>
        )}

        {step === 'setup-profile' && (
          <View style={s.screenContent}>
            {/* Inline header — not absolute, so ScrollView starts cleanly below it */}
            <View style={s.setupTopNav}>
              <TouchableOpacity onPress={() => setStep('verify-otp')} style={s.backChevron}>
                <Ionicons name="chevron-back" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
              {renderProgressBar(3)}
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ flex: 1 }}
              contentContainerStyle={s.setupScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={s.mainTitle}>Make it yours</Text>
              <Text style={s.mainDesc}>Pick an avatar and color. You can change these later.</Text>

              {/* Live preview card */}
              <View style={s.avatarPreviewWrap}>
                <View style={[s.avatarCirclePreview, { backgroundColor: selectedColor }]}>
                  <Text style={s.avatarSymbolPreviewText}>{selectedSymbol}</Text>
                </View>
                <Text style={s.usernamePreview}>@{username.trim() || 'username'}</Text>
                <Text style={s.ratingPreview}>Rating 1,000 · New player</Text>
              </View>

              {/* Username */}
              <View style={s.fieldLabelRow}>
                <Text style={s.fieldTitle}>USERNAME</Text>
              </View>
              <View style={[s.inputRowProfile, usernameStatus === 'taken' && { borderColor: COLORS.error }]}>
                <Text style={s.atPrefix}>@</Text>
                <TextInput
                  style={s.profileInput}
                  value={username}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^a-zA-Z0-9_]/g, '');
                    setUsername(cleaned);
                    if (cleaned.length < 3) { setUsernameStatus('idle'); return; }
                    setUsernameStatus('checking');
                    clearTimeout(usernameCheckTimer.current);
                    usernameCheckTimer.current = setTimeout(async () => {
                      try {
                        const res = await fetch(`${serverUrl}/auth/check-username?username=${encodeURIComponent(cleaned)}`, {
                          headers: { Authorization: `Bearer ${tempToken}` },
                        });
                        const data = await res.json();
                        setUsernameStatus(data.available ? 'available' : 'taken');
                      } catch { setUsernameStatus('idle'); }
                    }, 500);
                  }}
                  placeholder="alexrivera"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                />
                {usernameStatus === 'checking' && <ActivityIndicator size="small" color={COLORS.textMuted} />}
                {usernameStatus === 'available' && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
                {usernameStatus === 'taken' && <Ionicons name="close-circle" size={20} color={COLORS.error} />}
              </View>
              {usernameStatus === 'taken' && (
                <Text style={{ color: COLORS.error, fontSize: 12, marginTop: 4, marginLeft: 4, fontWeight: '600' }}>
                  Username already taken
                </Text>
              )}
              {usernameStatus === 'available' && (
                <Text style={{ color: COLORS.primary, fontSize: 12, marginTop: 4, marginLeft: 4, fontWeight: '600' }}>
                  Username available ✓
                </Text>
              )}

              {/* Avatar symbol — inline row (5 symbols, no scroll) */}
              <View style={s.fieldLabelRow}>
                <Text style={s.fieldTitle}>AVATAR SYMBOL</Text>
              </View>
              <View style={s.symbolsInlineRow}>
                {MATH_SYMBOLS.map((symbol) => {
                  const isSelected = selectedSymbol === symbol;
                  return (
                    <TouchableOpacity
                      key={symbol}
                      style={[
                        s.symbolPill,
                        isSelected && s.symbolPillSelected,
                        isSelected && { backgroundColor: selectedColor + '33', borderColor: selectedColor },
                      ]}
                      onPress={() => setSelectedSymbol(symbol)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.symbolPillText, isSelected && { color: selectedColor }]}>
                        {symbol}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Color row */}
              <View style={s.fieldLabelRow}>
                <Text style={s.fieldTitle}>COLOR</Text>
              </View>
              <View style={s.colorsPoolRow}>
                {AVATAR_COLORS.map((color) => {
                  const isSelected = selectedColor === color;
                  return (
                    <TouchableOpacity
                      key={color}
                      style={[
                        s.colorCircularPill,
                        { backgroundColor: color },
                        isSelected && s.colorCircularPillSelected
                      ]}
                      onPress={() => setSelectedColor(color)}
                      activeOpacity={0.7}
                    >
                      {isSelected && (
                        <Ionicons name="checkmark" size={18} color="#071510" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Enter Button */}
              <TouchableOpacity
                style={[s.primaryBtn, (loading || usernameStatus === 'taken' || usernameStatus === 'checking') && { opacity: 0.65 }, { marginTop: 24, marginBottom: 40 }]}
                onPress={handleCreateProfile}
                disabled={loading || usernameStatus === 'taken' || usernameStatus === 'checking'}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#0ECE8F', '#00D4FF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.btnGrad}
                >
                  {loading ? (
                    <ActivityIndicator color="#071510" size="small" />
                  ) : (
                    <Text style={s.btnLabel}>Enter the arena</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

      </KeyboardAvoidingView>

      {/* Themed toast */}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[
            s.toastWrap,
            {
              opacity: toastAnim,
              transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
              borderColor: toast.type === 'success' ? COLORS.primary : toast.type === 'info' ? COLORS.accent : COLORS.error,
            },
          ]}
        >
          <Ionicons
            name={toast.type === 'success' ? 'checkmark-circle' : toast.type === 'info' ? 'information-circle' : 'alert-circle'}
            size={18}
            color={toast.type === 'success' ? COLORS.primary : toast.type === 'info' ? COLORS.accent : COLORS.error}
            style={{ marginRight: 8 }}
          />
          <Text style={s.toastText}>{toast.msg}</Text>
        </Animated.View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#071510',
  },
  screenContent: {
    flex: 1,
  },
  topNav: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 58 : 36,
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    zIndex: 10,
  },
  backChevron: {
    position: 'absolute',
    left: 0,
    padding: 6,
  },
  segmentRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 36,
  },
  segment: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  segmentActive: {
    backgroundColor: '#0ECE8F',
  },
  segmentActiveLast: {
    shadowColor: '#0ECE8F',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
  bigLogoWrap: {
    alignItems: 'center',
    marginBottom: 40,
  },
  glowingIcon: {
    width: 90,
    height: 90,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0ECE8F',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 22,
    elevation: 10,
  },
  glowingSymbol: {
    fontSize: 48,
    fontWeight: '300',
    color: '#FFFFFF',
  },
  centeredStep: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  textGroup: {
    alignSelf: 'stretch',
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  mainDesc: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: 28,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A1C15',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 20,
  },
  mailIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  primaryBtn: {
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
  },
  btnGrad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLabel: {
    fontSize: 16,
    fontWeight: '900',
    color: '#071510',
    letterSpacing: -0.2,
  },
  descRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 28,
  },
  emailBold: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  editLink: {
    fontSize: 15,
    color: '#0ECE8F',
    fontWeight: '800',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 20,
  },
  otpBox: {
    flex: 1,
    height: 58,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#0A1C15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxFocused: {
    borderColor: '#0ECE8F',
    shadowColor: '#0ECE8F',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  otpBoxText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  resendText: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    fontWeight: '700',
    marginTop: 10,
  },
  loaderOuterWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 140,
    marginBottom: 30,
  },
  rotatingRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  gradientRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3.5,
    borderColor: '#0ECE8F',
    opacity: 0.85,
  },
  loaderInnerAvatar: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: '#0A1C15',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderAvatarSymbol: {
    fontSize: 40,
    color: '#FFFFFF',
    fontWeight: '300',
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    width: '100%',
    marginBottom: 30,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#0ECE8F',
  },
  checkList: {
    gap: 16,
    marginBottom: 40,
    paddingLeft: 4,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  circleIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(14, 206, 143, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleIconChecked: {
    backgroundColor: '#0ECE8F',
  },
  circleIconPending: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  checkLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  checkLabelCompleted: {
    color: COLORS.textSecondary,
  },
  checkLabelPending: {
    color: COLORS.textMuted,
  },
  loadingFooter: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    fontWeight: '700',
  },
  avatarPreviewWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarCirclePreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    marginBottom: 16,
  },
  avatarSymbolPreviewText: {
    fontSize: 48,
    color: '#FFFFFF',
    fontWeight: '300',
  },
  usernamePreview: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  ratingPreview: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  fieldLabelRow: {
    alignSelf: 'stretch',
    marginBottom: 8,
    marginLeft: 2,
  },
  fieldTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 1.2,
  },
  inputRowProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A1C15',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 20,
  },
  atPrefix: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textSecondary,
    marginRight: 2,
  },
  profileInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  setupTopNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 0,
  },
  setupScrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  symbolsInlineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  symbolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  symbolPill: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0A1C15',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolPillSelected: {
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  symbolPillText: {
    fontSize: 19,
    color: COLORS.textSecondary,
    fontWeight: '800',
  },
  symbolPillTextSelected: {
    color: '#FFFFFF',
  },
  colorsPoolRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 24,
  },
  colorCircularPill: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  colorCircularPillSelected: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.1 }],
  },
  symbolTriggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A1C15',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
    height: 64,
    marginBottom: 20,
    gap: 12,
  },
  symbolTriggerCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolTriggerSymbol: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  symbolTriggerText: {
    flex: 1,
  },
  symbolTriggerLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  symbolTriggerHint: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#0D1F17',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    maxHeight: '75%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginBottom: 20,
  },
  modalSymbolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modalSymbolPill: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0A1C15',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSymbolPillSelected: {
    borderWidth: 2,
  },
  modalSymbolText: {
    fontSize: 22,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  termsText: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    textAlign: 'center',
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 16,
    fontWeight: '600',
  },
  termsLink: {
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  toastWrap: {
    position: 'absolute',
    bottom: 48,
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(11, 26, 20, 0.97)',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  toastText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    lineHeight: 20,
  },
});
