// Math Duel — Emerald & Cyan Design System
export const COLORS = {
  // Backgrounds
  background: '#0D1117',
  surface: '#161B22',
  surfaceCard: '#1C2128',
  surfaceMedium: '#21262D',

  // Borders
  border: '#30363D',
  borderSubtle: '#21262D',
  surfaceLight: '#1C2128',

  // Text
  text: '#FFFFFF',
  textSecondary: '#8B949E',
  textMuted: '#484F58',

  // Primary — Emerald
  primary: '#0ECE8F',
  primaryDark: '#0AAF79',
  primaryGlow: 'rgba(14, 206, 143, 0.2)',
  primaryBg: 'rgba(14, 206, 143, 0.12)',

  // Status
  error: '#F85149',
  errorBg: 'rgba(248, 81, 73, 0.18)',
  success: '#3FB950',
  successBg: 'rgba(63, 185, 80, 0.18)',
};

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
