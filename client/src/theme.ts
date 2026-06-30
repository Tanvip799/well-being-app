// Math Duel — Emerald & Cyan Design System
export const getThemeColors = (isDark: boolean) => {
  return {
    // Backgrounds
    background: isDark ? '#0D1117' : '#F6F8FA',
    surface: isDark ? '#161B22' : '#FFFFFF',
    surfaceCard: isDark ? '#1C2128' : '#F1F5F9',
    surfaceMedium: isDark ? '#21262D' : '#E2E8F0',

    // Borders (Defined and crisp!)
    border: isDark ? '#30363D' : '#D1D5DB',
    borderSubtle: isDark ? '#21262D' : '#E2E8F0',
    surfaceLight: isDark ? '#1C2128' : '#F8FAFC',

    // Text
    text: isDark ? '#FFFFFF' : '#0F172A',
    textSecondary: isDark ? '#8B949E' : '#475569',
    textMuted: isDark ? '#484F58' : '#94A3B8',

    // Primary — Emerald
    primary: '#0ECE8F',
    primaryDark: '#0AAF79',
    primaryGlow: isDark ? 'rgba(14, 206, 143, 0.25)' : 'rgba(14, 206, 143, 0.15)',
    primaryBg: isDark ? 'rgba(14, 206, 143, 0.12)' : 'rgba(14, 206, 143, 0.08)',

    // Accent — Cyan
    accent: '#00D4FF',
    accentDark: '#00A6CC',
    accentGlow: isDark ? 'rgba(0, 212, 255, 0.25)' : 'rgba(0, 212, 255, 0.15)',
    accentBg: isDark ? 'rgba(0, 212, 255, 0.12)' : 'rgba(0, 212, 255, 0.08)',

    // Podium/Rankings
    gold: '#FFD700',
    goldBg: 'rgba(255, 215, 0, 0.15)',
    silver: '#E2E8F0',
    silverBg: 'rgba(226, 232, 240, 0.15)',
    bronze: '#CD7F32',
    bronzeBg: 'rgba(205, 127, 50, 0.15)',

    // Glassmorphism
    borderGlass: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(15, 23, 42, 0.05)',
    surfaceGlass: isDark ? 'rgba(22, 27, 34, 0.75)' : 'rgba(255, 255, 255, 0.85)',
    surfaceGlassLight: isDark ? 'rgba(28, 33, 40, 0.55)' : 'rgba(255, 255, 255, 0.55)',

    // Status
    error: '#F85149',
    errorBg: 'rgba(248, 81, 73, 0.18)',
    success: '#3FB950',
    successBg: 'rgba(63, 185, 80, 0.18)',
  };
};

export const COLORS = getThemeColors(true);

export const SHADOWS = {
  primary: {
    shadowColor: '#0ECE8F',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
};

// Avatar helper palette — distinct colors per player
export const AVATAR_PALETTE = [
  '#DC6B02', // orange
  '#6B7280', // gray-silver
  '#D97706', // amber
  '#0891B2', // cyan
  '#7C3AED', // purple
  '#DB2777', // pink
  '#14B8A6', // teal
  '#EF4444', // red
  '#A855F7', // violet
  '#0EA5E9', // sky
];

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return ((parts[0]![0] ?? '') + (parts[parts.length - 1]![0] ?? '')).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xff;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]!;
}

export interface Badge {
  name: string;
  icon: string;
  color: string;
  description: string;
}

// ── Tier system — based on Rating (competitive), not XP ──────────────────────
// Starting rating: 500 (Bronze). Average ±25 per match.
// Bronze → Silver: ~20 net wins | each tier gap: 500 pts
export interface Tier {
  label: string;
  color: string;
  bg: string;
  min: number;
}

export const TIERS: Tier[] = [
  { label: 'BRONZE',   color: '#CD7F32', bg: 'rgba(205,127,50,0.12)',   min: 0    },
  { label: 'SILVER',   color: '#94A3B8', bg: 'rgba(148,163,184,0.12)',  min: 500  },
  { label: 'GOLD',     color: '#FBBF24', bg: 'rgba(251,191,36,0.12)',   min: 1000 },
  { label: 'PLATINUM', color: '#2DD4BF', bg: 'rgba(45,212,191,0.12)',   min: 1500 },
  { label: 'DIAMOND',  color: '#00D4FF', bg: 'rgba(0,212,255,0.12)',    min: 2000 },
  { label: 'MASTER',   color: '#A78BFA', bg: 'rgba(167,139,250,0.12)',  min: 2500 },
];

export function getTier(rating: number): Tier {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (rating >= TIERS[i]!.min) return TIERS[i]!;
  }
  return TIERS[0]!;
}

export function getUserBadges(rating: number, wins: number, losses: number, streak: number): Badge[] {
  const badges: Badge[] = [];

  // Tier badge — from rating
  const tier = getTier(rating);
  const tierIcons: Record<string, string> = {
    BRONZE: 'sparkles', SILVER: 'medal', GOLD: 'medal',
    PLATINUM: 'star', DIAMOND: 'shield', MASTER: 'trophy',
  };
  badges.push({ name: tier.label, icon: tierIcons[tier.label] ?? 'ribbon', color: tier.color, description: `${tier.label} · ${rating} MMR` });

  // Streak badge
  if (streak >= 3) {
    badges.push({ name: 'On Fire', icon: 'flame', color: '#FF4500', description: `${streak}-win streak` });
  }

  // Veteran / Challenger
  if (wins >= 10) {
    badges.push({ name: 'Veteran', icon: 'shield-checkmark', color: '#10B981', description: '10+ wins' });
  } else if (wins >= 1) {
    badges.push({ name: 'Challenger', icon: 'flash', color: '#0ECE8F', description: 'Won first match' });
  }

  return badges;
}
