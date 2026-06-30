import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Alert, Platform, TextInput, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, getInitials, getUserBadges, getTier } from '../theme';

const SYMBOLS = ['÷', 'π', 'Σ', '√', '∞'];
const COLORS_LIST = ['#0ECE8F', '#00D4FF', '#F59E0B', '#6366F1', '#A855F7', '#EF4444'];

interface Props {
  username: string;
  email: string;
  wins: number;
  losses: number;
  xp: number;
  rating?: number;
  streak: number;
  avatarColor?: string;
  serverUrl: string;
  jwtToken: string | null;
  onBack: () => void;
  onLogout: () => void;
  onProfileUpdated?: (username: string, avatarColor: string) => void;
}

export default function ProfileScreen({
  username: initialUsername,
  email,
  wins,
  losses,
  xp,
  rating = 500,
  streak,
  avatarColor: initialAvatarColor,
  serverUrl,
  jwtToken,
  onBack,
  onLogout,
  onProfileUpdated,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(initialUsername);
  const [avatarColor, setAvatarColor] = useState(initialAvatarColor ?? '');
  const [editUsername, setEditUsername] = useState(initialUsername);
  const [editColor, setEditColor] = useState(
    initialAvatarColor?.includes(':') ? initialAvatarColor.split(':')[0]! : COLORS_LIST[0]!
  );
  const [editSymbol, setEditSymbol] = useState(
    initialAvatarColor?.includes(':') ? initialAvatarColor.split(':')[1]! : SYMBOLS[0]!
  );
  const [saving, setSaving] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const checkTimer = useRef<any>(null);

  const badges = getUserBadges(rating, wins, losses, streak);
  const tier = getTier(rating);

  const hasCustom = avatarColor?.includes(':');
  const displayColor = hasCustom ? avatarColor.split(':')[0]! : COLORS.primary;
  const displaySymbol = hasCustom ? avatarColor.split(':')[1]! : getInitials(username);

  // Debounced username availability check
  useEffect(() => {
    if (!editing) return;
    const trimmed = editUsername.trim();
    if (trimmed === initialUsername || trimmed.length < 3) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    clearTimeout(checkTimer.current);
    checkTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${serverUrl}/auth/check-username?username=${encodeURIComponent(trimmed)}`,
          { headers: { Authorization: `Bearer ${jwtToken}` } }
        );
        const data = await res.json();
        setUsernameStatus(data.available ? 'available' : 'taken');
      } catch {
        setUsernameStatus('idle');
      }
    }, 500);
    return () => clearTimeout(checkTimer.current);
  }, [editUsername, editing]);

  const startEdit = () => {
    setEditUsername(username);
    const hasC = avatarColor?.includes(':');
    setEditColor(hasC ? avatarColor.split(':')[0]! : COLORS_LIST[0]!);
    setEditSymbol(hasC ? avatarColor.split(':')[1]! : SYMBOLS[0]!);
    setUsernameStatus('idle');
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setUsernameStatus('idle'); };

  const saveEdit = async () => {
    if (usernameStatus === 'taken') return;
    setSaving(true);
    try {
      const newAvatarColor = `${editColor}:${editSymbol}`;
      const body: Record<string, string> = { avatarColor: newAvatarColor };
      const trimmed = editUsername.trim();
      if (trimmed !== username) body.username = trimmed;

      const res = await fetch(`${serverUrl}/auth/update-profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwtToken}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Update failed', data.error ?? 'Something went wrong.');
        return;
      }
      setUsername(data.user.username);
      setAvatarColor(newAvatarColor);
      onProfileUpdated?.(data.user.username, newAvatarColor);
      setEditing(false);
    } catch {
      Alert.alert('Connection Error', 'Could not reach the server.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Duelist Profile</Text>
        {!editing ? (
          <TouchableOpacity style={s.editBtn} onPress={startEdit} activeOpacity={0.7}>
            <Ionicons name="pencil-outline" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.editBtn} onPress={cancelEdit} activeOpacity={0.7}>
            <Ionicons name="close" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {!editing ? (
          /* ── VIEW MODE ── */
          <>
            <View style={s.profileCardPass}>
              <View style={[s.profileAvatar, { backgroundColor: displayColor }]}>
                <Text style={s.profileAvatarText}>{displaySymbol}</Text>
              </View>
              <View style={s.profileInfo}>
                <Text style={s.profileName}>{username}</Text>
                <Text style={[s.profileSubText, { color: tier.color }]}>{tier.label}</Text>
                <View style={s.profileBadgesRow}>
                  {badges.map((badge) => (
                    <View key={badge.name} style={[s.badgeItem, { backgroundColor: badge.color + '15', borderColor: badge.color + '30' }]}>
                      <Ionicons name={badge.icon as any} size={10} color={badge.color} />
                      <Text style={[s.badgeText, { color: badge.color }]}>{badge.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <Text style={s.sectionLabel}>ARENA STANDINGS</Text>
            <View style={s.group}>
              <View style={s.statRow}>
                <Text style={s.statLabel}>Current Rating</Text>
                <Text style={[s.statVal, { color: COLORS.primary }]}>{xp.toLocaleString()} XP</Text>
              </View>
              <View style={s.divider} />
              <View style={s.statRow}>
                <Text style={s.statLabel}>Arena Tier</Text>
                <Text style={[s.statVal, { color: tier.color }]}>{tier.label}</Text>
              </View>
              <View style={s.divider} />
              <View style={s.statRow}>
                <Text style={s.statLabel}>Victories</Text>
                <Text style={s.statVal}>{wins} W · {losses} L</Text>
              </View>
              <View style={s.divider} />
              <View style={s.statRow}>
                <Text style={s.statLabel}>Win Streak</Text>
                <Text style={[s.statVal, { color: streak > 0 ? COLORS.primary : COLORS.textSecondary }]}>
                  {streak > 0 ? `🔥 ${streak}` : '—'}
                </Text>
              </View>
            </View>

            <Text style={s.sectionLabel}>SESSION</Text>
            <TouchableOpacity
              style={s.signOutBtn}
              onPress={() => Alert.alert('Leave Arena', 'Sign out?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: onLogout },
              ])}
              activeOpacity={0.8}
            >
              <Text style={s.signOutBtnText}>Sign Out</Text>
            </TouchableOpacity>

            <Text style={s.versionText}>Math Duel Arena · v1.4.0</Text>
          </>
        ) : (
          /* ── EDIT MODE ── */
          <>
            {/* Live preview */}
            <View style={s.previewCard}>
              <View style={[s.profileAvatar, { backgroundColor: editColor, width: 72, height: 72, borderRadius: 22 }]}>
                <Text style={[s.profileAvatarText, { fontSize: 30 }]}>{editSymbol}</Text>
              </View>
              <Text style={s.previewName}>@{editUsername.trim() || 'username'}</Text>
            </View>

            {/* Username */}
            <Text style={s.fieldLabel}>USERNAME</Text>
            <View style={[s.inputRow, usernameStatus === 'taken' && { borderColor: COLORS.error }]}>
              <Text style={s.atPrefix}>@</Text>
              <TextInput
                style={s.input}
                value={editUsername}
                onChangeText={t => setEditUsername(t.replace(/[^a-zA-Z0-9_]/g, ''))}
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
            {usernameStatus === 'taken' && <Text style={s.errorText}>Username already taken</Text>}
            {usernameStatus === 'available' && <Text style={s.availText}>Username available</Text>}

            {/* Symbol */}
            <Text style={[s.fieldLabel, { marginTop: 20 }]}>AVATAR SYMBOL</Text>
            <View style={s.symbolRow}>
              {SYMBOLS.map(sym => (
                <TouchableOpacity
                  key={sym}
                  style={[s.symbolBtn, editSymbol === sym && { borderColor: editColor, borderWidth: 2.5 }]}
                  onPress={() => setEditSymbol(sym)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.symbolBtnText, editSymbol === sym && { color: editColor }]}>{sym}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Color */}
            <Text style={[s.fieldLabel, { marginTop: 20 }]}>COLOR</Text>
            <View style={s.colorRow}>
              {COLORS_LIST.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[s.colorDot, { backgroundColor: c }, editColor === c && s.colorDotSelected]}
                  onPress={() => setEditColor(c)}
                  activeOpacity={0.8}
                >
                  {editColor === c && <Ionicons name="checkmark" size={16} color="#fff" />}
                </TouchableOpacity>
              ))}
            </View>

            {/* Save */}
            <TouchableOpacity
              style={[s.saveBtn, (saving || usernameStatus === 'taken') && { opacity: 0.5 }]}
              onPress={saveEdit}
              disabled={saving || usernameStatus === 'taken'}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#0ECE8F', '#00D4FF']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.saveBtnInner}
              >
                {saving
                  ? <ActivityIndicator color="#071510" />
                  : <Text style={s.saveBtnText}>Save Changes</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 14,
    paddingBottom: 12,
  },
  backBtn: {
    width: 38, height: 38, alignItems: 'center', justifyContent: 'center',
    marginRight: 10, borderRadius: 19,
    backgroundColor: COLORS.borderGlass, borderWidth: 1, borderColor: COLORS.border,
  },
  headerTitle: { flex: 1, fontSize: 24, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  editBtn: {
    width: 38, height: 38, alignItems: 'center', justifyContent: 'center',
    borderRadius: 19, backgroundColor: COLORS.borderGlass, borderWidth: 1, borderColor: COLORS.border,
  },
  scrollContent: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 80 },

  profileCardPass: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 20, padding: 18,
    borderWidth: 1.5, borderColor: COLORS.border, marginBottom: 28, gap: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  profileAvatar: {
    width: 60, height: 60, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowRadius: 10,
  },
  profileAvatarText: { fontSize: 22, fontWeight: '900', color: '#fff' },
  profileInfo: { flex: 1, gap: 2 },
  profileName: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  profileSubText: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  profileBadgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  badgeItem: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1,
  },
  badgeText: { fontSize: 9, fontWeight: '800' },

  sectionLabel: {
    fontSize: 10, fontWeight: '800', color: COLORS.textSecondary,
    letterSpacing: 1.5, marginBottom: 10, marginLeft: 4,
  },
  group: {
    backgroundColor: COLORS.surface, borderRadius: 20,
    borderWidth: 1.5, borderColor: COLORS.border, overflow: 'hidden', marginBottom: 28,
  },
  statRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 16,
  },
  statLabel: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '700' },
  statVal: { fontSize: 15, color: COLORS.text, fontWeight: '800' },
  divider: { height: 1.5, backgroundColor: COLORS.border, opacity: 0.3, marginLeft: 18 },

  signOutBtn: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary, borderRadius: 14, height: 50,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 6,
  },
  signOutBtnText: { fontSize: 15, fontWeight: '800', color: '#071510' },
  versionText: { fontSize: 11, color: COLORS.textMuted, textAlign: 'center', marginTop: 24, fontWeight: '600' },

  // Edit mode
  previewCard: { alignItems: 'center', marginBottom: 28, gap: 10 },
  previewName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  fieldLabel: {
    fontSize: 10, fontWeight: '800', color: COLORS.textSecondary,
    letterSpacing: 1.5, marginBottom: 8, marginLeft: 2,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: 14, height: 52, gap: 8,
  },
  atPrefix: { fontSize: 16, color: COLORS.textMuted, fontWeight: '600' },
  input: { flex: 1, fontSize: 16, color: COLORS.text, fontWeight: '600' },
  errorText: { fontSize: 12, color: COLORS.error, marginTop: 4, marginLeft: 4, fontWeight: '600' },
  availText: { fontSize: 12, color: COLORS.primary, marginTop: 4, marginLeft: 4, fontWeight: '600' },

  symbolRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  symbolBtn: {
    flex: 1, height: 52, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border,
  },
  symbolBtnText: { fontSize: 22, color: COLORS.textSecondary },

  colorRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  colorDot: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  colorDotSelected: { borderWidth: 3, borderColor: '#fff' },

  saveBtn: { marginTop: 32, borderRadius: 16, overflow: 'hidden' },
  saveBtnInner: { height: 54, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 16, fontWeight: '900', color: '#071510' },
});
