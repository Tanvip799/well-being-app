import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { generateQuestion, MathQuestion } from './utils/mathGenerator';

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ── DB client — service role, used ONLY for database queries.
// Never call supabase.auth.* on this client; doing so can set a user JWT
// as the session context which makes subsequent DB inserts subject to RLS
// even though the service role key normally bypasses it.
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

// ── Auth client — separate instance, used ONLY for auth operations
// (getUser, signInWithOtp, verifyOtp, refreshSession).
// Auth state contamination here is isolated and cannot affect DB operations.
const authClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

// ─── Simple in-memory rate limiter ────────────────────────────────────────────
const rateLimitWindows = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitWindows.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitWindows.set(key, { count: 1, resetAt: now + windowMs });
    return true; // allowed
  }
  if (entry.count >= maxRequests) return false; // blocked
  entry.count++;
  return true;
}
// Clean up stale entries every 10 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateLimitWindows) { if (now > v.resetAt) rateLimitWindows.delete(k); }
}, 10 * 60 * 1000);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => { res.json({ status: 'ok' }); });

// ─── Auth: Send OTP ────────────────────────────────────────────────────────────
app.post('/auth/send-otp', async (req, res) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? 'unknown';
  if (!rateLimit(`otp-send:${ip}`, 5, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many requests. Please wait before requesting another code.' });
  }

  const { email } = req.body as { email: string };

  if (!email?.trim()) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();
    const { error } = await authClient.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      console.error('Error sending OTP:', error);
      return res.status(400).json({ error: error.message });
    }

    console.log(`✉️ OTP sent to: ${cleanEmail.replace(/(.{2}).+(@.+)/, '$1***$2')}`);
    return res.json({ success: true, message: 'OTP code has been sent to your email.' });
  } catch (err) {
    console.error('Send OTP error:', err);
    return res.status(500).json({ error: 'Server error sending OTP.' });
  }
});

// ─── Auth: Verify OTP ───────────────────────────────────────────────────────────
app.post('/auth/verify-otp', async (req, res) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? 'unknown';
  // Rate limit per IP (10/15min) AND per email address (5/15min) to block brute-force guessing
  if (!rateLimit(`otp-verify:ip:${ip}`, 10, 15 * 60 * 1000) ||
      !rateLimit(`otp-verify:email:${(req.body?.email ?? '').toLowerCase()}`, 5, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many attempts. Please wait before trying again.' });
  }

  const { email, otp } = req.body as { email: string; otp: string };

  if (!email?.trim() || !otp?.trim()) {
    return res.status(400).json({ error: 'Email and OTP code are required.' });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await authClient.auth.verifyOtp({
      email: cleanEmail,
      token: otp.trim(),
      type: 'email',
    });

    if (error || !data.session) {
      console.error('OTP verification error:', error);
      return res.status(401).json({ error: error?.message || 'Invalid or expired OTP code.' });
    }

    const { access_token, user } = data.session;
    const userId = user.id;

    // Check if the user already has a public profile (duelist tag + stats) configured
    const { data: profile } = await supabase
      .from('users')
      .select('id, username, xp, rating, wins, losses, streak, avatar_color')
      .eq('id', userId)
      .maybeSingle();

    const hasConfiguredProfile = !!(profile && profile.username && profile.username.trim().length > 0);
    console.log(`✅ OTP Verified. userId=${userId} hasProfile=${hasConfiguredProfile}`);

    return res.json({
      token: access_token,
      refreshToken: data.session.refresh_token,
      profileExists: hasConfiguredProfile,
      user: hasConfiguredProfile ? profile : null,
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    return res.status(500).json({ error: 'Server error during OTP verification.' });
  }
});

// ─── Auth: Refresh Token ────────────────────────────────────────────────────────
app.post('/auth/refresh', async (req, res) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? 'unknown';
  if (!rateLimit(`refresh:${ip}`, 10, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many requests.' });
  }
  const { refreshToken } = req.body as { refreshToken: string };
  if (!refreshToken) return res.status(400).json({ error: 'No refresh token provided' });

  try {
    const { data, error } = await authClient.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }
    return res.json({
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error during token refresh.' });
  }
});

// ─── Auth: Create Profile ───────────────────────────────────────────────────────
app.post('/auth/create-profile', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const payload = await verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });

  const { username, avatarColor } = req.body as { username: string; avatarColor: string };
  if (!username?.trim() || username.trim().length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters.' });
  }
  if (avatarColor && !/^#[0-9A-Fa-f]{6}(:[^:]{1,10})?$/.test(avatarColor)) {
    return res.status(400).json({ error: 'Invalid avatar color.' });
  }

  try {
    const cleanUsername = username.trim().slice(0, 20);

    // Check if username is already taken
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'Username already taken. Try another.' });
    }

    // Upsert user profile (handles both new profiles and trigger-created empty rows)
    const { data: newProfile, error } = await supabase
      .from('users')
      .upsert({
        id: payload.userId,
        username: cleanUsername,
        avatar_color: avatarColor || '#0ECE8F',
        xp: 0,
        rating: 500,
        wins: 0,
        losses: 0,
        streak: 0,
      })
      .select()
      .single();

    if (error || !newProfile) {
      console.error('Error creating profile:', error);
      return res.status(500).json({ error: 'Failed to create profile.' });
    }

    console.log(`✅ Profile created: ${newProfile.username}`);
    return res.status(201).json({
      user: newProfile,
    });
  } catch (err) {
    console.error('Create profile error:', err);
    return res.status(500).json({ error: 'Server error during profile creation.' });
  }
});

// ─── Auth: Update Profile (username + avatar) ────────────────────────────────
app.put('/auth/update-profile', async (req, res) => {
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const payload = await verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });

  const { username, avatarColor } = req.body as { username?: string; avatarColor?: string };

  const updates: Record<string, unknown> = {};

  if (username !== undefined) {
    const clean = username.trim().slice(0, 20);
    if (clean.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters.' });
    if (!/^[a-zA-Z0-9_]+$/.test(clean)) return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores.' });

    // Check uniqueness — exclude current user
    const { data: existing } = await supabase
      .from('users').select('id').eq('username', clean).neq('id', payload.userId).maybeSingle();
    if (existing) return res.status(409).json({ error: 'Username is already taken. Try another.' });
    updates.username = clean;
  }

  if (avatarColor !== undefined) {
    updates.avatar_color = avatarColor;
  }

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update.' });

  try {
    const { data: updated, error } = await supabase
      .from('users').update(updates).eq('id', payload.userId)
      .select('id, username, xp, rating, wins, losses, streak, avatar_color').maybeSingle();
    if (error || !updated) {
      console.error('[DB] update-profile error:', error?.message);
      return res.status(500).json({ error: 'Failed to update profile.' });
    }
    console.log(`✅ Profile updated: ${updated.username}`);
    return res.json({ user: updated });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// ─── Auth: Check username availability ───────────────────────────────────────
app.get('/auth/check-username', async (req, res) => {
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token' });
  const payload = await verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid token' });

  const name = (req.query.username as string)?.trim().toLowerCase();
  if (!name || name.length < 3) return res.json({ available: false });

  const { data } = await supabase
    .from('users').select('id').eq('username', name).neq('id', payload.userId).maybeSingle();
  return res.json({ available: !data });
});

// ─── JWT Auth Helper ────────────────────────────────────────────────────────────
const _tokenCache = new Map<string, { userId: string; email?: string; expiresAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _tokenCache) if (v.expiresAt <= now) _tokenCache.delete(k);
}, 10 * 60 * 1000).unref();

async function verifyToken(token: string): Promise<{ userId: string; email?: string } | null> {
  const now = Date.now();
  const cached = _tokenCache.get(token);
  if (cached && cached.expiresAt > now) return { userId: cached.userId, email: cached.email };
  try {
    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data.user) return null;
    const result = { userId: data.user.id, email: data.user.email };
    // Evict oldest entry if cache is too large (prevents OOM under token-spray attacks)
    if (_tokenCache.size >= 500) {
      const firstKey = _tokenCache.keys().next().value;
      if (firstKey) _tokenCache.delete(firstKey);
    }
    _tokenCache.set(token, { ...result, expiresAt: now + 5 * 60 * 1000 });
    return result;
  } catch (err: any) {
    console.warn('[verifyToken] Supabase unreachable:', err?.cause?.code ?? err?.message);
    return null;
  }
}

// ─── GET /auth/me — load current user from DB ─────────────────────────────────
app.get('/auth/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const payload = await verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });

  try {
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id, username, xp, rating, wins, losses, streak, avatar_color')
      .eq('id', payload.userId)
      .maybeSingle();

    if (!user) return res.status(404).json({ error: 'User profile not configured' });

    // Compute global rank (based on XP)
    const { count } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gt('xp', user.xp);
    const rank = (count ?? 0) + 1;

    // Retrieve last match XP change (trend)
    const { data: trend } = await supabase
      .from('matches')
      .select('xp_change')
      .eq('user_id', payload.userId)
      .order('played_at', { ascending: false })
      .limit(1);
    const lastXpChange = trend && trend[0] ? (trend[0] as any).xp_change : 0;

    return res.json({
      user: {
        ...user,
        rank,
        lastXpChange
      }
    });
  } catch (err) {
    console.error('Error in /auth/me:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /matches — load match history from DB ────────────────────────────────
app.get('/matches', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const payload = await verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });

  try {
    const { data: matches, error } = await supabase
      .from('matches')
      .select('id, opponent_name, my_score, opp_score, won, xp_change, played_at')
      .eq('user_id', payload.userId)
      .order('played_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return res.json({ matches: matches || [] });
  } catch (err) {
    console.error('Error fetching matches:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /leaderboard — top users ranked by rating ────────────────────────────
app.get('/leaderboard', async (_req, res) => {
  try {
    const { data: leaderboard, error } = await supabase
      .from('users')
      .select('username, xp, rating, wins, losses, streak, avatar_color')
      .order('rating', { ascending: false })
      .limit(20);

    if (error) throw error;
    return res.json({ leaderboard: leaderboard || [] });
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── Persist match result to DB ───────────────────────────────────────────────
async function persistMatchResult(
  userId: string,
  xpGained: number,
  ratingChange: number,
  won: boolean,
  opponentName: string,
  myScore: number,
  oppScore: number
) {
  const { error: insertErr } = await supabase.from('matches').insert({
    user_id: userId,
    opponent_name: opponentName,
    my_score: myScore,
    opp_score: oppScore,
    won,
    xp_change: xpGained,
  });
  if (insertErr) console.error(`[DB] Failed to insert match for ${userId}:`, insertErr.message);
  else console.log(`[DB] Match recorded for ${userId} vs ${opponentName}`);

  try {
    const { error: rpcErr } = await supabase.rpc('update_user_stats', {
      p_user_id: userId,
      p_xp_change: xpGained,
      p_won: won,
      p_rating_change: ratingChange,
    });
    if (rpcErr) console.error(`[DB] Failed to update stats for ${userId}:`, rpcErr.message);
  } catch (err) {
    console.error(`[DB] Stats update exception for ${userId}:`, err);
  }
}

// ─── Socket.io JWT Auth Middleware (Supabase JWT verification) ──────────────────
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;

  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const payload = await verifyToken(token);
    if (payload) {
      socket.data.userId = payload.userId;
      next();
    } else {
      next(new Error('Authentication failed'));
    }
  } catch (err) {
    console.warn(`[socket] Invalid token for ${socket.id}`);
    next(new Error('Authentication failed'));
  }
});

// ─── Game State Types ──────────────────────────────────────────────────────────

export interface XPBreakdown {
  base: number;
  perAnswer: number;
  accuracy: number;
  speed: number;
  streak: number;
  difficulty: number;
  sportsmanship: number;
  daily: number;
  total: number;
}

interface Player {
  id: string;
  userId?: string;
  username: string;
  score: number;           // cumulative point total for this match
  correctAnswers: number;
  totalAnswers: number;
  combo: number;           // current streak
  longestCombo: number;
  fastAnswers: number;     // answers answered in < 2s
  difficultyPoints: number;// sum of difficulty weights for correct answers
  isFirstMatchToday: boolean;
  wantsPlayAgain: boolean;
  readyForVersus: boolean;
  xp?: number;             // current XP (loaded from DB, used for display)
  xpChange?: number;       // XP earned this match
  xpBreakdown?: XPBreakdown;
  rating?: number;         // current competitive rating (loaded from DB)
  ratingChange?: number;   // rating change this match
}

const MATCH_DURATION_MS = 60_000;
const DIFF_WEIGHT: Record<string, number> = { Easy: 0, Medium: 10, Hard: 25, Expert: 50 };

function calcSpeedBonus(elapsedMs: number): number {
  if (elapsedMs < 1000) return 50;
  if (elapsedMs < 2000) return 35;
  if (elapsedMs < 3000) return 20;
  if (elapsedMs < 5000) return 10;
  return 0;
}

function calcComboBonus(combo: number): number {
  if (combo >= 10) return 200;
  if (combo >= 8) return 120;
  if (combo >= 5) return 60;
  if (combo >= 3) return 30;
  return 0;
}

function calcXP(p: Player, won: boolean, isTie: boolean): XPBreakdown {
  const base = won ? 120 : (isTie ? 80 : 60);
  const accuracy = p.totalAnswers > 0 ? p.correctAnswers / p.totalAnswers : 0;
  const accuracyBonus = accuracy >= 1.0 ? 50 : accuracy >= 0.95 ? 35 : accuracy >= 0.90 ? 20 : accuracy >= 0.80 ? 10 : 0;
  const speedBonus = (p.correctAnswers > 0 && p.fastAnswers / p.correctAnswers >= 0.5) ? 20 : 0;
  const streakBonus = p.longestCombo >= 10 ? 60 : p.longestCombo >= 8 ? 40 : p.longestCombo >= 5 ? 20 : 0;
  const sportsmanship = 10;
  const total = base + accuracyBonus + speedBonus + streakBonus + sportsmanship;
  return { base, perAnswer: 0, accuracy: accuracyBonus, speed: speedBonus, streak: streakBonus, difficulty: 0, sportsmanship, daily: 0, total };
}

function calcRatingChange(myRating: number, oppRating: number, won: boolean, isTie: boolean): number {
  if (isTie) return 0;
  const stronger = oppRating > myRating;
  return won ? (stronger ? 35 : 15) : (stronger ? -15 : -35);
}

interface GameRoom {
  id: string;
  players: Player[];
  currentQuestion: MathQuestion | null;
  questionSentAt: number;
  status: 'COUNTDOWN' | 'PLAYING' | 'GAME_OVER';
  winnerId: string | null;
  matchEndTime: number;
  matchTimer?: NodeJS.Timeout;
  countdownInterval?: NodeJS.Timeout;
}

// ─── In-Memory Game State ─────────────────────────────────────────────────────
let waitingQueue: { id: string; username: string; xp: number; rating: number; isFirstMatchToday: boolean; userId?: string }[] = [];
const rooms = new Map<string, GameRoom>();
const playerToRoom = new Map<string, string>();

function cleanupRoom(roomId: string) {
  const room = rooms.get(roomId);
  if (room) {
    if (room.countdownInterval) clearInterval(room.countdownInterval);
    if (room.matchTimer) clearTimeout(room.matchTimer);
    room.players.forEach(p => playerToRoom.delete(p.id));
    rooms.delete(roomId);
    console.log(`Room ${roomId} cleaned up.`);
  }
}

function endMatchByTimer(roomId: string) {
  const room = rooms.get(roomId);
  if (!room || room.status === 'GAME_OVER') return;
  room.status = 'GAME_OVER';
  room.matchTimer = undefined;

  const p1 = room.players[0]!;
  const p2 = room.players[1]!;
  const isTie = p1.score === p2.score;
  const isP1Winner = p1.score > p2.score;
  room.winnerId = isTie ? null : (isP1Winner ? p1.id : p2.id);

  // XP (never decreases)
  const bd1 = calcXP(p1, isP1Winner && !isTie, isTie);
  const bd2 = calcXP(p2, !isP1Winner && !isTie, isTie);
  p1.xpChange = bd1.total;
  p2.xpChange = bd2.total;
  p1.xpBreakdown = bd1;
  p2.xpBreakdown = bd2;

  // Rating (competitive, can go down)
  const r1 = p1.rating ?? 500;
  const r2 = p2.rating ?? 500;
  p1.ratingChange = calcRatingChange(r1, r2, isP1Winner && !isTie, isTie);
  p2.ratingChange = calcRatingChange(r2, r1, !isP1Winner && !isTie, isTie);
  p1.rating = Math.max(0, r1 + p1.ratingChange);
  p2.rating = Math.max(0, r2 + p2.ratingChange);

  if (p1.userId) persistMatchResult(p1.userId, bd1.total, p1.ratingChange, isP1Winner && !isTie, p2.username, p1.score, p2.score);
  if (p2.userId) persistMatchResult(p2.userId, bd2.total, p2.ratingChange, !isP1Winner && !isTie, p1.username, p2.score, p1.score);

  const winnerName = isTie ? 'TIE' : (isP1Winner ? p1.username : p2.username);
  console.log(`Room ${roomId}: Match ended. ${p1.username}:${p1.score} vs ${p2.username}:${p2.score}. Winner: ${winnerName}. XP: +${bd1.total}/+${bd2.total}`);
  io.to(roomId).emit('game_over', { winnerId: room.winnerId, players: room.players, tie: isTie });
}

// ─── Socket Event Handlers ────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id} (userId: ${socket.data.userId ?? 'guest'})`);

  socket.on('join_queue', async ({ username, xp }: { username: string; xp?: number }) => {
    if (!socket.data.userId) {
      socket.emit('auth_required', { message: 'Sign in required to play ranked matches.' });
      console.warn(`[queue] Rejected guest socket ${socket.id} — no userId`);
      return;
    }

    const cleanUsername = username?.trim() || `Player_${socket.id.slice(0, 4)}`;
    let initialXP = xp || 0;
    let initialRating = 500;
    let isFirstMatchToday = false;

    if (socket.data.userId) {
      try {
        const { data: userStats } = await supabase
          .from('users')
          .select('xp, rating, last_played_date')
          .eq('id', socket.data.userId)
          .maybeSingle();
        if (userStats) {
          initialXP = userStats.xp ?? 1000;
          initialRating = userStats.rating ?? 500;
          const today = new Date().toISOString().slice(0, 10);
          isFirstMatchToday = userStats.last_played_date !== today;
        }
      } catch (err) {
        console.error('Error fetching user stats for matchmaking queue:', err);
      }
    }

    // Kick any existing socket for this userId from queue and active rooms
    // Prevents same account playing from two devices simultaneously
    const duplicateInQueue = waitingQueue.find(p => p.userId === socket.data.userId && p.id !== socket.id);
    if (duplicateInQueue) {
      waitingQueue = waitingQueue.filter(p => p.userId !== socket.data.userId);
      const dupSocket = io.sockets.sockets.get(duplicateInQueue.id);
      dupSocket?.emit('auth_required', { message: 'You joined from another device. This session ended.' });
      console.warn(`[queue] Evicted duplicate userId ${socket.data.userId} from queue (old socket: ${duplicateInQueue.id})`);
    }
    const existingRoomId = playerToRoom.get(socket.id);
    if (existingRoomId) cleanupRoom(existingRoomId);

    waitingQueue.push({
      id: socket.id,
      username: cleanUsername,
      xp: initialXP,
      rating: initialRating,
      isFirstMatchToday,
      userId: socket.data.userId,
    });

    console.log(`"${cleanUsername}" joined queue. Queue size: ${waitingQueue.length}`);
    socket.emit('queue_status', { status: 'WAITING' });

    if (waitingQueue.length >= 2) {
      const p1 = waitingQueue.shift()!;
      // Ensure p2 is not the same account as p1 (two-device edge case)
      const p2Idx = waitingQueue.findIndex(p => p.userId !== p1.userId);
      if (p2Idx === -1) {
        waitingQueue.unshift(p1); // put p1 back, no valid opponent yet
        return;
      }
      const p2 = waitingQueue.splice(p2Idx, 1)[0]!;
      const roomId = `room_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      function makePlayer(p: typeof p1): Player {
        return {
          id: p.id, userId: p.userId, username: p.username,
          score: 0, correctAnswers: 0, totalAnswers: 0,
          combo: 0, longestCombo: 0, fastAnswers: 0,
          difficultyPoints: 0, isFirstMatchToday: p.isFirstMatchToday,
          wantsPlayAgain: false, readyForVersus: false,
          xp: p.xp, rating: p.rating,
        };
      }

      const newRoom: GameRoom = {
        id: roomId,
        players: [makePlayer(p1), makePlayer(p2)],
        currentQuestion: null,
        questionSentAt: 0,
        status: 'COUNTDOWN',
        winnerId: null,
        matchEndTime: 0,
      };

      rooms.set(roomId, newRoom);
      playerToRoom.set(p1.id, roomId);
      playerToRoom.set(p2.id, roomId);

      const socket1 = io.sockets.sockets.get(p1.id);
      const socket2 = io.sockets.sockets.get(p2.id);
      if (socket1) socket1.join(roomId);
      if (socket2) socket2.join(roomId);

      console.log(`Match created: room ${roomId} for "${p1.username}" vs "${p2.username}"`);
      io.to(roomId).emit('match_found', { roomId, players: newRoom.players });
    }
  });

  socket.on('versus_ready', () => {
    if (!socket.data.userId) return;
    const roomId = playerToRoom.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      player.readyForVersus = true;
      console.log(`Room ${roomId}: "${player.username}" ready for versus.`);
    }

    const allReady = room.players.every(p => p.readyForVersus);
    if (allReady && room.status === 'COUNTDOWN' && !room.countdownInterval) {
      console.log(`Room ${roomId}: Both ready. Starting countdown...`);
      let countdown = 3;
      io.to(roomId).emit('countdown_tick', { count: countdown });

      room.countdownInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
          io.to(roomId).emit('countdown_tick', { count: countdown });
        } else {
          if (room.countdownInterval) {
            clearInterval(room.countdownInterval);
            room.countdownInterval = undefined;
          }
          room.status = 'PLAYING';
          room.currentQuestion = generateQuestion();
          room.questionSentAt = Date.now();
          room.matchEndTime = Date.now() + MATCH_DURATION_MS;
          room.matchTimer = setTimeout(() => endMatchByTimer(roomId), MATCH_DURATION_MS);
          io.to(roomId).emit('game_state_update', {
            status: 'PLAYING',
            players: room.players,
            questionText: room.currentQuestion.text,
            questionDifficulty: room.currentQuestion.difficulty,
            lastScorer: null,
            matchEndTime: room.matchEndTime,
          });
        }
      }, 1000);
    }
  });

  socket.on('submit_answer', ({ answer }: { answer: number }) => {
    if (!socket.data.userId) return;
    // Rate limit: max 5 submissions/second per socket
    if (!rateLimit(`answer:${socket.id}`, 5, 1000)) return;

    const roomId = playerToRoom.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room || room.status !== 'PLAYING' || !room.currentQuestion) return;

    // Validate answer is a finite integer
    if (!Number.isFinite(answer) || !Number.isInteger(answer)) return;

    const scoringPlayer = room.players.find(p => p.id === socket.id);
    if (!scoringPlayer) return;

    scoringPlayer.totalAnswers++;

    if (answer === room.currentQuestion.answer) {
      const elapsed = Date.now() - room.questionSentAt;
      const speedBonus = calcSpeedBonus(elapsed);
      if (elapsed < 2000) scoringPlayer.fastAnswers++;

      scoringPlayer.combo++;
      if (scoringPlayer.combo > scoringPlayer.longestCombo) scoringPlayer.longestCombo = scoringPlayer.combo;
      const comboBonus = calcComboBonus(scoringPlayer.combo);

      const diffWeight = DIFF_WEIGHT[room.currentQuestion.difficulty] ?? 0;
      scoringPlayer.difficultyPoints += diffWeight;

      const questionScore = 100 + speedBonus + comboBonus;
      scoringPlayer.score += questionScore;
      scoringPlayer.correctAnswers++;

      socket.emit('answer_feedback', {
        correct: true,
        points: questionScore,
        speedBonus,
        comboBonus,
        combo: scoringPlayer.combo,
        difficulty: room.currentQuestion.difficulty,
      });

      console.log(`Room ${roomId}: "${scoringPlayer.username}" +${questionScore}pts (speed+${speedBonus} combo+${comboBonus}). Score: ${room.players.map(p => `${p.username}:${p.score}`).join(' vs ')}`);

      room.currentQuestion = generateQuestion();
      room.questionSentAt = Date.now();
      io.to(roomId).emit('game_state_update', {
        status: 'PLAYING',
        players: room.players,
        questionText: room.currentQuestion.text,
        questionDifficulty: room.currentQuestion.difficulty,
        lastScorer: scoringPlayer.username,
      });
    } else {
      scoringPlayer.combo = 0; // reset streak on wrong
      socket.emit('answer_feedback', { correct: false });
    }
  });

  socket.on('play_again', () => {
    if (!socket.data.userId) return;
    const roomId = playerToRoom.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room || room.status !== 'GAME_OVER') return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    player.wantsPlayAgain = true;

    const allReady = room.players.every(p => p.wantsPlayAgain);
    if (allReady) {
      room.players.forEach(p => {
        p.score = 0; p.correctAnswers = 0; p.totalAnswers = 0;
        p.combo = 0; p.longestCombo = 0; p.fastAnswers = 0;
        p.difficultyPoints = 0; p.isFirstMatchToday = false; // daily bonus only once per day
        p.wantsPlayAgain = false; p.readyForVersus = false;
        p.xpChange = undefined; p.xpBreakdown = undefined;
        p.ratingChange = undefined;
      });
      room.status = 'COUNTDOWN';
      room.winnerId = null;
      room.currentQuestion = null;
      room.questionSentAt = 0;
      room.matchEndTime = 0;
      if (room.matchTimer) { clearTimeout(room.matchTimer); room.matchTimer = undefined; }
      if (room.countdownInterval) {
        clearInterval(room.countdownInterval);
        room.countdownInterval = undefined;
      }
      console.log(`Room ${roomId}: Rematch started.`);
      io.to(roomId).emit('match_restarting');
    } else {
      io.to(roomId).emit('player_ready_status', {
        players: room.players.map(p => ({ id: p.id, wantsPlayAgain: p.wantsPlayAgain })),
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    waitingQueue = waitingQueue.filter(p => p.id !== socket.id);

    const roomId = playerToRoom.get(socket.id);
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        // If game was active, treat as abort — no stats changed, notify remaining player
        if (room.status === 'PLAYING' || room.status === 'COUNTDOWN') {
          socket.to(roomId).emit('opponent_left');
          console.log(`Room ${roomId}: Player ${socket.id} disconnected mid-game — aborting, no stats recorded.`);
        } else {
          io.to(roomId).emit('opponent_left');
        }
        cleanupRoom(roomId);
      }
    }
  });
});

// ─── Startup ───────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
