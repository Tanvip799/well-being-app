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
import { COLORS, getInitials, getAvatarColor, getUserBadges, getTier } from '../theme';

const { width } = Dimensions.get('window');

// ─── Data ─────────────────────────────────────────────────────────────────────
interface Entry {
  id: number;
  rank: number;
  name: string;
  avatarColor: string;
  wins: number;
  losses: number;
  streak: number;
  xp: number;
  rating: number;
  isMe?: boolean;
}


interface Props {
  currentUsername: string;
  currentUserXP: number;
  currentUserRank: number;
  wins: number;
  losses: number;
  streak: number;
  serverUrl: string;
  jwtToken: string | null;
  onBack: () => void;
}

// ─── Avatar circle ─────────────────────────────────────────────────────────────
function Avatar({
  name, color, size, ringColor,
}: { name: string; color: string; size: number; ringColor?: string }) {
  const hasCustom = color && color.includes(':');
  const bg = hasCustom ? color.split(':')[0] : color;
  const symbol = hasCustom ? color.split(':')[1] : getInitials(name);

  return (
    <View style={ringColor ? { padding: 3, borderRadius: (size + 8) / 2, borderWidth: 2.5, borderColor: ringColor, shadowColor: ringColor, shadowOpacity: 0.35, shadowRadius: 8 } : undefined}>
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: bg, alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: size * (hasCustom ? 0.48 : 0.36), fontWeight: '800', color: '#FFF' }}>
          {symbol}
        </Text>
      </View>
    </View>
  );
}

export default function LeaderboardScreen({ currentUsername, currentUserXP, currentUserRank, wins, losses, streak, serverUrl, jwtToken, onBack }: Props) {
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
          id: idx,
          rank: idx + 1,
          name: u.username,
          avatarColor: u.avatar_color || getAvatarColor(u.username),
          wins: u.wins,
          losses: u.losses ?? 0,
          streak: u.streak ?? 0,
          xp: u.xp ?? 0,
          rating: u.rating ?? 1000,
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
      rank: currentUserRank,
      name: currentUsername,
      avatarColor: COLORS.primary,
      wins,
      losses,
      streak,
      xp: currentUserXP,
      rating: 1000, // fallback — actual rating not passed as prop yet
      isMe: true,
    };
    finalRoster.push(myEntry);
  }

  const podium = finalRoster.slice(0, 3); // ranks 1, 2, 3
  
  // display order: rank2 (left) | rank1 (center) | rank3 (right)
  const podiumOrder = podium.length >= 3 ? [podium[1]!, podium[0]!, podium[2]!] : [];
  const listRows = finalRoster.length >= 3 ? finalRoster.slice(3) : finalRoster;

  return (
    <View style={s.container}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={s.title}>Leaderboard</Text>
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
              {podiumOrder.map((entry) => {
                const isFirst = entry.rank === 1;
                const isSecond = entry.rank === 2;
                const isThird = entry.rank === 3;
                
                const avatarSize = isFirst ? 64 : 52;
                const ringColor = isFirst ? COLORS.primary : (isSecond ? COLORS.accent : COLORS.textSecondary);
                const badgeBg = isFirst ? COLORS.primary : (isSecond ? COLORS.accent : COLORS.textSecondary);
                const badgeTextColor = isFirst ? '#071510' : (isSecond ? '#08252e' : '#FFF');
                const pointsColor = isFirst ? COLORS.primary : (isSecond ? COLORS.accent : COLORS.textSecondary);

                return (
                  <View key={entry.rank} style={s.podiumCol}>
                    {isFirst ? (
                      /* Rank 1: Defined container with background shade (no border) */
                      <View
                        style={[
                          s.podiumCard,
                          {
                            height: 130,
                            backgroundColor: 'rgba(0, 212, 255, 0.08)', // Visible theme cyan background shade
                          }
                        ]}
                      >
                        <Text style={{ fontSize: 18, marginBottom: 4 }}>👑</Text>
                        
                        {/* Avatar Wrap */}
                        <View style={s.podiumAvatarWrap}>
                          <View style={[
                            s.podiumAvatarRing,
                            { borderColor: ringColor, width: avatarSize + 6, height: avatarSize + 6, borderRadius: (avatarSize + 6) / 2 }
                          ]}>
                            <Avatar name={entry.name} color={entry.avatarColor} size={avatarSize} />
                          </View>
                          {/* Rank Badge */}
                          <View style={[s.podiumBadge, { backgroundColor: badgeBg }]}>
                            <Text style={[s.podiumBadgeText, { color: badgeTextColor }]}>{entry.rank}</Text>
                          </View>
                        </View>
                      </View>
                    ) : (
                      /* Rank 2 & 3: Floating with no defined boundary card background */
                      <View style={s.floatingPodiumWrapper}>
                        {/* Avatar Wrap */}
                        <View style={s.podiumAvatarWrap}>
                          <View style={[
                            s.podiumAvatarRing,
                            { borderColor: ringColor, width: avatarSize + 6, height: avatarSize + 6, borderRadius: (avatarSize + 6) / 2 }
                          ]}>
                            <Avatar name={entry.name} color={entry.avatarColor} size={avatarSize} />
                          </View>
                          {/* Rank Badge */}
                          <View style={[s.podiumBadge, { backgroundColor: badgeBg }]}>
                            <Text style={[s.podiumBadgeText, { color: badgeTextColor }]}>{entry.rank}</Text>
                          </View>
                        </View>
                      </View>
                    )}

                    {/* Name, tier & rating below card */}
                    <Text style={s.podiumName} numberOfLines={1}>{entry.name}</Text>
                    <Text style={[s.podiumTier, { color: getTier(entry.rating).color }]}>
                      {getTier(entry.rating).label}
                    </Text>
                    <Text style={[s.podiumPts, { color: pointsColor }]}>
                      {entry.rating.toLocaleString()} MMR
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* ── Empty state ── */}
          {finalRoster.length === 0 && (
            <View style={s.emptyWrap}>
              <Ionicons name="trophy-outline" size={48} color={COLORS.textMuted} />
              <Text style={s.emptyTitle}>No players yet</Text>
              <Text style={s.emptySub}>Play a match to appear on the leaderboard</Text>
            </View>
          )}

          {/* ── Ranked list 4+ ── */}
          {finalRoster.length > 0 && <Text style={s.sectionTitle}>RANKINGS</Text>}
          <View style={s.listWrap}>
            {listRows.map((entry) => (
              <View key={entry.id} style={[s.row, entry.isMe && s.rowMe]}>
                <Text style={[s.rowRank, entry.isMe && { color: COLORS.accent }]}>
                  {entry.rank === 999 ? '-' : entry.rank}
                </Text>
                <Avatar name={entry.name} color={entry.avatarColor} size={40} />
                <View style={s.rowInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[s.rowName, entry.isMe && { color: COLORS.accent }]} numberOfLines={1}>
                      {entry.name}
                    </Text>
                    {entry.isMe && (
                      <View style={s.youBadge}><Text style={s.youBadgeText}>YOU</Text></View>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <View style={[s.tierBadge, { backgroundColor: getTier(entry.rating).bg }]}>
                      <Text style={[s.tierBadgeText, { color: getTier(entry.rating).color }]}>
                        {getTier(entry.rating).label}
                      </Text>
                    </View>
                    <Text style={s.rowWins}>{entry.wins}W · {entry.losses}L</Text>
                  </View>
                </View>
                <View style={s.rowRight}>
                  <Text style={[s.rowRating, entry.isMe && { color: COLORS.accent }]}>
                    {entry.rating.toLocaleString()}
                  </Text>
                  <Text style={s.rowXp}>{entry.xp.toLocaleString()} XP</Text>
                </View>
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



  scroll: { paddingHorizontal: 16, paddingTop: 10 },

  // ── Podium
  podiumWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 10,
    marginBottom: 20,
    marginTop: 10,
  },
  podiumCol: {
    alignItems: 'center',
    width: 96,
  },
  podiumCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 10,
  },
  floatingPodiumWrapper: {
    width: '100%',
    height: 130,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
    marginBottom: 10,
  },
  podiumAvatarWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumAvatarRing: {
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumBadge: {
    position: 'absolute',
    bottom: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  podiumBadgeText: {
    fontSize: 10,
    fontWeight: '900',
  },
  podiumName: { fontSize: 13, fontWeight: '800', color: COLORS.text, textAlign: 'center', marginBottom: 2, width: '100%' },
  podiumTier: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8, textAlign: 'center', marginBottom: 2 },
  podiumPts: { fontSize: 12, fontWeight: '700' },

  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
    marginBottom: 10,
    marginLeft: 4,
  },

  // ── List rows
  listWrap: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 212, 255, 0.08)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowMe: {
    borderWidth: 1.2,
    borderColor: 'rgba(0, 212, 255, 0.35)',
    backgroundColor: 'rgba(0, 212, 255, 0.02)',
  },
  rowRank: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textSecondary,
    width: 22,
    textAlign: 'center',
  },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  rowWins: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  rowRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 8,
  },
  rowRating: { fontSize: 15, fontWeight: '800', color: COLORS.accent, textAlign: 'right' },
  rowXp: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, textAlign: 'right' },
  tierBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  tierBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  youBadge: {
    backgroundColor: 'rgba(0, 212, 255, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.25)',
  },
  youBadgeText: { fontSize: 9, fontWeight: '800', color: '#00D4FF' },
  miniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.8,
  },
  miniBadgeText: {
    fontSize: 7.5,
    fontWeight: '800',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textSecondary,
  },
  emptySub: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 18,
  },
});
