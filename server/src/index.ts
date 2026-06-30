import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { pool, initDB } from './db';
import { generateQuestion, MathQuestion } from './utils/mathGenerator';

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const JWT_SECRET = process.env.JWT_SECRET!;
const SALT_ROUNDS = 10;

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => { res.json({ status: 'ok' }); });

// ─── Auth: Register ────────────────────────────────────────────────────────────
app.post('/auth/register', async (req, res) => {
  const { username, password } = req.body as { username: string; password: string };

  if (!username?.trim() || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  if (username.trim().length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  try {
    const clean = username.trim().slice(0, 20);
    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [clean]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username already taken. Try another.' });
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, xp, wins, losses)
       VALUES ($1, $2, 1000, 0, 0) RETURNING *`,
      [clean, hash]
    );
    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

    console.log(`✅ Registered: ${user.username}`);
    return res.status(201).json({
      token,
      user: { id: user.id, username: user.username, xp: user.xp, wins: user.wins }
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Server error during registration.' });
  }
});

// ─── Auth: Login ───────────────────────────────────────────────────────────────
app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body as { username: string; password: string };

  if (!username?.trim() || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username.trim()]);
    const user = result.rows[0];

    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    console.log(`✅ Login: ${user.username}`);

    return res.json({
      token,
      user: { id: user.id, username: user.username, xp: user.xp, wins: user.wins }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error during login.' });
  }
});

// ─── JWT Auth Helper ──────────────────────────────────────────────────────────
function verifyToken(token: string): { userId: number } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: number };
  } catch {
    return null;
  }
}

// ─── GET /auth/me — load current user from DB ─────────────────────────────────
app.get('/auth/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });

  try {
    const result = await pool.query(
      'SELECT id, username, xp, wins, losses FROM users WHERE id = $1',
      [payload.userId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /matches — load match history from DB ────────────────────────────────
app.get('/matches', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });

  try {
    const result = await pool.query(
      `SELECT id, opponent_name, my_score, opp_score, won, xp_change, played_at
       FROM matches WHERE user_id = $1
       ORDER BY played_at DESC LIMIT 50`,
      [payload.userId]
    );
    return res.json({ matches: result.rows });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /leaderboard — top users ranked by XP ────────────────────────────────
app.get('/leaderboard', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, xp, wins, losses
       FROM users
       ORDER BY xp DESC
       LIMIT 20`
    );
    return res.json({ leaderboard: result.rows });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── Persist match result to DB ───────────────────────────────────────────────
async function persistMatchResult(
  userId: number,
  xpChange: number,
  won: boolean,
  opponentName: string,
  myScore: number,
  oppScore: number
) {
  try {
    // Update user stats
    if (won) {
      await pool.query(
        `UPDATE users SET xp = GREATEST(100, xp + $1), wins = wins + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [xpChange, userId]
      );
    } else {
      await pool.query(
        `UPDATE users SET xp = GREATEST(100, xp + $1), losses = losses + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [xpChange, userId]
      );
    }
    // Save match history row
    await pool.query(
      `INSERT INTO matches (user_id, opponent_name, my_score, opp_score, won, xp_change)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, opponentName, myScore, oppScore, won, xpChange]
    );
  } catch (err) {
    console.error(`Failed to persist match for userId ${userId}:`, err);
  }
}

// ─── Socket.io JWT Auth Middleware ────────────────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;

  if (!token) {
    // Allow unauthenticated connections for now (for dev/testing without auth)
    console.warn(`[socket] No token for ${socket.id} — allowing as guest`);
    return next();
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number; googleId: string };
    socket.data.userId = payload.userId;
    socket.data.googleId = payload.googleId;
    next();
  } catch (err) {
    console.warn(`[socket] Invalid token for ${socket.id}`);
    next(new Error('Authentication failed'));
  }
});

// ─── Game State Types ──────────────────────────────────────────────────────────
interface Player {
  id: string;       // socket.id
  userId?: number;  // postgres users.id
  username: string;
  score: number;
  wantsPlayAgain: boolean;
  readyForVersus: boolean;
  xp?: number;
  xpChange?: number;
}

interface GameRoom {
  id: string;
  players: Player[];
  currentQuestion: MathQuestion | null;
  status: 'COUNTDOWN' | 'PLAYING' | 'GAME_OVER';
  winnerId: string | null;
  countdownInterval?: NodeJS.Timeout;
}

// ─── In-Memory Game State ─────────────────────────────────────────────────────
let waitingQueue: { id: string; username: string; xp: number; userId?: number }[] = [];
const rooms = new Map<string, GameRoom>();
const playerToRoom = new Map<string, string>();

function cleanupRoom(roomId: string) {
  const room = rooms.get(roomId);
  if (room) {
    if (room.countdownInterval) clearInterval(room.countdownInterval);
    room.players.forEach(p => playerToRoom.delete(p.id));
    rooms.delete(roomId);
    console.log(`Room ${roomId} cleaned up.`);
  }
}

// ─── Socket Event Handlers ────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id} (userId: ${socket.data.userId ?? 'guest'})`);

  socket.on('join_queue', ({ username, xp }: { username: string; xp?: number }) => {
    const cleanUsername = username?.trim() || `Player_${socket.id.slice(0, 4)}`;
    const initialXP = xp || 1000;

    waitingQueue = waitingQueue.filter(p => p.id !== socket.id);
    const existingRoomId = playerToRoom.get(socket.id);
    if (existingRoomId) cleanupRoom(existingRoomId);

    waitingQueue.push({
      id: socket.id,
      username: cleanUsername,
      xp: initialXP,
      userId: socket.data.userId,
    });

    console.log(`"${cleanUsername}" joined queue. Queue size: ${waitingQueue.length}`);
    socket.emit('queue_status', { status: 'WAITING' });

    if (waitingQueue.length >= 2) {
      const p1 = waitingQueue.shift()!;
      const p2 = waitingQueue.shift()!;
      const roomId = `room_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      const newRoom: GameRoom = {
        id: roomId,
        players: [
          { id: p1.id, userId: p1.userId, username: p1.username, xp: p1.xp, score: 0, wantsPlayAgain: false, readyForVersus: false },
          { id: p2.id, userId: p2.userId, username: p2.username, xp: p2.xp, score: 0, wantsPlayAgain: false, readyForVersus: false },
        ],
        currentQuestion: null,
        status: 'COUNTDOWN',
        winnerId: null,
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
          io.to(roomId).emit('game_state_update', {
            status: 'PLAYING',
            players: room.players,
            questionText: room.currentQuestion.text,
            lastScorer: null,
          });
        }
      }, 1000);
    }
  });

  socket.on('submit_answer', ({ answer }: { answer: number }) => {
    const roomId = playerToRoom.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room || room.status !== 'PLAYING' || !room.currentQuestion) return;

    if (answer === room.currentQuestion.answer) {
      const scoringPlayer = room.players.find(p => p.id === socket.id);
      if (!scoringPlayer) return;

      scoringPlayer.score += 1;
      console.log(`Room ${roomId}: "${scoringPlayer.username}" scored. Total: ${scoringPlayer.score}`);

      if (scoringPlayer.score >= 10) {
        room.status = 'GAME_OVER';
        room.winnerId = scoringPlayer.id;

        // Elo Rating Calculation
        const p1 = room.players[0]!;
        const p2 = room.players[1]!;
        const isP1Winner = room.winnerId === p1.id;
        const r1 = p1.xp || 1000;
        const r2 = p2.xp || 1000;

        const exp1 = 1 / (1 + Math.pow(10, (r2 - r1) / 400));
        const exp2 = 1 / (1 + Math.pow(10, (r1 - r2) / 400));
        const K = 32;

        p1.xpChange = Math.round(K * ((isP1Winner ? 1 : 0) - exp1));
        p2.xpChange = Math.round(K * ((isP1Winner ? 0 : 1) - exp2));
        p1.xp = Math.max(100, r1 + p1.xpChange);
        p2.xp = Math.max(100, r2 + p2.xpChange);

        // Persist to PostgreSQL (with opponent info for match history)
        if (p1.userId) persistMatchResult(
          p1.userId, p1.xpChange, isP1Winner,
          p2.username, p1.score, p2.score
        );
        if (p2.userId) persistMatchResult(
          p2.userId, p2.xpChange!, !isP1Winner,
          p1.username, p2.score, p1.score
        );

        console.log(`Room ${roomId}: Game over. Winner: "${scoringPlayer.username}"`);
        io.to(roomId).emit('game_over', { winnerId: room.winnerId, players: room.players });

      } else {
        room.currentQuestion = generateQuestion();
        io.to(roomId).emit('game_state_update', {
          status: 'PLAYING',
          players: room.players,
          questionText: room.currentQuestion.text,
          lastScorer: scoringPlayer.username,
        });
      }
    } else {
      socket.emit('answer_feedback', { correct: false });
    }
  });

  socket.on('play_again', () => {
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
        p.score = 0;
        p.wantsPlayAgain = false;
        p.readyForVersus = false;
      });
      room.status = 'COUNTDOWN';
      room.winnerId = null;
      room.currentQuestion = null;
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
        io.to(roomId).emit('opponent_left');
        cleanupRoom(roomId);
      }
    }
  });
});

// ─── Startup ───────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 3000;

initDB()
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to initialize DB — server not started:', err);
    process.exit(1);
  });
