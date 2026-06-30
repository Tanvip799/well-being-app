import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, getInitials, getAvatarColor } from '../theme';

// Shape returned from server
interface MatchRow {
  id: number;
  opponent_name: string;
  my_score: number;
  opp_score: number;
  won: boolean;
  xp_change: number;
  played_at: string;
}

interface Props {
  serverUrl: string;
  jwtToken: string | null;
  wins: number;
  losses: number;
  xp: number;
  streak: number;
  onBack: () => void;
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function HistoryScreen({ serverUrl, jwtToken, wins, losses, xp, streak, onBack }: Props) {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const totalGames = wins + losses;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  const fetchMatches = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const res = await fetch(`${serverUrl}/matches`, {
        headers: { Authorization: `Bearer ${jwtToken}` },
      });
      if (!res.ok) throw new Error('Failed to load history');
      const data = await res.json();
      setMatches(data.matches || []);
    } catch (e: any) {
      setError('Could not load match history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchMatches(); }, []);

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Match History</Text>
      </View>

      {/* Stats Row */}
      <View style={s.statsCard}>
        <View style={s.statBox}>
          <Text style={[s.statNum, { color: COLORS.primary }]}>{wins}</Text>
          <Text style={s.statLabel}>Wins</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statBox}>
          <Text style={[s.statNum, { color: COLORS.error }]}>{losses}</Text>
          <Text style={s.statLabel}>Losses</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statBox}>
          <Text style={[s.statNum, { color: COLORS.accent }]}>{winRate}%</Text>
          <Text style={s.statLabel}>Win Rate</Text>
        </View>
      </View>

      <Text style={s.sectionTitle}>RECENT DUELS</Text>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={44} color={COLORS.textMuted} />
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchMatches(true)}
              tintColor={COLORS.primary}
            />
          }
        >
          {matches.length === 0 ? (
            <View style={s.center}>
              <Ionicons name="game-controller-outline" size={48} color={COLORS.textMuted} />
              <Text style={s.emptyText}>No matches yet</Text>
              <Text style={s.emptySub}>Jump into a duel to see your history here.</Text>
            </View>
          ) : (
            matches.map((item) => (
              <View key={item.id} style={s.matchCard}>
                {/* WIN / LOSS badge */}
                <View style={[
                  s.outcomeBadge,
                  {
                    backgroundColor: item.won ? 'rgba(63,185,80,0.12)' : 'rgba(248,81,73,0.12)',
                    borderColor: item.won ? 'rgba(63,185,80,0.35)' : 'rgba(248,81,73,0.35)',
                  },
                ]}>
                  <Text style={[s.outcomeText, { color: item.won ? '#3FB950' : '#F85149' }]}>
                    {item.won ? 'WIN' : 'LOSS'}
                  </Text>
                </View>

                {/* Avatar */}
                <View style={[s.avatarCircle, { backgroundColor: getAvatarColor(item.opponent_name) }]}>
                  <Text style={s.avatarText}>{getInitials(item.opponent_name)}</Text>
                </View>

                {/* Opponent Info */}
                <View style={s.opponentInfo}>
                  <Text style={s.opponentName}>{item.opponent_name}</Text>
                  <Text style={s.matchMeta}>{timeAgo(item.played_at)}</Text>
                </View>

                {/* Score + XP change */}
                <View style={s.rightCol}>
                  <View style={s.scoreContainer}>
                    <Text style={s.scoreText}>{item.my_score} — {item.opp_score}</Text>
                  </View>
                  <Text style={[
                    s.xpChange,
                    { color: item.xp_change >= 0 ? COLORS.primary : COLORS.error }
                  ]}>
                    {item.xp_change >= 0 ? '+' : ''}{item.xp_change} XP
                  </Text>
                </View>
              </View>
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 10 : 14,
    paddingBottom: 14,
  },
  backBtn: {
    width: 38, height: 38, alignItems: 'center', justifyContent: 'center',
    marginRight: 10, borderRadius: 19,
    backgroundColor: COLORS.borderGlass, borderWidth: 1.5, borderColor: COLORS.border,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },

  statsCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 20, borderWidth: 1.5,
    borderColor: COLORS.border, marginHorizontal: 18, paddingVertical: 18,
    marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 0.5, marginTop: 2 },
  statDivider: { width: 1, height: 24, backgroundColor: COLORS.border, opacity: 0.5 },

  sectionTitle: {
    fontSize: 10, fontWeight: '800', color: COLORS.textSecondary,
    letterSpacing: 1.5, marginBottom: 10, marginLeft: 22,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  errorText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600', textAlign: 'center' },
  emptyText: { fontSize: 18, fontWeight: '800', color: COLORS.textSecondary },
  emptySub: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 18, paddingHorizontal: 40 },

  list: { paddingBottom: 40 },

  matchCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1.5,
    borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 14,
    marginHorizontal: 18, marginVertical: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  outcomeBadge: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', minWidth: 50, marginRight: 10,
  },
  outcomeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  avatarCircle: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  avatarText: { fontSize: 13, fontWeight: '800', color: '#FFF' },
  opponentInfo: { flex: 1, gap: 2 },
  opponentName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  matchMeta: { fontSize: 11, color: COLORS.textMuted, fontWeight: '500' },
  rightCol: { alignItems: 'flex-end', gap: 4 },
  scoreContainer: {
    backgroundColor: COLORS.surfaceCard, borderRadius: 10, borderWidth: 1,
    borderColor: COLORS.borderSubtle, paddingHorizontal: 12, paddingVertical: 4,
  },
  scoreText: { fontSize: 13, fontWeight: '800', color: COLORS.textSecondary },
  xpChange: { fontSize: 11, fontWeight: '800' },
});
