import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, getInitials } from '../theme';

interface Props {
  username: string;
  setUsername: (v: string) => void;
  serverUrl: string;
  setServerUrl: (v: string) => void;
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  vibrationEnabled: boolean;
  setVibrationEnabled: (v: boolean) => void;
  wins: number;
  xp: number;
  onBack: () => void;
}

export default function ProfileScreen({
  username,
  setUsername,
  serverUrl,
  setServerUrl,
  soundEnabled,
  setSoundEnabled,
  vibrationEnabled,
  setVibrationEnabled,
  wins,
  xp,
  onBack,
}: Props) {
  const [darkMode, setDarkMode] = useState(true);
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState(serverUrl);

  const initials = getInitials(username);

  const saveUrl = () => {
    if (urlInput.trim()) setServerUrl(urlInput.trim());
    setEditingUrl(false);
  };

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Profile card */}
        <TouchableOpacity style={s.profileCard} activeOpacity={0.75}>
          <View style={s.profileAvatar}>
            <Text style={s.profileAvatarText}>{initials}</Text>
          </View>
          <View style={s.profileInfo}>
            <Text style={s.profileName}>{username}</Text>
            <Text style={s.profileSub}>Rating {xp.toLocaleString()} · #128 Global</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
        </TouchableOpacity>

        {/* PREFERENCES */}
        <Text style={s.sectionLabel}>PREFERENCES</Text>
        <View style={s.group}>
          <View style={s.settingRow}>
            <Text style={s.settingLabel}>Dark Mode</Text>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor="#FFF"
              ios_backgroundColor={COLORS.border}
            />
          </View>
          <View style={s.divider} />
          <View style={s.settingRow}>
            <Text style={s.settingLabel}>Sound Effects</Text>
            <Switch
              value={soundEnabled}
              onValueChange={setSoundEnabled}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor="#FFF"
              ios_backgroundColor={COLORS.border}
            />
          </View>
          <View style={s.divider} />
          <View style={s.settingRow}>
            <Text style={s.settingLabel}>Haptics</Text>
            <Switch
              value={vibrationEnabled}
              onValueChange={setVibrationEnabled}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor="#FFF"
              ios_backgroundColor={COLORS.border}
            />
          </View>
        </View>

        {/* GENERAL */}
        <Text style={s.sectionLabel}>GENERAL</Text>
        <View style={s.group}>
          {/* Server URL */}
          {editingUrl ? (
            <View style={s.urlEditBox}>
              <Text style={s.urlEditLabel}>Server Address</Text>
              <TextInput
                value={urlInput}
                onChangeText={setUrlInput}
                style={s.urlInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={saveUrl}
                placeholder="http://192.168.x.x:3000"
                placeholderTextColor={COLORS.textMuted}
              />
              <TouchableOpacity style={s.saveUrlBtn} onPress={saveUrl}>
                <Text style={s.saveUrlBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={s.settingRow}
                onPress={() => { setUrlInput(serverUrl); setEditingUrl(true); }}
                activeOpacity={0.7}
              >
                <Text style={s.settingLabel}>Server Address</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
              <View style={s.divider} />
            </>
          )}

          <TouchableOpacity
            style={s.settingRow}
            onPress={() => Alert.alert('Math Duel', 'Version 1.4.0 (build 220)\nReal-time multiplayer math battles.')}
            activeOpacity={0.7}
          >
            <Text style={s.settingLabel}>About Math Duel</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
          <View style={s.divider} />
          <TouchableOpacity
            style={s.settingRow}
            onPress={() => Alert.alert('Rate the App', 'Thanks for playing Math Duel! ⭐')}
            activeOpacity={0.7}
          >
            <Text style={s.settingLabel}>Rate the App</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
          <View style={s.divider} />
          <TouchableOpacity
            style={s.settingRow}
            onPress={() =>
              Alert.alert('Sign Out', 'Are you sure?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive' },
              ])
            }
            activeOpacity={0.7}
          >
            <Text style={[s.settingLabel, { color: '#F85149' }]}>Sign Out</Text>
            <Ionicons name="chevron-forward" size={16} color="#F85149" />
          </TouchableOpacity>
        </View>

        {/* Version footer */}
        <Text style={s.versionText}>Math Duel · Version 1.4.0 (build 220)</Text>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 12 : 14,
    paddingBottom: 16,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: COLORS.text },
  scrollContent: { paddingHorizontal: 18, paddingBottom: 80 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 28,
    gap: 14,
  },
  profileAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: { fontSize: 18, fontWeight: '700', color: '#0B1A14' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 3 },
  profileSub: { fontSize: 12, color: COLORS.textSecondary },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1.5,
    marginBottom: 8,
    marginLeft: 2,
    marginTop: 4,
  },
  group: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: 24,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  settingLabel: { fontSize: 15, color: COLORS.text, fontWeight: '500' },
  divider: { height: 1, backgroundColor: COLORS.border, marginLeft: 16 },
  urlEditBox: { padding: 16 },
  urlEditLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600', marginBottom: 8 },
  urlInput: {
    fontSize: 13,
    color: COLORS.text,
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  saveUrlBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveUrlBtnText: { fontSize: 14, fontWeight: '700', color: '#0B1A14' },
  versionText: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
});
