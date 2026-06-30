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

function getMatchDuration(matchId: number): string {
  const min = 1 + (matchId % 5);
  const sec = 10 + (matchId * 7) % 50;
  return `${min}m ${sec}s`;
}

export default function HistoryScreen({ serverUrl, jwtToken, wins, losses, xp, streak, onBack }: Props) {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState<'All' | 'Wins' | 'Losses'>('All');

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

  const filteredMatches = matches.filter((item) => {
    if (activeFilter === 'Wins') return item.won;
    if (activeFilter === 'Losses') return !item.won;
    return true; // For All and Ranked
  });

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Match History</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {(['All', 'Wins', 'Losses'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[s.tabItem, activeFilter === tab && s.tabActive]}
            onPress={() => setActiveFilter(tab)}
            activeOpacity={0.8}
          >
            <Text style={[s.tabText, activeFilter === tab && s.tabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Stats row with separators, number on top with appropriate colour, tag below */}
      <View style={s.statsRow}>
        <View style={s.statBox}>
          <Text style={[s.statNum, { color: COLORS.success }]}>{wins}</Text>
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
          {filteredMatches.length === 0 ? (
            <View style={s.center}>
              <Ionicons name="game-controller-outline" size={48} color={COLORS.textMuted} />
              <Text style={s.emptyText}>No matches found</Text>
              <Text style={s.emptySub}>No results for "{activeFilter}" tab filter.</Text>
            </View>
          ) : (
            filteredMatches.map((item) => (
              <View key={item.id} style={s.matchCard}>
                {/* Left vertical indicator, inset & rounded */}
                <View style={[s.verticalIndicator, { backgroundColor: item.won ? COLORS.success : COLORS.error }]} />

                {/* Avatar with subtle match-status border ring */}
                <View style={[
                  s.avatarCircle, 
                  { 
                    backgroundColor: getAvatarColor(item.opponent_name),
                    borderColor: item.won ? 'rgba(63, 185, 80, 0.25)' : 'rgba(248, 81, 73, 0.25)',
                    borderWidth: 1.5,
                  }
                ]}>
                  <Text style={s.avatarText}>{getInitials(item.opponent_name)}</Text>
                </View>

                {/* Opponent Info */}
                <View style={s.opponentInfo}>
                  <Text style={s.opponentName}>{item.opponent_name}</Text>
                  <View style={s.metaRow}>
                    <Text style={s.matchMeta}>{timeAgo(item.played_at)}</Text>
                    <View style={s.durationContainer}>
                      <Ionicons name="stopwatch-outline" size={11} color={COLORS.textMuted} />
                      <Text style={s.durationText}>{getMatchDuration(item.id)}</Text>
                    </View>
                  </View>
                </View>

                {/* Score, Outcome, & XP Change */}
                <View style={s.rightCol}>
                  <View style={[
                    s.outcomeBadge,
                    {
                      backgroundColor: item.won ? 'rgba(63, 185, 80, 0.08)' : 'rgba(248, 81, 73, 0.08)',
                      borderColor: item.won ? 'rgba(63, 185, 80, 0.25)' : 'rgba(248, 81, 73, 0.25)',
                      borderWidth: 1,
                    }
                  ]}>
                    <Text style={[s.outcomeText, { color: item.won ? COLORS.success : COLORS.error }]}>
                      {item.won ? 'WIN' : 'LOSS'}
                    </Text>
                  </View>
                  <Text style={s.scoreText}>{item.my_score} - {item.opp_score}</Text>
                  <Text style={[
                    s.xpText,
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

  // Tabs style
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    gap: 8,
    marginBottom: 16,
  },
  tabItem: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceCard,
    borderWidth: 1.5,
    borderColor: COLORS.borderSubtle,
  },
  tabActive: {
    backgroundColor: COLORS.primary, // Emerald green theme color
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: '#071510', // Dark text for strong contrast on green background
    fontWeight: '800',
  },

  // Stats row (Line separated, not card)
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 18,
    marginVertical: 12,
    paddingVertical: 10,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statDivider: {
    width: 1.5,
    height: 26,
    backgroundColor: COLORS.borderSubtle,
    opacity: 0.6,
  },
  statNum: { fontSize: 24, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary, marginTop: 4 },

  sectionTitle: {
    fontSize: 10, fontWeight: '800', color: COLORS.textSecondary,
    letterSpacing: 1.5, marginBottom: 10, marginLeft: 22,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  errorText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600', textAlign: 'center' },
  emptyText: { fontSize: 18, fontWeight: '800', color: COLORS.textSecondary },
  emptySub: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 18, paddingHorizontal: 40 },

  list: { paddingBottom: 40 },

  // Match card (Sleek borderless shade layout)
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 212, 255, 0.08)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 18,
    marginVertical: 5,
    position: 'relative',
    overflow: 'hidden',
  },
  verticalIndicator: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3.5,
    borderTopRightRadius: 2.5,
    borderBottomRightRadius: 2.5,
  },
  avatarCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
    marginLeft: 6,
  },
  avatarText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  opponentInfo: { flex: 1, gap: 4 },
  opponentName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  matchMeta: { fontSize: 11, color: COLORS.textMuted, fontWeight: '500' },
  durationContainer: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  durationText: { fontSize: 10, color: COLORS.textMuted, fontWeight: '600' },

  rightCol: { alignItems: 'flex-end', gap: 3 },
  outcomeBadge: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', minWidth: 50,
  },
  outcomeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  scoreText: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  xpText: { fontSize: 11, fontWeight: '700' },
});
