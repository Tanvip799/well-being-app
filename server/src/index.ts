import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { generateQuestion, MathQuestion } from './utils/mathGenerator';

const app = express();
app.use(cors());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// App health check
app.get('/health', (req, res) => {
  res.send('Server is healthy');
});

// Types for Game State Management
interface Player {
  id: string; // socket.id
  username: string;
  score: number;
  wantsPlayAgain: boolean;
}

interface GameRoom {
  id: string;
  players: Player[];
  currentQuestion: MathQuestion | null;
  status: 'COUNTDOWN' | 'PLAYING' | 'GAME_OVER';
  winnerId: string | null;
  countdownInterval?: NodeJS.Timeout;
}

// In-Memory state
let waitingQueue: { id: string; username: string }[] = [];
const rooms = new Map<string, GameRoom>();
const playerToRoom = new Map<string, string>(); // socket.id -> roomId

// Helper to cleanup a room
function cleanupRoom(roomId: string) {
  const room = rooms.get(roomId);
  if (room) {
    if (room.countdownInterval) {
      clearInterval(room.countdownInterval);
    }
    room.players.forEach(p => {
      playerToRoom.delete(p.id);
    });
    rooms.delete(roomId);
    console.log(`Room ${roomId} cleaned up.`);
  }
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Event: Join Matchmaking Queue
  socket.on('join_queue', ({ username }: { username: string }) => {
    const cleanUsername = username?.trim() || `Player_${socket.id.slice(0, 4)}`;
    
    // Remove if already in queue or room
    waitingQueue = waitingQueue.filter(p => p.id !== socket.id);
    const existingRoomId = playerToRoom.get(socket.id);
    if (existingRoomId) {
      cleanupRoom(existingRoomId);
    }

    // Add to queue
    waitingQueue.push({ id: socket.id, username: cleanUsername });
    console.log(`Player "${cleanUsername}" (${socket.id}) joined queue. Queue size: ${waitingQueue.length}`);
    socket.emit('queue_status', { status: 'WAITING' });

    // Check if match can be created
    if (waitingQueue.length >= 2) {
      const p1 = waitingQueue.shift()!;
      const p2 = waitingQueue.shift()!;

      const roomId = `room_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      const newRoom: GameRoom = {
        id: roomId,
        players: [
          { id: p1.id, username: p1.username, score: 0, wantsPlayAgain: false },
          { id: p2.id, username: p2.username, score: 0, wantsPlayAgain: false }
        ],
        currentQuestion: null,
        status: 'COUNTDOWN',
        winnerId: null
      };

      rooms.set(roomId, newRoom);
      playerToRoom.set(p1.id, roomId);
      playerToRoom.set(p2.id, roomId);

      // Join sockets to room channel
      const socket1 = io.sockets.sockets.get(p1.id);
      const socket2 = io.sockets.sockets.get(p2.id);

      if (socket1) socket1.join(roomId);
      if (socket2) socket2.join(roomId);

      console.log(`Match found! Created room ${roomId} for "${p1.username}" and "${p2.username}"`);

      // Notify clients
      io.to(roomId).emit('match_found', {
        roomId,
        players: newRoom.players
      });

      // Start 3-second Countdown
      let countdown = 3;
      io.to(roomId).emit('countdown_tick', { count: countdown });

      newRoom.countdownInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
          io.to(roomId).emit('countdown_tick', { count: countdown });
        } else {
          // Countdown complete, start game
          if (newRoom.countdownInterval) {
            clearInterval(newRoom.countdownInterval);
          }
          
          newRoom.status = 'PLAYING';
          newRoom.currentQuestion = generateQuestion();
          
          io.to(roomId).emit('game_state_update', {
            status: 'PLAYING',
            players: newRoom.players,
            questionText: newRoom.currentQuestion.text,
            lastScorer: null
          });
        }
      }, 1000);
    }
  });

  // Event: Submit Answer
  socket.on('submit_answer', ({ answer }: { answer: number }) => {
    const roomId = playerToRoom.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room || room.status !== 'PLAYING' || !room.currentQuestion) return;

    // Check if correct
    if (answer === room.currentQuestion.answer) {
      const scoringPlayer = room.players.find(p => p.id === socket.id);
      if (!scoringPlayer) return;

      scoringPlayer.score += 1;
      console.log(`Room ${roomId}: "${scoringPlayer.username}" answered correctly. Score: ${scoringPlayer.score}`);

      // Check win condition (First to 10)
      if (scoringPlayer.score >= 10) {
        room.status = 'GAME_OVER';
        room.winnerId = scoringPlayer.id;
        console.log(`Room ${roomId}: Game Over! Winner: "${scoringPlayer.username}"`);
        
        io.to(roomId).emit('game_over', {
          winnerId: room.winnerId,
          players: room.players
        });
      } else {
        // Generate next question
        room.currentQuestion = generateQuestion();
        
        io.to(roomId).emit('game_state_update', {
          status: 'PLAYING',
          players: room.players,
          questionText: room.currentQuestion.text,
          lastScorer: scoringPlayer.username
        });
      }
    } else {
      // Wrong answer - can send feedback to the individual player who failed
      socket.emit('answer_feedback', { correct: false });
    }
  });

  // Event: Vote to Play Again
  socket.on('play_again', () => {
    const roomId = playerToRoom.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room || room.status !== 'GAME_OVER') return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    player.wantsPlayAgain = true;
    console.log(`Room ${roomId}: "${player.username}" wants to play again.`);

    // Check if both want to play again
    const allReady = room.players.every(p => p.wantsPlayAgain);
    
    if (allReady) {
      // Reset scores and wantsPlayAgain status
      room.players.forEach(p => {
        p.score = 0;
        p.wantsPlayAgain = false;
      });
      room.status = 'COUNTDOWN';
      room.winnerId = null;
      room.currentQuestion = null;

      console.log(`Room ${roomId}: Both players voted to play again. Restarting...`);
      io.to(roomId).emit('match_restarting');

      // Start countdown again
      let countdown = 3;
      io.to(roomId).emit('countdown_tick', { count: countdown });

      room.countdownInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
          io.to(roomId).emit('countdown_tick', { count: countdown });
        } else {
          if (room.countdownInterval) {
            clearInterval(room.countdownInterval);
          }
          
          room.status = 'PLAYING';
          room.currentQuestion = generateQuestion();
          
          io.to(roomId).emit('game_state_update', {
            status: 'PLAYING',
            players: room.players,
            questionText: room.currentQuestion.text,
            lastScorer: null
          });
        }
      }, 1000);
    } else {
      // Broadcast update that player is ready
      io.to(roomId).emit('player_ready_status', {
        players: room.players.map(p => ({ id: p.id, wantsPlayAgain: p.wantsPlayAgain }))
      });
    }
  });

  // Event: Disconnect / Leave
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Remove from queue if waiting
    waitingQueue = waitingQueue.filter(p => p.id !== socket.id);

    // If in room, notify opponent and cleanup
    const roomId = playerToRoom.get(socket.id);
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        // Tell remaining player
        io.to(roomId).emit('opponent_left');
        cleanupRoom(roomId);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
