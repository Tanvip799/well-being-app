import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, getInitials } from '../theme';

interface Props {
  username: string;
  email: string;
  wins: number;
  xp: number;
  onBack: () => void;
  onLogout: () => void;
}

export default function ProfileScreen({
  username,
  email,
  wins,
  xp,
  onBack,
  onLogout,
}: Props) {
  const initials = getInitials(username);

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Duelist Profile</Text>
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Google Connected Account Pass */}
        <View style={s.profileCardPass}>
          <View style={s.profileAvatarWrapper}>
            <View style={s.profileAvatar}>
              <Text style={s.profileAvatarText}>{initials}</Text>
            </View>
            <View style={s.googleBadge}>
              <Ionicons name="logo-google" size={10} color="#FFF" />
            </View>
          </View>
          <View style={s.profileInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={s.profileName}>{username}</Text>
              <View style={s.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={12} color={COLORS.primary} />
                <Text style={s.verifiedText}>VERIFIED</Text>
              </View>
            </View>
            <Text style={s.profileEmail}>{email || 'alex.rivera@gmail.com'}</Text>
            <Text style={s.profileProvider}>Connected via Google</Text>
          </View>
        </View>

        {/* ARENA STATISTICS */}
        <Text style={s.sectionLabel}>ARENA STANDINGS</Text>
        <View style={s.group}>
          <View style={s.statRow}>
            <Text style={s.statLabel}>Current Rating</Text>
            <Text style={[s.statVal, { color: COLORS.primary }]}>{xp.toLocaleString()} XP</Text>
          </View>
          <View style={s.divider} />
          
          <View style={s.statRow}>
            <Text style={s.statLabel}>Arena Tier</Text>
            <Text style={[s.statVal, { color: COLORS.accent }]}>
              {xp >= 2200 ? 'GRANDMASTER' : xp >= 2000 ? 'MASTER' : xp >= 1800 ? 'DIAMOND' : 'CHALLENGER'}
            </Text>
          </View>
          <View style={s.divider} />

          <View style={s.statRow}>
            <Text style={s.statLabel}>Victories</Text>
            <Text style={s.statVal}>{wins} Matches</Text>
          </View>
        </View>

        {/* ACCOUNT ACTION */}
        <Text style={s.sectionLabel}>SESSION</Text>
        <TouchableOpacity
          style={s.signOutBtn}
          onPress={() =>
            Alert.alert('Leave Arena', 'Are you sure you want to sign out of Google?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Leave', style: 'destructive', onPress: onLogout },
            ])
          }
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color="#F85149" style={{ marginRight: 8 }} />
          <Text style={s.signOutBtnText}>Sign Out of Google</Text>
        </TouchableOpacity>

        {/* Footer */}
        <Text style={s.versionText}>Math Duel Arena · Build v1.4.0 (220)</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 14,
    paddingBottom: 12,
  },
  backBtn: { 
    width: 38, 
    height: 38, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 10,
    borderRadius: 19,
    backgroundColor: COLORS.borderGlass,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 80 },

  // Player Pass card
  profileCardPass: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginBottom: 28,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  profileAvatarWrapper: {
    position: 'relative',
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  profileAvatarText: { fontSize: 22, fontWeight: '900', color: '#0B1A14' },
  googleBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EA4335',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.surface,
  },
  profileInfo: { flex: 1, gap: 2 },
  profileName: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(14, 206, 143, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.8,
    borderColor: 'rgba(14, 206, 143, 0.25)',
  },
  verifiedText: { fontSize: 8, fontWeight: '800', color: COLORS.primary },
  profileEmail: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  profileProvider: { fontSize: 10, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 0.5, marginTop: 2 },

  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  group: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: 28,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  statLabel: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '700' },
  statVal: { fontSize: 15, color: COLORS.text, fontWeight: '800' },
  divider: { height: 1.5, backgroundColor: COLORS.border, opacity: 0.3, marginLeft: 18 },
  
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#F85149',
    height: 54,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  signOutBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F85149',
  },
  versionText: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 24,
    fontWeight: '600',
  },
});
