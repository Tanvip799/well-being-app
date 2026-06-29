import React, { useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, getInitials } from '../theme';

// ─── Data ─────────────────────────────────────────────────────────────────────
interface Entry {
  rank: number;
  name: string;
  avatarColor: string;
  wins: number;
  rating: number;
  isMe?: boolean;
}

const ROSTER: Entry[] = [
  { rank: 1, name: 'Priya S.',   avatarColor: '#C07010', wins: 94,  rating: 2380 },
  { rank: 2, name: 'KaisoV',     avatarColor: '#505868', wins: 88,  rating: 2140 },
  { rank: 3, name: 'Zane K.',    avatarColor: '#4A7060', wins: 81,  rating: 2010 },
  { rank: 4, name: 'Sofia M.',   avatarColor: '#0F3050', wins: 63,  rating: 1980 },
  { rank: 5, name: 'Hiro T.',    avatarColor: '#503010', wins: 59,  rating: 1956 },
  { rank: 6, name: 'Layla A.',   avatarColor: '#4A1848', wins: 55,  rating: 1930 },
  { rank: 7, name: 'Luca R.',    avatarColor: '#1A3050', wins: 52,  rating: 1905 },
  { rank: 8, name: 'Emma W.',    avatarColor: '#183040', wins: 50,  rating: 1888 },
  { rank: 9, name: 'Mei Zhang',  avatarColor: '#3A2010', wins: 49,  rating: 1872 },
];

const RING_COLORS = ['#E8B920', '#B0B8C0', '#C87828'] as const; // gold, silver, bronze

type Filter = 'Global' | 'Friends' | 'Weekly';

interface Props {
  currentUsername: string;
  currentUserXP: number;
  wins: number;
  onBack: () => void;
}

// ─── Avatar circle ─────────────────────────────────────────────────────────────
function Avatar({
  name, color, size, ringColor,
}: { name: string; color: string; size: number; ringColor?: string }) {
  return (
    <View style={ringColor ? { padding: 3, borderRadius: (size + 6) / 2, borderWidth: 2.5, borderColor: ringColor } : undefined}>
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

export default function LeaderboardScreen({ currentUsername, currentUserXP, wins, onBack }: Props) {
  const [filter, setFilter] = useState<Filter>('Global');

  const myRank = 12;
  const myEntry: Entry = {
    rank: myRank,
    name: currentUsername,
    avatarColor: COLORS.primary,
    wins,
    rating: currentUserXP,
    isMe: true,
  };

  const podium = ROSTER.slice(0, 3); // ranks 1, 2, 3
  // display order: rank2 (left) | rank1 (center, raised) | rank3 (right)
  const podiumOrder = [podium[1]!, podium[0]!, podium[2]!];
  const podiumRingColors = [RING_COLORS[1], RING_COLORS[0], RING_COLORS[2]] as const;
  const podiumIsFirst = [false, true, false];

  const listRows = [...ROSTER.slice(3), myEntry]; // ranks 4–9 + you

  return (
    <View style={s.container}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={26} color="#FFF" />
        </TouchableOpacity>
        <Text style={s.trophy}>🏆</Text>
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Podium top 3 ── */}
        <View style={s.podiumWrap}>
          {podiumOrder.map((entry, i) => {
            const isFirst = podiumIsFirst[i];
            const ringColor = podiumRingColors[i];
            const avatarSize = isFirst ? 80 : 64;
            return (
              <View key={entry.rank} style={[s.podiumCol, isFirst && s.podiumColFirst]}>
                {/* Raised pedestal card for rank 1 */}
                {isFirst && <View style={s.pedestal} />}

                <View style={s.podiumAvatarWrap}>
                  <Avatar name={entry.name} color={entry.avatarColor} size={avatarSize} ringColor={ringColor} />
                  {/* Rank badge */}
                  <View style={[s.rankBadge, { backgroundColor: ringColor }]}>
                    <Text style={s.rankBadgeText}>{entry.rank}</Text>
                  </View>
                </View>

                <Text style={s.podiumName}>{entry.name}</Text>
                <Text style={[s.podiumPts, isFirst && s.podiumPtsFirst]}>
                  {entry.rating.toLocaleString()} pts
                </Text>
              </View>
            );
          })}
        </View>

        {/* ── Ranked list 4+ ── */}
        <View style={s.listWrap}>
          {listRows.map((entry) => (
            <View key={entry.rank} style={[s.row, entry.isMe && s.rowMe]}>
              <Text style={[s.rowRank, entry.isMe && { color: COLORS.primary }]}>
                {entry.rank}
              </Text>
              <Avatar name={entry.name} color={entry.avatarColor} size={46} />
              <View style={s.rowInfo}>
                <Text style={[s.rowName, entry.isMe && { color: COLORS.primary }]}>
                  {entry.name}
                </Text>
                <Text style={s.rowWins}>{entry.wins} wins</Text>
              </View>
              <Text style={[s.rowRating, entry.isMe && { color: COLORS.primary }]}>
                {entry.rating.toLocaleString()}
              </Text>
              {entry.isMe && (
                <View style={s.youBadge}>
                  <Text style={s.youBadgeText}>YOU</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08101E',
  },

  // ── Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 14,
    paddingBottom: 8,
    gap: 6,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  trophy: { fontSize: 24 },
  title: { fontSize: 24, fontWeight: '800', color: '#FFF' },

  // ── Filters
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    gap: 8,
    marginBottom: 4,
  },
  filterTab: {
    paddingVertical: 7,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: '#111827',
  },
  filterActive: { backgroundColor: COLORS.primary },
  filterText: { fontSize: 13, fontWeight: '700', color: '#5A6878' },
  filterTextActive: { color: '#0B1120' },

  scroll: { paddingHorizontal: 16 },

  // ── Podium
  podiumWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  podiumCol: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  podiumColFirst: {
    marginBottom: 0,
  },
  pedestal: {
    width: '80%',
    height: 20,
    backgroundColor: '#111827',
    borderRadius: 8,
    marginBottom: -8,
  },
  podiumAvatarWrap: { position: 'relative' },
  rankBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#08101E',
  },
  rankBadgeText: { fontSize: 11, fontWeight: '900', color: '#08101E' },
  podiumName: { fontSize: 13, fontWeight: '700', color: '#FFF', textAlign: 'center' },
  podiumPts: { fontSize: 12, color: '#6B7A8D', fontWeight: '500' },
  podiumPtsFirst: { color: '#E8B920', fontWeight: '700' },

  // ── List rows
  listWrap: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0E1929',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  rowMe: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(14,206,143,0.05)',
  },
  rowRank: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3A4558',
    width: 22,
    textAlign: 'center',
  },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '700', color: '#FFF', marginBottom: 2 },
  rowWins: { fontSize: 12, color: '#3A4558' },
  rowRating: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  youBadge: {
    backgroundColor: 'rgba(14,206,143,0.15)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(14,206,143,0.3)',
  },
  youBadgeText: { fontSize: 11, fontWeight: '800', color: COLORS.primary },
});
