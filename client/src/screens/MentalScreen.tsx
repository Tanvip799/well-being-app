import React, { useState, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { io, Socket } from 'socket.io-client';
import { COLORS, getInitials, getAvatarColor } from '../theme';

// ── Rounded-square avatar (Match Found / Versus) ────────────────────────────
function AvatarSquare({ name, isMe, color, size = 72 }: { name: string; isMe?: boolean; color?: string; size?: number }) {
  const bg = isMe ? COLORS.primary : (color ?? getAvatarColor(name));
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.26, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.33, fontWeight: '700', color: '#FFF', letterSpacing: 0.5 }}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────
interface MentalScreenProps {
  username: string;
  serverUrl: string;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  onScreenStateChange: (s: string) => void;
  onGameFinished: (r: { won: boolean; opponentName: string; myScore: number; oppScore: number }) => void;
  navigateTo: (tab: 'home' | 'leaderboard' | 'history' | 'profile') => void;
  wins: number;
  xp: number;
  streak: number;
}

interface SocketPlayer { id: string; username: string; score: number; wantsPlayAgain: boolean; }
type ScreenState = 'LOBBY' | 'CONNECTING' | 'SEARCHING' | 'VERSUS' | 'PLAYING' | 'GAME_OVER';

// ════════════════════════════════════════════════════════════════════════════════
export default function MentalScreen({ username, serverUrl, soundEnabled, vibrationEnabled, onScreenStateChange, onGameFinished, navigateTo, wins, xp, streak }: MentalScreenProps) {
  const [screenState, setScreenState] = useState<ScreenState>('LOBBY');
  const [socket, setSocket]           = useState<Socket | null>(null);
  const [players, setPlayers]         = useState<SocketPlayer[]>([]);
  const [questionText, setQuestionText] = useState('');
  const [lastScorer, setLastScorer]   = useState<string | null>(null);
  const [countdown, setCountdown]     = useState<number | null>(null);
  const [winnerId, setWinnerId]       = useState<string | null>(null);
  const [opponentLeft, setOpponentLeft] = useState(false);
  const [answerInput, setAnswerInput] = useState('');
  const [wrongFlash, setWrongFlash]   = useState(false);
  const [questionTimer, setQuestionTimer] = useState(60);
  const [questionCount, setQuestionCount] = useState(0);

  const searchTimerRef = useRef<any>(null);
  const qTimerRef      = useRef<any>(null);
  const pendingUpdate  = useRef<any>(null);
  const firstUpdate    = useRef(true);
  const spinAnim       = useRef(new Animated.Value(0)).current;
  const cdScale        = useRef(new Animated.Value(1)).current;

  const myPlayer  = players.find(p => p.id === socket?.id);
  const oppPlayer = players.find(p => p.id !== socket?.id);

  useEffect(() => { onScreenStateChange(screenState); }, [screenState]);

  useEffect(() => {
    if (screenState === 'SEARCHING') {
      Animated.loop(Animated.timing(spinAnim, { toValue: 1, duration: 2500, easing: Easing.linear, useNativeDriver: true })).start();
    } else { spinAnim.setValue(0); }
  }, [screenState]);

  const startQTimer = () => {
    if (qTimerRef.current) clearInterval(qTimerRef.current);
    setQuestionTimer(60);
    qTimerRef.current = setInterval(() => setQuestionTimer(p => { if (p <= 1) { clearInterval(qTimerRef.current); return 0; } return p - 1; }), 1000);
  };
  const stopQTimer = () => { if (qTimerRef.current) { clearInterval(qTimerRef.current); qTimerRef.current = null; } };

  const startMatchmaking = () => {
    setScreenState('CONNECTING');
    const sock = io(serverUrl, { transports: ['websocket'], forceNew: true, timeout: 6000 });

    sock.on('connect', () => {
      setSocket(sock);
      setScreenState('SEARCHING');
      sock.emit('join_queue', { username });
    });

    sock.on('connect_error', () => {
      sock.disconnect(); setSocket(null); setScreenState('LOBBY');
      Alert.alert('Connection Failed', `Cannot reach server at:\n${serverUrl}`);
    });

    sock.on('match_found', (data: { roomId: string; players: SocketPlayer[] }) => {
      if (searchTimerRef.current) clearInterval(searchTimerRef.current);
      firstUpdate.current = true;
      setPlayers(data.players); setOpponentLeft(false);
      setCountdown(3); setScreenState('VERSUS'); setWinnerId(null); setQuestionCount(0);
    });

    sock.on('countdown_tick', (data: { count: number }) => {
      setCountdown(data.count);
      cdScale.setValue(0.65);
      Animated.spring(cdScale, { toValue: 1, friction: 3, tension: 130, useNativeDriver: true }).start();
    });

    sock.on('game_state_update', (data: { status: string; players: SocketPlayer[]; questionText: string; lastScorer: string | null }) => {
      if (firstUpdate.current) {
        firstUpdate.current = false;
        pendingUpdate.current = data;
        setCountdown(0);
        setTimeout(() => {
          const p = pendingUpdate.current;
          if (p) {
            setPlayers(p.players); setQuestionText(p.questionText); setLastScorer(p.lastScorer);
            setAnswerInput(''); setWrongFlash(false); setQuestionCount(1);
            setScreenState('PLAYING'); startQTimer(); pendingUpdate.current = null;
          }
        }, 700);
      } else {
        setPlayers(data.players); setQuestionText(data.questionText); setLastScorer(data.lastScorer);
        setAnswerInput(''); setWrongFlash(false); setQuestionCount(n => n + 1); startQTimer();
      }
    });

    sock.on('answer_feedback', (data: { correct: boolean }) => {
      if (!data.correct) {
        setWrongFlash(true);
        if (vibrationEnabled) Vibration.vibrate([0, 80, 50, 80]);
        setTimeout(() => setWrongFlash(false), 400);
      }
    });

    sock.on('game_over', (data: { winnerId: string; players: SocketPlayer[] }) => {
      stopQTimer(); setPlayers(data.players); setWinnerId(data.winnerId); setScreenState('GAME_OVER');
      const opp = data.players.find(p => p.id !== sock.id);
      const isWin = data.winnerId === sock.id;
      onGameFinished({ won: isWin, opponentName: opp?.username ?? 'Opponent', myScore: data.players.find(p => p.id === sock.id)?.score ?? 0, oppScore: opp?.score ?? 0 });
      if (vibrationEnabled) { if (isWin) Vibration.vibrate([0, 100, 80, 200, 80, 300]); else Vibration.vibrate(450); }
    });

    sock.on('opponent_left', () => { stopQTimer(); setOpponentLeft(true); setScreenState('GAME_OVER'); });

    sock.on('player_ready_status', (data: { players: { id: string; wantsPlayAgain: boolean }[] }) => {
      setPlayers(prev => prev.map(p => { const m = data.players.find(x => x.id === p.id); return m ? { ...p, wantsPlayAgain: m.wantsPlayAgain } : p; }));
    });

    sock.on('match_restarting', () => {
      firstUpdate.current = true; setCountdown(3); setScreenState('VERSUS');
      setWinnerId(null); setOpponentLeft(false); setQuestionCount(0);
    });
  };

  const leave = () => {
    if (searchTimerRef.current) clearInterval(searchTimerRef.current);
    stopQTimer(); socket?.disconnect(); setSocket(null);
    setScreenState('LOBBY'); setPlayers([]); setAnswerInput('');
    setCountdown(null); setWinnerId(null); setOpponentLeft(false); setQuestionCount(0);
    firstUpdate.current = true; pendingUpdate.current = null;
  };

  const pressKey = (k: string) => {
    if (vibrationEnabled) Vibration.vibrate(18);
    if (k === '⌫') setAnswerInput(p => p.slice(0, -1));
    else if (answerInput.length < 7) setAnswerInput(p => p + k);
  };

  const submit = () => {
    const n = parseInt(answerInput.trim(), 10);
    if (isNaN(n)) return;
    socket?.emit('submit_answer', { answer: n });
    setAnswerInput('');
  };

  const oppName  = oppPlayer?.username ?? 'Opponent';
  const oppColor = getAvatarColor(oppName);

  // ════════════════════════════════════════════════════════════════════════════
  // SCREEN 02 — LOBBY / HOME
  // ════════════════════════════════════════════════════════════════════════════
  if (screenState === 'LOBBY') {
    return (
      <View style={s.lobbyRoot}>
        <View style={s.lobbyGlow} />

        {/* ── Header ── */}
        <View style={s.lobbyHeader}>
          <View>
            <Text style={s.welcomeSmall}>Welcome back</Text>
            <Text style={s.welcomeName}>{username}</Text>
          </View>
          <View style={s.meAvatar}>
            <Text style={s.meAvatarText}>{getInitials(username)}</Text>
          </View>
        </View>

        {/* ── Center: Logo + Title + Rating ── */}
        <View style={s.lobbyCenterContent}>
          <LinearGradient colors={['#0ECE8F', '#11D4A8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.logoBox}>
            <Text style={s.logoSymbol}>÷</Text>
          </LinearGradient>
          <Text style={s.appTitle}>
            <Text style={{ color: COLORS.text }}>Math </Text>
            <Text style={{ color: COLORS.primary }}>Duel</Text>
          </Text>
          <View style={s.ratingRow}>
            <View style={s.ratingDot} />
            <Text style={s.ratingText}>Rating {xp.toLocaleString()} · #128 Global</Text>
          </View>
        </View>

        {/* ── Bottom: Play Now + Nav ── */}
        <View style={s.lobbyBottom}>
          <TouchableOpacity onPress={startMatchmaking} activeOpacity={0.84} style={s.playNowWrapper}>
            <LinearGradient colors={['#0ECE8F', '#11D4A8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.playNowBtn}>
              <Ionicons name="play" size={20} color="#0B1A14" style={{ marginRight: 10 }} />
              <Text style={s.playNowText}>Play Now</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={s.bottomNavRow}>
            {([
              { icon: 'bar-chart', label: 'Leaderboard', tab: 'leaderboard' },
              { icon: 'time',      label: 'History',     tab: 'history'     },
              { icon: 'settings',  label: 'Settings',    tab: 'profile'     },
            ] as const).map(item => (
              <TouchableOpacity key={item.tab} style={s.bottomNavItem} onPress={() => navigateTo(item.tab)} activeOpacity={0.7}>
                <Ionicons name={item.icon as any} size={22} color={COLORS.textSecondary} />
                <Text style={s.bottomNavLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CONNECTING
  // ════════════════════════════════════════════════════════════════════════════
  if (screenState === 'CONNECTING') {
    return (
      <View style={s.fullCentered}>
        <LinearGradient colors={['#0ECE8F', '#11D4A8']} style={s.connectLogo}>
          <Text style={[s.logoSymbol, { fontSize: 30 }]}>÷</Text>
        </LinearGradient>
        <Text style={s.connectTitle}>Connecting...</Text>
        <Text style={s.connectSub}>Establishing a fast connection</Text>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SCREEN 03 — SEARCHING
  // ════════════════════════════════════════════════════════════════════════════
  if (screenState === 'SEARCHING') {
    const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
    return (
      <View style={s.searchRoot}>
        {/* Center content: radar + text */}
        <View style={s.searchCenter}>
          {/* Ambient dots */}
          <View style={[s.ambientDot, { top: -60, left: -30 }]} />
          <View style={[s.ambientDot, { top: -40, right: -20, width: 5, height: 5, borderRadius: 2.5 }]} />

          {/* Radar */}
          <View style={s.radarOuter}>
            <Animated.View style={[s.radarArc, { transform: [{ rotate: spin }] }]} />
            <View style={s.radarCenter}>
              <View style={s.radarDot} />
            </View>
          </View>

          <Text style={s.searchTitle}>Searching for an{'\n'}opponent...</Text>
          <Text style={s.searchSub}>Matching you with a player near your rating</Text>

          <View style={s.waitPill}>
            <Text style={s.waitPillText}>Estimated wait  ~ 12s</Text>
          </View>
        </View>

        {/* Cancel pinned to bottom */}
        <View style={s.searchBottom}>
          <TouchableOpacity style={s.cancelBtn} onPress={leave} activeOpacity={0.8}>
            <Text style={s.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SCREEN 04 — MATCH FOUND / VERSUS
  // ════════════════════════════════════════════════════════════════════════════
  if (screenState === 'VERSUS') {
    const cdSteps: (number | string)[] = [3, 2, 1, 'GO!'];
    const isActive = (step: number | string) => step === 'GO!' ? countdown === 0 : countdown === step;

    return (
      <View style={s.versusRoot}>
        {/* Top: label + players */}
        <View style={s.versusTopSection}>
          <Text style={s.matchFoundLabel}>MATCH FOUND</Text>

          <View style={s.versusRow}>
            <View style={s.versusPlayerCol}>
              <AvatarSquare name={username} isMe size={72} />
              <Text style={s.versusPlayerName}>You</Text>
              <Text style={s.versusPlayerRating}>{xp.toLocaleString()}</Text>
            </View>
            <View style={s.vsBubble}>
              <Text style={s.vsText}>VS</Text>
            </View>
            <View style={s.versusPlayerCol}>
              <AvatarSquare name={oppName} color={oppColor} size={72} />
              <Text style={s.versusPlayerName}>
                {(() => { const parts = oppName.split(' '); return parts.length > 1 ? `${parts[0]} ${parts[1]?.[0]}.` : parts[0]; })()}
              </Text>
              <Text style={s.versusPlayerRating}>1,438</Text>
            </View>
          </View>
        </View>

        {/* Center: big countdown */}
        <View style={s.versusCenterSection}>
          <Animated.Text style={[s.bigCountdown, { transform: [{ scale: cdScale }] }]}>
            {countdown === 0 ? 'GO!' : countdown}
          </Animated.Text>
          <Text style={s.getReadyText}>Get ready...</Text>
        </View>

        {/* Bottom: step indicators */}
        <View style={s.versusBottomSection}>
          <View style={s.cdStepsRow}>
            {cdSteps.map((step, i) => (
              <Text key={i} style={[s.cdStep, isActive(step) && s.cdStepActive]}>{step}</Text>
            ))}
          </View>
        </View>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SCREEN 05 — PLAYING
  // ════════════════════════════════════════════════════════════════════════════
  if (screenState === 'PLAYING') {
    const myScore  = myPlayer?.score ?? 0;
    const oppScore = oppPlayer?.score ?? 0;
    const oppLabel = (oppName.split(' ')[0] ?? 'OPP').toUpperCase().slice(0, 5);
    const timerPct = (questionTimer / 60) * 100;
    const timerLabel = `${Math.floor(questionTimer / 60)}:${String(questionTimer % 60).padStart(2, '0')}`;

    const NUMKEYS = [['1','2','3'],['4','5','6'],['7','8','9']];

    return (
      <View style={s.gameRoot}>

        {/* ── Fixed upper section: score cards + timer ── */}
        <View style={s.gameTopSection}>
          {/* Score cards row */}
          <View style={s.topCardsRow}>
            <View style={s.scoreCard}>
              <Text style={[s.cardLabel, { color: COLORS.primary }]}>YOU</Text>
              <Text style={[s.cardNum, { color: COLORS.primary }]}>{myScore}</Text>
            </View>
            <View style={[s.scoreCard, { alignItems: 'center' }]}>
              <Text style={s.cardLabel}>ROUND</Text>
              <Text style={[s.cardNum, { color: COLORS.text, fontSize: 22 }]}>{questionCount}/7</Text>
            </View>
            <View style={[s.scoreCard, { alignItems: 'flex-end' }]}>
              <Text style={s.cardLabel}>{oppLabel}</Text>
              <Text style={[s.cardNum, { color: COLORS.textSecondary }]}>{oppScore}</Text>
            </View>
          </View>

          {/* Timer bar */}
          <View style={s.timerRow}>
            <View style={s.timerTrack}>
              <View style={[s.timerFill, { width: `${timerPct}%` as any }]} />
            </View>
            <Text style={[s.timerLabel, questionTimer <= 10 && { color: '#F85149' }]}>{timerLabel}</Text>
          </View>
        </View>

        {/* ── Question card ── */}
        <View style={s.questionCard}>
          <Text style={s.solveItLabel}>SOLVE IT</Text>
          <Text style={s.equationText} numberOfLines={1} adjustsFontSizeToFit>
            {questionText} = ?
          </Text>
        </View>

        {/* ── Answer field ── */}
        <View style={[s.answerField, wrongFlash && s.answerFieldWrong]}>
          <Text style={[s.answerNum, wrongFlash && { color: '#F85149' }]}>
            {answerInput}
            {answerInput.length > 0 && <Text style={{ color: COLORS.primary }}>|</Text>}
          </Text>
          {answerInput.length === 0 && <Text style={s.answerHint}>Your answer</Text>}
        </View>

        {/* ── Keypad — flex:1 fills ALL remaining space ── */}
        <View style={s.keypadSection}>
          {/* Number rows — each row flex:1 */}
          {NUMKEYS.map((row, ri) => (
            <View key={ri} style={s.keyRow}>
              {row.map(k => (
                <TouchableOpacity key={k} style={s.key} onPress={() => pressKey(k)} activeOpacity={0.6}>
                  <Text style={s.keyText}>{k}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}

          {/* Last row: ⌫  0  ✓ */}
          <View style={s.keyRow}>
            <TouchableOpacity style={s.key} onPress={() => pressKey('⌫')} activeOpacity={0.6}>
              <Ionicons name="backspace-outline" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={s.key} onPress={() => pressKey('0')} activeOpacity={0.6}>
              <Text style={s.keyText}>0</Text>
            </TouchableOpacity>
            {/* ✓ emerald key */}
            <TouchableOpacity
              style={[s.key, { padding: 0, overflow: 'hidden', borderWidth: 0, borderRadius: 16 }]}
              onPress={submit}
              disabled={!answerInput}
              activeOpacity={0.75}
            >
              <LinearGradient
                colors={answerInput ? ['#0ECE8F', '#11D4A8'] : ['#1C2128', '#1C2128']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="checkmark" size={30} color={answerInput ? '#0B1A14' : COLORS.textMuted} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SCREEN 06 — GAME OVER / WINNER
  // ════════════════════════════════════════════════════════════════════════════
  if (screenState === 'GAME_OVER') {
    const isWin      = winnerId === socket?.id;
    const myScore    = myPlayer?.score ?? 0;
    const oppScore   = oppPlayer?.score ?? 0;
    const oppShort   = (oppName.split(' ')[0] ?? 'OPP').toUpperCase();
    const totalRounds = myScore + oppScore;

    return (
      <View style={s.gameOverRoot}>
        <View style={s.gameOverGlow} />

        {/* Trophy ring + confetti */}
        <View style={s.trophyWrapper}>
          <View style={[s.confettiPiece, { top: 4,  left: 28, backgroundColor: '#0ECE8F', transform: [{ rotate: '25deg' }] }]} />
          <View style={[s.confettiPiece, { top: 0,  right: 32, backgroundColor: '#EC4899', width: 6, height: 16, transform: [{ rotate: '-30deg' }] }]} />
          <View style={[s.confettiPiece, { top: 22, right: 10, backgroundColor: '#0ECE8F', width: 5, height: 12, transform: [{ rotate: '10deg' }] }]} />
          <View style={[s.confettiPiece, { bottom: 8,  left: 16, backgroundColor: '#F59E0B', transform: [{ rotate: '40deg' }] }]} />
          <View style={[s.confettiPiece, { bottom: 4,  right: 20, backgroundColor: '#8B5CF6', width: 5, height: 14, transform: [{ rotate: '-50deg' }] }]} />
          <View style={[s.confettiPiece, { top: 44, left: 6, backgroundColor: '#F0F0F0', width: 4, height: 10, transform: [{ rotate: '60deg' }] }]} />

          <View style={[s.trophyRing, { shadowColor: COLORS.primary, shadowOpacity: isWin ? 0.85 : 0.15, shadowRadius: 30, shadowOffset: { width: 0, height: 0 }, elevation: isWin ? 20 : 4 }]}>
            <View style={s.trophyInner}>
              <Ionicons name={isWin ? 'star' : 'sad-outline'} size={46} color={isWin ? COLORS.primary : COLORS.textMuted} />
            </View>
          </View>
        </View>

        {/* Result */}
        {opponentLeft ? (
          <><Text style={[s.winTitle, { color: COLORS.primary }]}>ABORTED</Text><Text style={s.winSub}>Opponent disconnected</Text></>
        ) : (
          <>
            <Text style={[s.winTitle, { color: isWin ? COLORS.primary : '#F85149' }]}>{isWin ? 'You Win!' : 'You Lose'}</Text>
            <Text style={s.winSub}>{isWin ? `You beat ${oppName.split(' ')[0]} in ${totalRounds} rounds` : `${oppName.split(' ')[0]} beat you this time`}</Text>
          </>
        )}

        {/* Score card */}
        <View style={s.finalCard}>
          <View style={s.finalScoreRow}>
            <View style={s.finalPlayerCol}>
              <Text style={s.finalLabel}>YOU</Text>
              <Text style={[s.finalNum, { color: isWin ? COLORS.primary : COLORS.text }]}>{myScore}</Text>
            </View>
            <Text style={s.finalDash}>—</Text>
            <View style={s.finalPlayerCol}>
              <Text style={s.finalLabel}>{oppShort}</Text>
              <Text style={[s.finalNum, { color: !isWin ? COLORS.primary : COLORS.text }]}>{oppScore}</Text>
            </View>
          </View>
        </View>

        {/* Rating pill */}
        {!opponentLeft && (
          <View style={[s.ratingPill, { backgroundColor: isWin ? 'rgba(14,206,143,0.12)' : 'rgba(248,81,73,0.12)' }]}>
            <Text style={[s.ratingPillText, { color: isWin ? COLORS.primary : '#F85149' }]}>
              {isWin ? `▲ +18 rating · now ${(xp + 18).toLocaleString()}` : `▼ -12 rating · now ${(xp - 12).toLocaleString()}`}
            </Text>
          </View>
        )}

        {/* Play Again */}
        {!opponentLeft && (
          <TouchableOpacity onPress={() => socket?.emit('play_again')} disabled={!!myPlayer?.wantsPlayAgain} activeOpacity={0.84} style={s.playAgainWrapper}>
            <LinearGradient
              colors={myPlayer?.wantsPlayAgain ? ['#1C2128', '#1C2128'] : ['#0ECE8F', '#11D4A8']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.playAgainBtn}
            >
              <Text style={[s.playAgainText, myPlayer?.wantsPlayAgain && { color: COLORS.textSecondary }]}>
                {myPlayer?.wantsPlayAgain ? 'Waiting for opponent...' : 'Play Again'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={s.homeBtn} onPress={leave} activeOpacity={0.75}>
          <Text style={s.homeBtnText}>Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}

// ════════════════════════════════════════════════════════════════════════════════
// STYLES
// ════════════════════════════════════════════════════════════════════════════════
const s = StyleSheet.create({

  // ── LOBBY ─────────────────────────────────────────────────────────────────
  lobbyRoot: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    paddingHorizontal: 24,
  },
  lobbyGlow: {
    position: 'absolute',
    bottom: 0, left: '15%', right: '15%', height: 280,
    backgroundColor: COLORS.primary, opacity: 0.05, borderRadius: 140,
  },
  lobbyHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 0,
  },
  welcomeSmall: { fontSize: 13, color: COLORS.textSecondary },
  welcomeName:  { fontSize: 22, color: COLORS.text, fontWeight: '700', marginTop: 2 },
  meAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
  meAvatarText: { fontSize: 15, fontWeight: '700', color: '#0B1A14' },

  // Center content: logo + title + rating
  lobbyCenterContent: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 0,
  },
  logoBox: {
    width: 80, height: 80, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  logoSymbol: { fontSize: 38, color: '#FFF', fontWeight: '200', includeFontPadding: false },
  appTitle: { fontSize: 40, fontWeight: '800', lineHeight: 46, marginBottom: 16 },
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  ratingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginRight: 7 },
  ratingText: { fontSize: 13, color: COLORS.textSecondary },

  // Bottom: Play Now + nav
  lobbyBottom: { gap: 0 },
  playNowWrapper: { borderRadius: 16, overflow: 'hidden', marginBottom: 4 },
  playNowBtn: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  playNowText: { fontSize: 18, fontWeight: '700', color: '#0B1A14' },
  bottomNavRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.borderSubtle, marginTop: 6 },
  bottomNavItem: { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 5 },
  bottomNavLabel: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '500' },

  // ── CONNECTING ────────────────────────────────────────────────────────────
  fullCentered: {
    flex: 1, backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28,
  },
  connectLogo: { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  connectTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  connectSub:   { fontSize: 13, color: COLORS.textSecondary },

  // ── SEARCHING ─────────────────────────────────────────────────────────────
  searchRoot: {
    flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 28,
  },
  searchCenter: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 0,
  },
  ambientDot: {
    position: 'absolute', width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: COLORS.primary, opacity: 0.5,
  },
  radarOuter: {
    width: 230, height: 230, borderRadius: 115,
    backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 40,
  },
  radarArc: {
    position: 'absolute',
    width: 216, height: 216, borderRadius: 108,
    borderWidth: 13, borderColor: COLORS.primary, borderTopColor: 'transparent',
  },
  radarCenter: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.surfaceCard, alignItems: 'center', justifyContent: 'center',
  },
  radarDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.primary },
  searchTitle: {
    fontSize: 26, fontWeight: '700', color: COLORS.text,
    textAlign: 'center', marginBottom: 10, lineHeight: 33,
  },
  searchSub: {
    fontSize: 14, color: COLORS.textSecondary,
    textAlign: 'center', marginBottom: 28,
  },
  waitPill: {
    backgroundColor: COLORS.surfaceCard, borderRadius: 28,
    paddingVertical: 12, paddingHorizontal: 24,
    borderWidth: 1, borderColor: COLORS.border,
  },
  waitPillText: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  searchBottom: { paddingBottom: Platform.OS === 'ios' ? 44 : 24 },
  cancelBtn: {
    width: '100%', height: 56,
    backgroundColor: COLORS.surface,
    borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  cancelBtnText: { fontSize: 16, fontWeight: '600', color: COLORS.text },

  // ── MATCH FOUND / VERSUS ──────────────────────────────────────────────────
  versusRoot: {
    flex: 1, backgroundColor: COLORS.background, alignItems: 'center',
  },
  versusTopSection: {
    alignItems: 'center', paddingTop: 48, paddingHorizontal: 32, width: '100%',
  },
  matchFoundLabel: {
    fontSize: 12, fontWeight: '700', color: COLORS.primary,
    letterSpacing: 3.5, marginBottom: 40,
  },
  versusRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', width: '100%',
  },
  versusPlayerCol: { alignItems: 'center', gap: 10, width: 110 },
  versusPlayerName: { fontSize: 14, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
  versusPlayerRating: { fontSize: 12, color: COLORS.textSecondary },
  vsBubble: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.surfaceCard, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  vsText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },

  // Big countdown in center
  versusCenterSection: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  bigCountdown: {
    fontSize: 132, fontWeight: '800', color: COLORS.primary, lineHeight: 144, marginBottom: 8,
  },
  getReadyText: { fontSize: 15, color: COLORS.textSecondary },

  // Step indicators at bottom
  versusBottomSection: {
    paddingBottom: Platform.OS === 'ios' ? 52 : 32,
  },
  cdStepsRow: { flexDirection: 'row', gap: 18 },
  cdStep: { fontSize: 14, color: COLORS.textMuted, fontWeight: '500' },
  cdStepActive: { fontSize: 15, color: COLORS.primary, fontWeight: '700' },

  // ── GAME SCREEN ───────────────────────────────────────────────────────────
  gameRoot: {
    flex: 1, backgroundColor: COLORS.background,
  },
  gameTopSection: {
    paddingHorizontal: 14, paddingTop: 12, gap: 10, marginBottom: 10,
  },
  topCardsRow: {
    flexDirection: 'row', gap: 8, height: 76,
  },
  scoreCard: {
    flex: 1, backgroundColor: COLORS.surface,
    borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'flex-start', justifyContent: 'space-between',
  },
  cardLabel: {
    fontSize: 9, fontWeight: '700',
    color: COLORS.textMuted, letterSpacing: 1.3,
  },
  cardNum: { fontSize: 30, fontWeight: '800', lineHeight: 34 },

  timerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  timerTrack: {
    flex: 1, height: 4,
    backgroundColor: COLORS.surfaceMedium, borderRadius: 2, overflow: 'hidden',
  },
  timerFill: {
    height: '100%', backgroundColor: COLORS.primary, borderRadius: 2,
  },
  timerLabel: {
    fontSize: 12, color: COLORS.textMuted, width: 34, textAlign: 'right',
  },

  // Question card
  questionCard: {
    backgroundColor: COLORS.surface, borderRadius: 18,
    paddingVertical: 22, paddingHorizontal: 22,
    marginHorizontal: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border, alignItems: 'center',
  },
  solveItLabel: {
    fontSize: 10, fontWeight: '700',
    color: COLORS.textMuted, letterSpacing: 2.2, marginBottom: 12,
  },
  equationText: {
    fontSize: 38, fontWeight: '800',
    color: COLORS.text, letterSpacing: -0.5,
  },

  // Answer field
  answerField: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: 18, height: 56, marginHorizontal: 14, marginBottom: 10,
  },
  answerFieldWrong: { borderColor: '#F85149' },
  answerNum: { flex: 1, fontSize: 26, fontWeight: '600', color: COLORS.text },
  answerHint: { fontSize: 13, color: COLORS.textMuted },

  // ── Keypad: fills ALL remaining space with flex rows ──
  keypadSection: {
    flex: 1,
    paddingHorizontal: 14,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
    gap: 8,
  },
  keyRow: {
    flex: 1, flexDirection: 'row', gap: 8,
  },
  key: {
    flex: 1,
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  keyText: { fontSize: 22, fontWeight: '600', color: COLORS.text },

  // ── GAME OVER ─────────────────────────────────────────────────────────────
  gameOverRoot: {
    flex: 1, backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 28, paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  gameOverGlow: {
    position: 'absolute', top: -40,
    left: '15%', right: '15%', height: 240,
    backgroundColor: COLORS.primary, opacity: 0.07, borderRadius: 120,
  },
  trophyWrapper: {
    position: 'relative', alignItems: 'center', justifyContent: 'center',
    marginBottom: 24, width: 180, height: 180,
  },
  confettiPiece: { position: 'absolute', width: 7, height: 18, borderRadius: 3 },
  trophyRing: {
    width: 142, height: 142, borderRadius: 71,
    borderWidth: 10, borderColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  trophyInner: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center',
  },
  winTitle: { fontSize: 44, fontWeight: '900', marginBottom: 8 },
  winSub: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 24, textAlign: 'center' },
  finalCard: {
    width: '100%', backgroundColor: COLORS.surface, borderRadius: 18,
    paddingVertical: 22, paddingHorizontal: 28,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 14,
  },
  finalScoreRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
  },
  finalPlayerCol: { alignItems: 'center' },
  finalLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.textMuted,
    letterSpacing: 1.2, marginBottom: 6,
  },
  finalNum: { fontSize: 54, fontWeight: '800', lineHeight: 60 },
  finalDash: { fontSize: 24, color: COLORS.border, fontWeight: '300' },
  ratingPill: {
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 22,
  },
  ratingPillText: { fontSize: 13, fontWeight: '600' },
  playAgainWrapper: { width: '100%', borderRadius: 14, overflow: 'hidden', marginBottom: 10 },
  playAgainBtn: { height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  playAgainText: { fontSize: 17, fontWeight: '700', color: '#0B1A14' },
  homeBtn: { width: '100%', height: 50, alignItems: 'center', justifyContent: 'center' },
  homeBtnText: { fontSize: 16, fontWeight: '600', color: COLORS.textSecondary },
});
