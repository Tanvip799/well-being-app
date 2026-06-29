import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, getInitials, getAvatarColor } from '../theme';

export interface HistoryItem {
  id: string;
  opponentName: string;
  myScore: number;
  oppScore: number;
  won: boolean;
  timestamp: string;
  duration: string;
}

interface Props {
  history: HistoryItem[];
  wins: number;
  totalGames: number;
  xp: number;
  streak: number;
  onBack: () => void;
}

export default function HistoryScreen({ history, wins, totalGames, xp, streak, onBack }: Props) {
  const losses = totalGames - wins;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Match History</Text>
      </View>

      {/* Stats summary row */}
      <View style={s.statsRow}>
        <Text style={s.statGroup}>
          <Text style={s.statNum}>{wins} </Text>
          <Text style={s.statLabel}>Wins  </Text>
        </Text>
        <Text style={s.statGroup}>
          <Text style={s.statNum}>{losses} </Text>
          <Text style={s.statLabel}>Losses  </Text>
        </Text>
        <Text style={s.statGroup}>
          <Text style={[s.statNum, { color: COLORS.primary }]}>{winRate}% </Text>
          <Text style={s.statLabel}>Win rate</Text>
        </Text>
      </View>

      {/* Match list */}
      <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
        {history.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="game-controller-outline" size={48} color={COLORS.border} />
            <Text style={s.emptyText}>No matches yet</Text>
            <Text style={s.emptySub}>Play a game to see your history here</Text>
          </View>
        ) : (
          history.map((item) => {
            const initials = getInitials(item.opponentName);
            const avatarColor = getAvatarColor(item.opponentName);
            return (
              <View key={item.id} style={s.matchCard}>
                {/* Top row: avatar + name/time + badge */}
                <View style={s.matchTop}>
                  <View style={[s.matchAvatar, { backgroundColor: avatarColor }]}>
                    <Text style={s.matchAvatarText}>{initials}</Text>
                  </View>
                  <View style={s.matchInfo}>
                    <Text style={s.matchName}>{item.opponentName}</Text>
                    <Text style={s.matchTime}>{item.timestamp} · {item.duration}</Text>
                  </View>
                  <View style={[s.winBadge, { backgroundColor: item.won ? COLORS.successBg : COLORS.errorBg }]}>
                    <Text style={[s.winBadgeText, { color: item.won ? COLORS.success : COLORS.error }]}>
                      {item.won ? 'WIN' : 'LOSS'}
                    </Text>
                  </View>
                </View>

                {/* Bottom: score */}
                <Text style={s.matchScore}>
                  {item.myScore} — {item.oppScore}
                </Text>
              </View>
            );
          })
        )}
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
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 22,
    paddingVertical: 14,
    gap: 4,
  },
  statGroup: { marginRight: 6 },
  statNum: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  statLabel: { fontSize: 13, color: COLORS.textSecondary },
  list: { paddingHorizontal: 18, paddingBottom: 30, gap: 10 },
  matchCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  matchTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  matchAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  matchAvatarText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  matchInfo: { flex: 1 },
  matchName: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 3 },
  matchTime: { fontSize: 11, color: COLORS.textMuted },
  winBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  winBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  matchScore: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textSecondary,
    paddingLeft: 56, // align with name
  },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 18, fontWeight: '700', color: COLORS.textSecondary },
  emptySub: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center' },
});
