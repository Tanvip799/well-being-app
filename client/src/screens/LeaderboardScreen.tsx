import React, { useEffect, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, getInitials, getAvatarColor } from '../theme';

const { width } = Dimensions.get('window');

// ─── Data ─────────────────────────────────────────────────────────────────────
interface Entry {
  id: number;
  rank: number;
  name: string;
  avatarColor: string;
  wins: number;
  rating: number;
  isMe?: boolean;
}

function getTier(xp: number): { title: string; color: string; bg: string } {
  if (xp >= 2200) return { title: 'GRANDMASTER', color: '#F472B6', bg: 'rgba(244,114,182,0.12)' };
  if (xp >= 2000) return { title: 'MASTER', color: '#A78BFA', bg: 'rgba(167,139,250,0.12)' };
  if (xp >= 1800) return { title: 'DIAMOND', color: '#00D4FF', bg: 'rgba(0, 212, 255, 0.12)' };
  if (xp >= 1500) return { title: 'PLATINUM', color: '#2DD4BF', bg: 'rgba(45,212,191,0.12)' };
  if (xp >= 1200) return { title: 'GOLD', color: '#FBBF24', bg: 'rgba(251,191,36,0.12)' };
  return { title: 'BRONZE', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' };
}

type Filter = 'Global' | 'Friends' | 'Weekly';

interface Props {
  currentUsername: string;
  currentUserXP: number;
  wins: number;
  serverUrl: string;
  jwtToken: string | null;
  onBack: () => void;
}

// ─── Avatar circle ─────────────────────────────────────────────────────────────
function Avatar({
  name, color, size, ringColor,
}: { name: string; color: string; size: number; ringColor?: string }) {
  return (
    <View style={ringColor ? { padding: 3, borderRadius: (size + 8) / 2, borderWidth: 2.5, borderColor: ringColor, shadowColor: ringColor, shadowOpacity: 0.35, shadowRadius: 8 } : undefined}>
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: color, alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: size * 0.36, fontWeight: '800', color: '#FFF' }}>
          {getInitials(name)}
        </Text>
      </View>
    </View>
  );
}

export default function LeaderboardScreen({ currentUsername, currentUserXP, wins, serverUrl, jwtToken, onBack }: Props) {
  const [filter, setFilter] = useState<Filter>('Global');
  const [roster, setRoster] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaderboard = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await fetch(`${serverUrl}/leaderboard`);
      if (res.ok) {
        const data = await res.json();
        const mapped: Entry[] = data.leaderboard.map((u: any, idx: number) => ({
          id: u.id,
          rank: idx + 1,
          name: u.username,
          avatarColor: getAvatarColor(u.username),
          wins: u.wins,
          rating: u.xp,
          isMe: u.username === currentUsername,
        }));
        setRoster(mapped);
      }
    } catch (err) {
      console.log('Failed to fetch leaderboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchLeaderboard(); }, []);

  // Ensure current user is in roster somewhere if not in top 20
  const myEntryInRoster = roster.find(r => r.name === currentUsername);
  let finalRoster = [...roster];
  
  if (!myEntryInRoster && roster.length > 0 && !loading) {
    const myEntry: Entry = {
      id: -1,
      rank: 999, // Unranked / below top 20
      name: currentUsername,
      avatarColor: COLORS.primary,
      wins,
      rating: currentUserXP,
      isMe: true,
    };
    finalRoster.push(myEntry);
  }

  const podium = finalRoster.slice(0, 3); // ranks 1, 2, 3
  
  // display order: rank2 (left) | rank1 (center) | rank3 (right)
  const podiumOrder = podium.length >= 3 ? [podium[1]!, podium[0]!, podium[2]!] : [];
  const podiumColors = ['#00D4FF', '#0ECE8F', '#8B5CF6'] as const;
  const heights = [100, 130, 85] as const; // Pedestal heights for e-sports look

  const listRows = finalRoster.length >= 3 ? finalRoster.slice(3) : finalRoster;

  return (
    <View style={s.container}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Ionicons name="trophy" size={26} color={COLORS.gold} style={{ marginRight: 6 }} />
        <Text style={s.title}>Leaderboard</Text>
      </View>

      {/* ── Filter tabs ── */}
      <View style={s.filterRow}>
        {(['Global', 'Friends', 'Weekly'] as Filter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[s.filterTab, filter === f && s.filterActive]}
            onPress={() => setFilter(f)}
            activeOpacity={0.8}
          >
            <Text style={[s.filterText, filter === f && s.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={s.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchLeaderboard(true)}
              tintColor={COLORS.primary}
            />
          }
        >
          {/* ── Podium Arena ── */}
          {podiumOrder.length === 3 && (
            <View style={s.podiumWrap}>
              {podiumOrder.map((entry, i) => {
                const color = podiumColors[i]!;
                const height = heights[i]!;
                const isFirst = i === 1;
                const avatarSize = isFirst ? 72 : 58;

                return (
                  <View key={entry.rank} style={s.podiumCol}>
                    <View style={s.podiumAvatarWrap}>
                      <Avatar name={entry.name} color={entry.avatarColor} size={avatarSize} ringColor={color} />
                      {isFirst && (
                        <View style={s.crownIcon}>
                          <Ionicons name="ribbon" size={16} color="#0ECE8F" />
                        </View>
                      )}
                    </View>

                    <Text style={s.podiumName} numberOfLines={1}>{entry.name}</Text>
                    
                    {/* 3D Pillar Pedestal */}
                    <LinearGradient
                      colors={isFirst ? ['rgba(14,206,143,0.18)', 'rgba(14,206,143,0.03)'] : (i === 0 ? ['rgba(0,212,255,0.14)', 'rgba(0,212,255,0.02)'] : ['rgba(139,92,246,0.14)', 'rgba(139,92,246,0.02)'])}
                      style={[s.pedestal, { height, borderColor: color }]}
                    >
                      <Text style={[s.pedestalRankText, { color }]}>{entry.rank}</Text>
                      
                      {/* Small tier badge on pedestal */}
                      <View style={[s.podiumTierBadge, { backgroundColor: getTier(entry.rating).bg, borderColor: getTier(entry.rating).color }]}>
                        <Text style={[s.podiumTierText, { color: getTier(entry.rating).color }]}>
                          {getTier(entry.rating).title}
                        </Text>
                      </View>

                      <Text style={[s.podiumPts, isFirst && { color: '#0ECE8F', fontWeight: '800' }]}>
                        {entry.rating.toLocaleString()}
                      </Text>
                      <Text style={s.podiumWinsText}>{entry.wins} wins</Text>
                    </LinearGradient>
                  </View>
                );
              })}
            </View>
          )}

          {/* ── Ranked list 4+ ── */}
          <Text style={s.sectionTitle}>RANKINGS</Text>
          <View style={s.listWrap}>
            {listRows.map((entry) => (
              <View key={entry.id} style={[s.row, entry.isMe && s.rowMe]}>
                <Text style={[s.rowRank, entry.isMe && { color: '#00D4FF' }]}>
                  {entry.rank === 999 ? '-' : entry.rank}
                </Text>
                <Avatar name={entry.name} color={entry.avatarColor} size={42} />
                <View style={s.rowInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                    <Text style={[s.rowName, entry.isMe && { color: '#00D4FF' }]}>
                      {entry.name}
                    </Text>
                    <View style={[s.tierBadge, { backgroundColor: getTier(entry.rating).bg, borderColor: getTier(entry.rating).color }]}>
                      <Text style={[s.tierBadgeText, { color: getTier(entry.rating).color }]}>
                        {getTier(entry.rating).title}
                      </Text>
                    </View>
                  </View>
                  <Text style={s.rowWins}>{entry.wins} Victories</Text>
                </View>
                <Text style={[s.rowRating, entry.isMe && { color: '#00D4FF' }]}>
                  {entry.rating.toLocaleString()} XP
                </Text>
                {entry.isMe && (
                  <View style={s.youBadge}>
                    <Text style={s.youBadgeText}>YOU</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // ── Header
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
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },

  // ── Filters
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    gap: 8,
    marginBottom: 10,
  },
  filterTab: {
    paddingVertical: 7,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceCard,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  filterActive: { backgroundColor: '#0ECE8F', borderColor: '#0ECE8F' },
  filterText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  filterTextActive: { color: '#071510', fontWeight: '800' },

  scroll: { paddingHorizontal: 16, paddingTop: 10 },

  // ── Podium
  podiumWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 12,
    marginBottom: 20,
  },
  podiumCol: {
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  podiumAvatarWrap: { position: 'relative', marginBottom: 8 },
  crownIcon: {
    position: 'absolute',
    top: -10,
    alignSelf: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 2,
  },
  podiumName: { fontSize: 13, fontWeight: '800', color: COLORS.text, textAlign: 'center', marginBottom: 8, width: '100%' },
  
  // Podium Pillar Column
  pedestal: {
    width: '100%',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    paddingVertical: 10,
    gap: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  pedestalRankText: {
    fontSize: 22,
    fontWeight: '900',
    opacity: 0.85,
  },
  podiumPts: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '700' },
  podiumWinsText: { fontSize: 10, color: COLORS.textMuted, fontWeight: '600' },

  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
    marginBottom: 10,
    marginLeft: 4,
  },

  // ── List rows (With defined borders!)
  listWrap: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  rowMe: {
    borderWidth: 1.5,
    borderColor: '#00D4FF',
    backgroundColor: 'rgba(0, 212, 255, 0.05)',
  },
  rowRank: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textSecondary,
    width: 22,
    textAlign: 'center',
  },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  rowWins: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  rowRating: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  youBadge: {
    backgroundColor: 'rgba(0,212,255,0.12)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.25)',
  },
  youBadgeText: { fontSize: 10, fontWeight: '800', color: '#00D4FF' },
  
  // Tier Badges Styles
  tierBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  tierBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  podiumTierBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.8,
    marginVertical: 4,
  },
  podiumTierText: {
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
});
