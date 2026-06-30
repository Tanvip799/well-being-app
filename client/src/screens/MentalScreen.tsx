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
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { io, Socket } from 'socket.io-client';
import { COLORS, getInitials, getAvatarColor } from '../theme';

const { width } = Dimensions.get('window');

// ── Rounded-square avatar (Match Found / Versus) ────────────────────────────
function AvatarSquare({ name, isMe, color, size = 72 }: { name: string; isMe?: boolean; color?: string; size?: number }) {
  const bg = isMe ? COLORS.primary : (color ?? getAvatarColor(name));
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', shadowColor: bg, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 }}>
      <Text style={{ fontSize: size * 0.36, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 }}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

// ── XP Breakdown Row ─────────────────────────────────────────────────────────
function XPRow({ label, val, color }: { label: string; val: number; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5 }}>
      <Text style={{ fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' }}>{label}</Text>
      <Text style={{ fontSize: 13, color: color ?? COLORS.primary, fontWeight: '700' }}>+{val}</Text>
    </View>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────
interface MentalScreenProps {
  username: string;
  avatarColor?: string;
  serverUrl: string;
  jwtToken?: string | null;
  getFreshToken?: () => Promise<string | null>;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  onScreenStateChange: (s: string) => void;
  onGameFinished: (r: { won: boolean; opponentName: string; myScore: number; oppScore: number; ratingChange: number }) => void;
  navigateTo: (tab: 'home' | 'leaderboard' | 'history' | 'profile') => void;
  wins: number;
  losses: number;
  xp: number;
  streak: number;
  rank: number;
  lastXpChange: number;
}

interface XPBreakdown { base: number; perAnswer: number; accuracy: number; speed: number; streak: number; difficulty: number; sportsmanship: number; daily: number; total: number; }
interface SocketPlayer { id: string; username: string; score: number; correctAnswers?: number; wantsPlayAgain: boolean; xp?: number; xpChange?: number; xpBreakdown?: XPBreakdown; rating?: number; ratingChange?: number; }
type ScreenState = 'LOBBY' | 'CONNECTING' | 'SEARCHING' | 'VERSUS' | 'PLAYING' | 'GAME_OVER';

export default function MentalScreen({
  username,
  avatarColor,
  serverUrl,
  jwtToken,
  getFreshToken,
  soundEnabled,
  vibrationEnabled,
  onScreenStateChange,
  onGameFinished,
  navigateTo,
  wins,
  losses,
  xp,
  streak,
  rank,
  lastXpChange,
}: MentalScreenProps) {
  const [screenState, setScreenState] = useState<ScreenState>('LOBBY');
  const [socket, setSocket]           = useState<Socket | null>(null);
  const [players, setPlayers]         = useState<SocketPlayer[]>([]);
  const [ratingChange, setRatingChange] = useState(18);
  const [questionText, setQuestionText] = useState('');
  const [lastScorer, setLastScorer]   = useState<string | null>(null);
  const [countdown, setCountdown]     = useState<number | null>(null);
  const [winnerId, setWinnerId]       = useState<string | null>(null);
  const [opponentLeft, setOpponentLeft] = useState(false);
  const [answerInput, setAnswerInput] = useState('');
  const [wrongFlash, setWrongFlash]     = useState(false);
  const [correctFlash, setCorrectFlash] = useState(false);
  const [matchTimeLeft, setMatchTimeLeft] = useState(60);
  const [matchEndTime, setMatchEndTime]   = useState(0);

  // Bonus popup state
  const [bonusEvent, setBonusEvent] = useState<{ points: number; speedBonus: number; comboBonus: number; combo: number } | null>(null);
  const bonusAnim   = useRef(new Animated.Value(0)).current;
  const bonusTimer  = useRef<any>(null);

  // XP breakdown for game-over screen
  const [myXpGained, setMyXpGained]       = useState(0);
  const [myRatingChange, setMyRatingChange] = useState(0);
  const [myXpBreakdown, setMyXpBreakdown]   = useState<XPBreakdown | null>(null);
  const [lastAnswerPoints, setLastAnswerPoints] = useState(0);

  const searchTimerRef  = useRef<any>(null);
  const matchTimerRef   = useRef<any>(null);
  const pendingUpdate  = useRef<any>(null);
  const firstUpdate    = useRef(true);

  // Animations
  const spinAnim       = useRef(new Animated.Value(0)).current;
  const cdScale        = useRef(new Animated.Value(1)).current;
  const pulseRadar     = useRef(new Animated.Value(0)).current;
  const slideAnim      = useRef(new Animated.Value(0)).current;
  const shakeAnim      = useRef(new Animated.Value(0)).current;
  const qScale         = useRef(new Animated.Value(1)).current;
  const myScoreAnim    = useRef(new Animated.Value(0)).current;
  const oppScoreAnim   = useRef(new Animated.Value(0)).current;
  const myPlayer  = players.find(p => p.id === socket?.id);
  const oppPlayer = players.find(p => p.id !== socket?.id);

  const myScore = myPlayer?.score ?? 0;
  const oppScore = oppPlayer?.score ?? 0;

  const prevMyScore = useRef(myScore);
  const prevOppScore = useRef(oppScore);

  useEffect(() => { onScreenStateChange(screenState); }, [screenState]);

  // Handle score increments for floating text indicators (+1)
  useEffect(() => {
    if (myScore > prevMyScore.current && !firstUpdate.current) {
      myScoreAnim.setValue(0);
      Animated.timing(myScoreAnim, { toValue: 1, duration: 600, useNativeDriver: Platform.OS !== 'web' }).start();
    }
    prevMyScore.current = myScore;
  }, [myScore]);

  useEffect(() => {
    if (oppScore > prevOppScore.current && !firstUpdate.current) {
      oppScoreAnim.setValue(0);
      Animated.timing(oppScoreAnim, { toValue: 1, duration: 600, useNativeDriver: Platform.OS !== 'web' }).start();
    }
    prevOppScore.current = oppScore;
  }, [oppScore]);

  // Spring animation when questionText changes
  useEffect(() => {
    if (questionText) {
      qScale.setValue(0.85);
      Animated.spring(qScale, { toValue: 1, friction: 6, tension: 120, useNativeDriver: Platform.OS !== 'web' }).start();
    }
  }, [questionText]);

  // Radar scanning & floating logic
  useEffect(() => {
    if (screenState === 'SEARCHING') {
      Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' })
      ).start();

      Animated.loop(
        Animated.timing(pulseRadar, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: Platform.OS !== 'web' })
      ).start();
    } else {
      spinAnim.setValue(0);
      pulseRadar.setValue(0);
    }

    if (screenState === 'VERSUS') {
      slideAnim.setValue(0);
      Animated.spring(slideAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: Platform.OS !== 'web' }).start();
    }
  }, [screenState]);

  const startMatchTimer = (endTime: number) => {
    if (matchTimerRef.current) clearInterval(matchTimerRef.current);
    const tick = () => {
      const left = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setMatchTimeLeft(left);
      if (left <= 0) clearInterval(matchTimerRef.current);
    };
    tick();
    matchTimerRef.current = setInterval(tick, 250);
  };
  const stopMatchTimer = () => { if (matchTimerRef.current) { clearInterval(matchTimerRef.current); matchTimerRef.current = null; } };

  // Trigger text field shake on wrong answer
  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 40, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 40, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 40, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 40, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shakeAnim, { toValue: 4, duration: 40, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  };

  const startMatchmaking = async () => {
    setScreenState('CONNECTING');
    // Prefer a fresh token; fall back to the current jwtToken prop if refresh fails
    const token = (getFreshToken ? await getFreshToken().catch(() => null) : null) ?? jwtToken;
    const sock = io(serverUrl, {
      transports: ['websocket'],
      forceNew: true,
      timeout: 6000,
      auth: token ? { token } : {},
    });

    sock.on('connect', () => {
      setSocket(sock);
      setScreenState('SEARCHING');
      sock.emit('join_queue', { username, xp });
    });

    sock.on('connect_error', () => {
      sock.disconnect(); setSocket(null); setScreenState('LOBBY');
      Alert.alert('Connection Failed', `Cannot reach server at:\n${serverUrl}`);
    });

    sock.on('auth_required', (data: { message: string }) => {
      sock.disconnect(); setSocket(null); setScreenState('LOBBY');
      Alert.alert('Sign In Required', data.message);
    });

    sock.on('match_found', (data: { roomId: string; players: SocketPlayer[] }) => {
      if (searchTimerRef.current) clearInterval(searchTimerRef.current);
      firstUpdate.current = true;
      setPlayers(data.players); setOpponentLeft(false);
      setCountdown(3); setScreenState('VERSUS'); setWinnerId(null); setMatchTimeLeft(60); setMatchEndTime(0);
      // Handshake: tell the server we are successfully on the Match screen and ready for countdown
      sock.emit('versus_ready');
    });

    sock.on('countdown_tick', (data: { count: number }) => {
      setCountdown(data.count);
      cdScale.setValue(0.6);
      Animated.spring(cdScale, { toValue: 1, friction: 3.5, tension: 140, useNativeDriver: Platform.OS !== 'web' }).start();
    });

    sock.on('game_state_update', (data: { status: string; players: SocketPlayer[]; questionText: string; lastScorer: string | null; matchEndTime?: number }) => {
      if (firstUpdate.current) {
        firstUpdate.current = false;
        pendingUpdate.current = data;
        setCountdown(0);
        setTimeout(() => {
          const p = pendingUpdate.current;
          if (p) {
            setPlayers(p.players); setQuestionText(p.questionText); setLastScorer(p.lastScorer);
            setAnswerInput(''); setWrongFlash(false);
            if (p.matchEndTime) { setMatchEndTime(p.matchEndTime); startMatchTimer(p.matchEndTime); }
            setScreenState('PLAYING'); pendingUpdate.current = null;
          }
        }, 750);
      } else {
        setPlayers(data.players); setQuestionText(data.questionText); setLastScorer(data.lastScorer);
        setAnswerInput(''); setWrongFlash(false);
      }
    });

    sock.on('answer_feedback', (data: { correct: boolean; points?: number; speedBonus?: number; comboBonus?: number; combo?: number }) => {
      if (data.correct) {
        setCorrectFlash(true);
        if (vibrationEnabled) Vibration.vibrate(40);
        setTimeout(() => setCorrectFlash(false), 400);
        // Show bonus popup whenever there are extra bonuses
        const sb = data.speedBonus ?? 0;
        const cb = data.comboBonus ?? 0;
        if (sb > 0 || cb > 0) {
          if (bonusTimer.current) clearTimeout(bonusTimer.current);
          setBonusEvent({ points: data.points ?? 100, speedBonus: sb, comboBonus: cb, combo: data.combo ?? 0 });
          bonusAnim.setValue(0);
          Animated.spring(bonusAnim, { toValue: 1, tension: 100, friction: 8, useNativeDriver: Platform.OS !== 'web' }).start();
          bonusTimer.current = setTimeout(() => {
            Animated.timing(bonusAnim, { toValue: 0, duration: 280, useNativeDriver: Platform.OS !== 'web' }).start(() => setBonusEvent(null));
          }, 1800);
        }
        setLastAnswerPoints(data.points ?? 100);
      } else {
        setWrongFlash(true);
        triggerShake();
        if (vibrationEnabled) Vibration.vibrate([0, 80, 50, 80]);
        setTimeout(() => setWrongFlash(false), 400);
      }
    });

    sock.on('game_over', (data: { winnerId: string | null; players: SocketPlayer[]; tie?: boolean }) => {
      stopMatchTimer(); setPlayers(data.players); setWinnerId(data.winnerId); setScreenState('GAME_OVER');
      const me = data.players.find(p => p.id === sock.id);
      const opp = data.players.find(p => p.id !== sock.id);
      const isWin = data.winnerId === sock.id;
      const xpGained = me?.xpChange ?? 0;
      const rc = me?.ratingChange ?? 0;
      setRatingChange(rc);
      setMyXpGained(xpGained);
      setMyXpBreakdown(me?.xpBreakdown ?? null);
      setMyRatingChange(rc);

      onGameFinished({
        won: isWin,
        opponentName: opp?.username ?? 'Opponent',
        myScore: me?.score ?? 0,
        oppScore: opp?.score ?? 0,
        ratingChange: rc,
      });
      if (vibrationEnabled) { if (isWin) Vibration.vibrate([0, 100, 80, 200, 80, 300]); else Vibration.vibrate(450); }
    });

    sock.on('opponent_left', () => { stopMatchTimer(); setOpponentLeft(true); setScreenState('GAME_OVER'); });

    sock.on('player_ready_status', (data: { players: { id: string; wantsPlayAgain: boolean }[] }) => {
      setPlayers(prev => prev.map(p => { const m = data.players.find(x => x.id === p.id); return m ? { ...p, wantsPlayAgain: m.wantsPlayAgain } : p; }));
    });

    sock.on('match_restarting', () => {
      stopMatchTimer();
      firstUpdate.current = true; setCountdown(3); setScreenState('VERSUS');
      setWinnerId(null); setOpponentLeft(false); setMatchTimeLeft(60); setMatchEndTime(0);
      sock.emit('versus_ready');
    });
  };

  const leave = () => {
    if (searchTimerRef.current) clearInterval(searchTimerRef.current);
    stopMatchTimer(); socket?.disconnect(); setSocket(null);
    setScreenState('LOBBY'); setPlayers([]); setAnswerInput('');
    setCountdown(null); setWinnerId(null); setOpponentLeft(false); setMatchTimeLeft(60); setMatchEndTime(0);
    firstUpdate.current = true; pendingUpdate.current = null;
  };

  const pressKey = (k: string) => {
    if (vibrationEnabled) Vibration.vibrate(15);
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
  // SCREEN: LOBBY / HOME
  // ════════════════════════════════════════════════════════════════════════════
  if (screenState === 'LOBBY') {
    const winRate = (wins + losses) > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
    return (
      <View style={s.lobbyRoot}>
        {/* ── Header ── */}
        <View style={s.lobbyHeader}>
          <View>
            <Text style={s.welcomeSmall}>Welcome back</Text>
            <Text style={s.welcomeName}>{username}</Text>
          </View>
          <TouchableOpacity
            style={[s.meAvatar, avatarColor?.includes(':') ? { backgroundColor: avatarColor.split(':')[0] } : { backgroundColor: getAvatarColor(username) }]}
            onPress={() => navigateTo('profile')}
            activeOpacity={0.8}
          >
            <Text style={s.meAvatarText}>
              {avatarColor?.includes(':') ? avatarColor.split(':')[1] : getInitials(username)}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Card 1: Your Rating Dashboard */}
        <View style={s.newRatingCard}>
          <Text style={s.ratingLabel}>YOUR RATING</Text>
          <View style={s.ratingValueRow}>
            <Text style={s.ratingValueText}>{xp.toLocaleString()}</Text>
            {lastXpChange !== 0 ? (
              <Text style={[
                s.ratingTrendText,
                { color: lastXpChange > 0 ? COLORS.primary : COLORS.error }
              ]}>
                {lastXpChange > 0 ? `▲ ${lastXpChange}` : `▼ ${Math.abs(lastXpChange)}`}
              </Text>
            ) : (
              <Text style={[s.ratingTrendText, { color: COLORS.textMuted }]}>
                --
              </Text>
            )}
          </View>
          
          <View style={s.statsCardRow}>
            <View style={s.statsMiniCard}>
              <Text style={s.statsMiniVal}>#{rank}</Text>
              <Text style={s.statsMiniSub}>Global rank</Text>
            </View>
            <View style={s.statsMiniCard}>
              <Text style={s.statsMiniVal}>{winRate}%</Text>
              <Text style={s.statsMiniSub}>Win rate</Text>
            </View>
            <View style={s.statsMiniCard}>
              <Text style={[s.statsMiniVal, { color: COLORS.accent }]}>{streak}</Text>
              <Text style={s.statsMiniSub}>Win streak</Text>
            </View>
          </View>
        </View>

        {/* Card 2: Mental Duel Arena Card with Play Button */}
        <View style={s.newDuelCard}>
          <LinearGradient
            colors={['rgba(14,206,143,0.15)', 'rgba(0,212,255,0.06)']}
            style={s.newDuelCardGradient}
          >
            <View style={s.duelCardHeader}>
              <View style={s.duelIconWrapper}>
                <Ionicons name="bulb-outline" size={24} color={COLORS.primary} />
              </View>
            </View>
            
            <Text style={s.duelTitle}>Mental Duel Arena</Text>
            <Text style={s.duelDesc}>
              Battle players globally in speed mental arithmetic. Speed and accuracy wins.
            </Text>
            
            {/* Play Button inside card */}
            <TouchableOpacity onPress={startMatchmaking} activeOpacity={0.85} style={s.lobbyPlayBtnWrapper}>
              <LinearGradient
                colors={['#0ECE8F', '#11D4A8']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.lobbyPlayBtn}
              >
                <Text style={s.lobbyPlayBtnTitle}>PLAY NOW</Text>
                <Text style={s.lobbyPlayBtnSub}>Find a ranked match</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* Spacer to push content up */}
        <View style={{ flex: 1 }} />

        {/* Tab Nav Bar */}
        <View style={s.lobbyBottom}>
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
  // SCREEN: CONNECTING
  // ════════════════════════════════════════════════════════════════════════════
  if (screenState === 'CONNECTING') {
    return (
      <View style={s.fullCentered}>
        <LinearGradient colors={[COLORS.primary, COLORS.accent]} style={s.connectLogo}>
          <Text style={{ fontSize: 32, color: '#FFF', fontWeight: '200' }}>÷</Text>
        </LinearGradient>
        <Text style={s.connectTitle}>Connecting to Arena...</Text>
        <Text style={s.connectSub}>Securing high-speed real-time link</Text>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SCREEN: SEARCHING
  // ════════════════════════════════════════════════════════════════════════════
  if (screenState === 'SEARCHING') {
    const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
    const radarScale1 = pulseRadar.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] });
    const radarOpacity1 = pulseRadar.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 0.3, 0] });
    const radarScale2 = pulseRadar.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
    const radarOpacity2 = pulseRadar.interpolate({ inputRange: [0, 0.4, 0.8, 1], outputRange: [0, 0.5, 0.25, 0] });

    return (
      <View style={s.searchRoot}>
        <View style={s.searchCenter}>
          <View style={[s.ambientDot, { top: -60, left: -30 }]} />
          <View style={[s.ambientDot, { top: -40, right: -20, width: 5, height: 5, borderRadius: 2.5 }]} />

          {/* Futuristic Glowing Sonar Radar */}
          <View style={s.radarOuter}>
            <Animated.View style={[s.radarPulsingRing, { transform: [{ scale: radarScale1 }], opacity: radarOpacity1 }]} />
            <Animated.View style={[s.radarPulsingRing, { transform: [{ scale: radarScale2 }], opacity: radarOpacity2 }]} />
            
            {/* Concentric helper rings */}
            <View style={s.radarMiddleRing} />
            <View style={s.radarInnerRing} />

            <Animated.View style={[s.radarSweep, { transform: [{ rotate: spin }] }]} />
            
            <View style={s.radarCenter}>
              <View style={s.radarDot} />
            </View>
          </View>

          <Text style={s.searchTitle}>Searching for Duelist...</Text>
          <Text style={s.searchSub}>Matching you with a player near rating {xp.toLocaleString()}</Text>

          <View style={s.waitPill}>
            <Text style={s.waitPillText}>Estimated Wait ~ 8s</Text>
          </View>
        </View>

        <View style={s.searchBottom}>
          <TouchableOpacity style={s.cancelBtn} onPress={leave} activeOpacity={0.8}>
            <Text style={s.cancelBtnText}>Cancel Matchmaking</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SCREEN: MATCH FOUND / VERSUS
  // ════════════════════════════════════════════════════════════════════════════
  if (screenState === 'VERSUS') {
    const cdSteps: (number | string)[] = [3, 2, 1, 'GO!'];
    const isActive = (step: number | string) => step === 'GO!' ? countdown === 0 : countdown === step;

    // Slide animations for versus screen
    const p1Translate = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [-150, 0] });
    const p2Translate = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [150, 0] });
    const vsScale = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0.1, 1] });

    return (
      <View style={s.versusRoot}>
        {/* Top section: players intro */}
        <View style={s.versusTopSection}>
          <Text style={s.matchFoundLabel}>MATCH FOUND</Text>

          <View style={s.versusRow}>
            <Animated.View style={[s.versusPlayerCol, { transform: [{ translateX: p1Translate }] }]}>
              <AvatarSquare name={username} isMe size={76} />
              <Text style={s.versusPlayerName}>You</Text>
              <Text style={[s.versusPlayerRating, { color: COLORS.primary }]}>{xp.toLocaleString()} XP</Text>
            </Animated.View>

            <Animated.View style={[s.vsBubble, { transform: [{ scale: vsScale }] }]}>
              <Text style={s.vsText}>VS</Text>
            </Animated.View>

            <Animated.View style={[s.versusPlayerCol, { transform: [{ translateX: p2Translate }] }]}>
              <AvatarSquare name={oppName} color={oppColor} size={76} />
              <Text style={s.versusPlayerName}>
                {(() => { const parts = oppName.split(' '); return parts.length > 1 ? `${parts[0]} ${parts[1]?.[0]}.` : parts[0]; })()}
              </Text>
              <Text style={[s.versusPlayerRating, { color: COLORS.accent }]}>1,438 XP</Text>
            </Animated.View>
          </View>
        </View>

        {/* Center: massive spring countdown */}
        <View style={s.versusCenterSection}>
          {countdown === null ? (
            <Text style={s.getReadyText}>Initializing game sync...</Text>
          ) : (
            <>
              <Animated.Text style={[s.bigCountdown, { transform: [{ scale: cdScale }] }]}>
                {countdown === 0 ? 'GO!' : countdown}
              </Animated.Text>
              <Text style={s.getReadyText}>
                {countdown === 0 ? 'SOLVE AS FAST AS YOU CAN!' : 'GET READY...'}
              </Text>
            </>
          )}
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
  // SCREEN: PLAYING
  // ════════════════════════════════════════════════════════════════════════════
  if (screenState === 'PLAYING') {
    const oppLabel = (oppName.split(' ')[0] ?? 'OPP').toUpperCase().slice(0, 6);
    
    // Floating text interpolation
    const floatMyY = myScoreAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -32] });
    const floatMyOpacity = myScoreAnim.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] });

    const floatOppY = oppScoreAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -32] });
    const floatOppOpacity = oppScoreAnim.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] });

    // Format equation string: split by operator/numbers to color "?"
    const renderEquation = () => {
      if (!questionText) return null;
      if (questionText.includes('=')) {
        const parts = questionText.split('=');
        return (
          <Text style={s.gameEquationText} numberOfLines={1} adjustsFontSizeToFit>
            {parts[0]} = <Text style={{ color: COLORS.accent }}>?</Text>
          </Text>
        );
      } else {
        return (
          <Text style={s.gameEquationText} numberOfLines={1} adjustsFontSizeToFit>
            {questionText} = <Text style={{ color: COLORS.accent }}>?</Text>
          </Text>
        );
      }
    };

    // Timer turns red in last 10 seconds
    const timerUrgent = matchTimeLeft <= 10;

    return (
      <View style={s.gameRoot}>
        {/* HUD: Score cards + Match Timer */}
        <View style={s.gameHUDRow}>
          {/* Player Score Card */}
          <View style={[
            s.gameScoreCard,
            { borderColor: 'rgba(0, 212, 255, 0.25)' },
            myScore > oppScore && {
              borderColor: '#00D4FF',
              shadowColor: '#00D4FF', shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.35, shadowRadius: 10, elevation: 4,
            }
          ]}>
            <View style={s.cardHeaderRow}>
              <Text style={[s.gameCardLabel, { color: COLORS.accent }]}>YOU</Text>
              <Animated.View style={[s.scoreFloater, { transform: [{ translateY: floatMyY }], opacity: floatMyOpacity }]}>
                <Text style={s.scoreFloaterText}>+{lastAnswerPoints}</Text>
              </Animated.View>
            </View>
            <Text style={[s.gameCardScoreText, { color: COLORS.accent }]}>{myScore}</Text>
          </View>

          {/* Circular Match Timer */}
          <View style={s.circularTimerWrapper}>
            <View style={[s.circularTimerRing, timerUrgent && { borderColor: COLORS.error }]}>
              <Text style={[s.circularTimerText, timerUrgent && { color: COLORS.error }]}>{matchTimeLeft}</Text>
              <Text style={[s.circularTimerSec, timerUrgent && { color: COLORS.error }]}>SEC</Text>
            </View>
          </View>

          {/* Opponent Score Card */}
          <View style={[
            s.gameScoreCard,
            { borderColor: 'rgba(139, 92, 246, 0.25)' },
            oppScore > myScore && {
              borderColor: '#8B5CF6',
              shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.35, shadowRadius: 10, elevation: 4,
            }
          ]}>
            <View style={s.cardHeaderRow}>
              <Animated.View style={[s.scoreFloater, { transform: [{ translateY: floatOppY }], opacity: floatOppOpacity }]}>
                <Text style={s.scoreFloaterText}>+1</Text>
              </Animated.View>
              <Text style={[s.gameCardLabel, { color: '#8B5CF6' }]}>{oppLabel}</Text>
            </View>
            <Text style={[s.gameCardScoreText, { color: '#8B5CF6' }]}>{oppScore}</Text>
          </View>
        </View>

        {/* Bonus popup — slides up when speed/combo earned */}
        {bonusEvent && (
          <Animated.View pointerEvents="none" style={[s.bonusPopup, {
            opacity: bonusAnim,
            transform: [{ translateY: bonusAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
                        { scale: bonusAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.85, 1.05, 1] }) }],
          }]}>
            <Text style={s.bonusPtsText}>+{bonusEvent.points} PTS</Text>
            <View style={s.bonusBadgeRow}>
              {bonusEvent.speedBonus > 0 && (
                <View style={[s.bonusBadge, { backgroundColor: 'rgba(0,212,255,0.15)', borderColor: COLORS.accent }]}>
                  <Text style={[s.bonusBadgeText, { color: COLORS.accent }]}>⚡ +{bonusEvent.speedBonus} FAST</Text>
                </View>
              )}
              {bonusEvent.comboBonus > 0 && (
                <View style={[s.bonusBadge, { backgroundColor: 'rgba(255,159,10,0.15)', borderColor: COLORS.gold }]}>
                  <Text style={[s.bonusBadgeText, { color: COLORS.gold }]}>🔥 x{bonusEvent.combo} +{bonusEvent.comboBonus}</Text>
                </View>
              )}
            </View>
          </Animated.View>
        )}

        {/* Equation Card */}
        <View style={[
          s.gameEquationCard,
          correctFlash && s.gameEquationCardCorrect,
          wrongFlash && s.gameEquationCardWrong
        ]}>
          <Text style={s.solveThisLabel}>SOLVE THIS</Text>
          {renderEquation()}
          
          {/* LIVE status bar */}
          <View style={s.liveStatusRow}>
            <View style={s.liveStatusBadge}>
              <View style={s.liveGreenDot} />
              <Text style={s.liveStatusText}>LIVE</Text>
            </View>
            <Text style={s.typingStatusText}>
              ● {oppName.split(' ')[0]} is typing...
            </Text>
          </View>
        </View>

        {/* Answer display box */}
        <Animated.View style={[
          s.answerDisplayCard, 
          { transform: [{ translateX: shakeAnim }] }
        ]}>
          <Text style={s.answerDisplayText}>
            {answerInput || <Text style={{ color: COLORS.textMuted }}>Your Answer</Text>}
            {answerInput.length > 0 && <Text style={{ color: COLORS.primary }}>|</Text>}
          </Text>
        </Animated.View>

        {/* Tactile Grid Keypad */}
        <View style={s.newKeypadSection}>
          <View style={s.newKeyRow}>
            <TouchableOpacity style={s.newKey} onPress={() => pressKey('1')} activeOpacity={0.65}>
              <Text style={s.newKeyText}>1</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.newKey} onPress={() => pressKey('2')} activeOpacity={0.65}>
              <Text style={s.newKeyText}>2</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.newKey} onPress={() => pressKey('3')} activeOpacity={0.65}>
              <Text style={s.newKeyText}>3</Text>
            </TouchableOpacity>
          </View>
          <View style={s.newKeyRow}>
            <TouchableOpacity style={s.newKey} onPress={() => pressKey('4')} activeOpacity={0.65}>
              <Text style={s.newKeyText}>4</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.newKey} onPress={() => pressKey('5')} activeOpacity={0.65}>
              <Text style={s.newKeyText}>5</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.newKey} onPress={() => pressKey('6')} activeOpacity={0.65}>
              <Text style={s.newKeyText}>6</Text>
            </TouchableOpacity>
          </View>
          <View style={s.newKeyRow}>
            <TouchableOpacity style={s.newKey} onPress={() => pressKey('7')} activeOpacity={0.65}>
              <Text style={s.newKeyText}>7</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.newKey} onPress={() => pressKey('8')} activeOpacity={0.65}>
              <Text style={s.newKeyText}>8</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.newKey} onPress={() => pressKey('9')} activeOpacity={0.65}>
              <Text style={s.newKeyText}>9</Text>
            </TouchableOpacity>
          </View>
          <View style={s.newKeyRow}>
            <TouchableOpacity style={[s.newKey, { flex: 2 }]} onPress={() => pressKey('0')} activeOpacity={0.65}>
              <Text style={s.newKeyText}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.newKey, { flex: 1 }]} onPress={() => pressKey('⌫')} activeOpacity={0.65}>
              <Ionicons name="backspace-outline" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={s.newSubmitBtnWrapper}
          onPress={submit}
          disabled={!answerInput}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={answerInput ? ['#0ECE8F', '#00D4FF'] : ['#1C2128', '#1C2128']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.newSubmitBtn}
          >
            <Ionicons name="checkmark-sharp" size={20} color={answerInput ? '#071510' : COLORS.textMuted} style={{ marginRight: 8 }} />
            <Text style={[s.newSubmitBtnText, answerInput ? { color: '#071510', fontWeight: '900' } : { color: COLORS.textMuted }]}>
              Submit Answer
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SCREEN: GAME OVER / WINNER
  // ════════════════════════════════════════════════════════════════════════════
  if (screenState === 'GAME_OVER') {
    const isWin     = winnerId === socket?.id;
    const isTie     = !opponentLeft && winnerId === null;
    const myScore   = myPlayer?.score ?? 0;
    const oppScore  = oppPlayer?.score ?? 0;
    const oppShort  = (oppName.split(' ')[0] ?? 'OPP').toUpperCase();
    const showAbort = opponentLeft && winnerId === null;

    const resultColor  = showAbort ? COLORS.textMuted : isTie ? COLORS.gold : isWin ? COLORS.primary : '#F85149';
    const trophyColor  = resultColor;
    const trophyIcon   = isTie ? 'ribbon-outline' : (isWin && !showAbort) ? 'trophy' : 'sad-outline';

    return (
      <View style={s.gameOverRoot}>
        <View style={s.gameOverGlow} />

        {/* Top-left lobby button */}
        <TouchableOpacity style={s.goBackBtn} onPress={leave} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={18} color={COLORS.textSecondary} />
          <Text style={s.goBackText}>Lobby</Text>
        </TouchableOpacity>

        {/* Trophy */}
        <View style={s.trophyWrapper}>
          <View style={[s.trophyRing, {
            borderColor: trophyColor,
            shadowColor: trophyColor,
            shadowOpacity: (isWin || isTie) ? 0.7 : 0.2,
            shadowRadius: 24, elevation: 12,
          }]}>
            <View style={s.trophyInner}>
              <Ionicons name={trophyIcon} size={40} color={trophyColor} />
            </View>
          </View>
        </View>

        {/* Result title */}
        <Text style={[s.winTitle, { color: resultColor }]}>
          {showAbort ? 'ABORTED' : isTie ? "IT'S A TIE!" : isWin ? 'VICTORY!' : 'DEFEATED'}
        </Text>

        {/* Score card */}
        <View style={s.finalCard}>
          <View style={s.finalScoreRow}>
            <View style={s.finalPlayerCol}>
              <Text style={s.finalLabel}>YOU</Text>
              <Text style={[s.finalNum, { color: isWin && !showAbort ? COLORS.primary : COLORS.text }]}>{myScore}</Text>
            </View>
            <Text style={s.finalDash}>VS</Text>
            <View style={s.finalPlayerCol}>
              <Text style={s.finalLabel}>{oppShort}</Text>
              <Text style={[s.finalNum, { color: !isWin && !isTie && !showAbort ? '#F85149' : COLORS.text }]}>{oppScore}</Text>
            </View>
          </View>

          {/* Result line below scores */}
          {!showAbort && (
            <Text style={[s.finalResultLine, { color: resultColor }]}>
              {isTie
                ? 'Dead even — no winner'
                : isWin
                  ? `+${myScore - oppScore} pts ahead`
                  : `${oppShort} led by ${oppScore - myScore} pts`}
            </Text>
          )}
          {showAbort && <Text style={[s.finalResultLine, { color: COLORS.textMuted }]}>Opponent disconnected</Text>}
        </View>

        {/* XP + Rating inline text */}
        {!showAbort && (
          <View style={s.xpRatingRow}>
            <Text style={[s.xpRatingText, { color: COLORS.primary }]}>+{myXpGained} XP</Text>
            <View style={s.xpRatingDot} />
            <Text style={[s.xpRatingText, { color: myRatingChange >= 0 ? COLORS.primary : '#F85149' }]}>
              {myRatingChange >= 0 ? `+${myRatingChange}` : `${myRatingChange}`} Rating
            </Text>
          </View>
        )}

        {/* XP Breakdown Card — no emojis, trimmed items */}
        {!showAbort && myXpBreakdown && (
          <View style={s.xpCard}>
            <Text style={s.xpCardTitle}>XP BREAKDOWN</Text>
            {myXpBreakdown.base > 0 && <XPRow label={isWin ? 'Victory' : isTie ? 'Draw' : 'Defeat'} val={myXpBreakdown.base} color={resultColor} />}
            {myXpBreakdown.accuracy > 0 && <XPRow label="Accuracy" val={myXpBreakdown.accuracy} />}
            {myXpBreakdown.speed > 0 && <XPRow label="Speed" val={myXpBreakdown.speed} />}
            {myXpBreakdown.streak > 0 && <XPRow label="Streak" val={myXpBreakdown.streak} />}
            {myXpBreakdown.sportsmanship > 0 && <XPRow label="Stayed Match" val={myXpBreakdown.sportsmanship} />}
            <View style={s.xpCardDivider} />
            <View style={s.xpTotalRow}>
              <Text style={s.xpTotalLabel}>TOTAL</Text>
              <Text style={s.xpTotalValue}>+{myXpBreakdown.total} XP</Text>
            </View>
          </View>
        )}

        {/* Rematch button */}
        {!showAbort && (
          opponentLeft ? (
            <View style={s.playAgainWrapper}>
              <View style={[s.playAgainBtn, { backgroundColor: '#1C2128', borderColor: 'rgba(255,255,255,0.05)', borderWidth: 1 }]}>
                <Text style={[s.playAgainText, { color: COLORS.textMuted }]}>Opponent Has Left</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity onPress={() => socket?.emit('play_again')} disabled={!!myPlayer?.wantsPlayAgain} activeOpacity={0.85} style={s.playAgainWrapper}>
              <LinearGradient
                colors={myPlayer?.wantsPlayAgain ? ['#161B22', '#161B22'] : [COLORS.primary, COLORS.accent]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.playAgainBtn}
              >
                <Text style={[s.playAgainText, myPlayer?.wantsPlayAgain && { color: COLORS.textSecondary }]}>
                  {myPlayer?.wantsPlayAgain ? 'Waiting for opponent...' : 'Vote Rematch'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )
        )}
        {showAbort && (
          <TouchableOpacity style={s.playAgainWrapper} onPress={leave} activeOpacity={0.75}>
            <LinearGradient colors={[COLORS.primary, COLORS.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.playAgainBtn}>
              <Text style={s.playAgainText}>Return to Lobby</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return null;
}

// ════════════════════════════════════════════════════════════════════════════════
// STYLES
// ════════════════════════════════════════════════════════════════════════════════
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
// Treat anything under 820px as "small" — catches most mid-range Android phones
const isSmall = SCREEN_HEIGHT < 820;

const SCALE = {
  hudHeight: isSmall ? 72 : 84,
  hudMargin: isSmall ? 6 : 12,
  mathCardPadding: isSmall ? 14 : 22,
  mathFontSize: isSmall ? 32 : 40,
  answerHeight: isSmall ? 44 : 52,
  answerMargin: isSmall ? 6 : 10,
  keyRowHeight: isSmall ? 44 : 52,
  keypadGap: isSmall ? 5 : 7,
  keypadMargin: isSmall ? 4 : 6,
  submitHeight: isSmall ? 46 : 52,
  submitBottomMargin: Platform.OS === 'ios' ? (isSmall ? 10 : 20) : (isSmall ? 6 : 10),
};

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
    alignItems: 'center', justifyContent: 'center',
  },
  meAvatarText: { fontSize: 20, fontWeight: '700', color: '#fff' },

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
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 40,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  radarPulsingRing: {
    position: 'absolute',
    width: 240, height: 240, borderRadius: 120,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  radarSweep: {
    position: 'absolute',
    width: 220, height: 220, borderRadius: 110,
    borderWidth: 8, borderColor: COLORS.primary, borderTopColor: 'transparent',
    borderRightColor: 'transparent', opacity: 0.25,
  },
  radarMiddleRing: {
    position: 'absolute',
    width: 160, height: 160, borderRadius: 80,
    borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed',
  },
  radarInnerRing: {
    position: 'absolute',
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 1, borderColor: COLORS.border, opacity: 0.5,
  },
  radarCenter: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.surfaceCard, alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
  },
  radarDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.primary },
  searchTitle: {
    fontSize: 26, fontWeight: '800', color: COLORS.text,
    textAlign: 'center', marginBottom: 10, letterSpacing: -0.5,
  },
  searchSub: {
    fontSize: 14, color: COLORS.textSecondary,
    textAlign: 'center', marginBottom: 28, paddingHorizontal: 10,
  },
  waitPill: {
    backgroundColor: COLORS.surfaceCard, borderRadius: 28,
    paddingVertical: 10, paddingHorizontal: 22,
    borderWidth: 1, borderColor: COLORS.border,
  },
  waitPillText: { fontSize: 14, color: COLORS.text, fontWeight: '700' },
  searchBottom: { paddingBottom: Platform.OS === 'ios' ? 44 : 24 },
  cancelBtn: {
    width: '100%', height: 56,
    backgroundColor: COLORS.surface,
    borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  cancelBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.text },

  // ── MATCH FOUND / VERSUS ──────────────────────────────────────────────────
  versusRoot: {
    flex: 1, backgroundColor: COLORS.background, alignItems: 'center',
  },
  versusTopSection: {
    alignItems: 'center', paddingTop: 48, paddingHorizontal: 32, width: '100%',
  },
  matchFoundLabel: {
    fontSize: 12, fontWeight: '800', color: COLORS.primary,
    letterSpacing: 4.5, marginBottom: 40,
  },
  versusRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', width: '100%',
  },
  versusPlayerCol: { alignItems: 'center', gap: 10, width: 110 },
  versusPlayerName: { fontSize: 15, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  versusPlayerRating: { fontSize: 12, fontWeight: '600' },
  vsBubble: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: COLORS.surfaceCard, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  vsText: { fontSize: 14, fontWeight: '800', color: COLORS.textSecondary },

  // Big countdown
  versusCenterSection: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  bigCountdown: {
    fontSize: 136, fontWeight: '900', color: COLORS.primary, lineHeight: 148, marginBottom: 8,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 20,
  },
  getReadyText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '700', letterSpacing: 1.5, textAlign: 'center' },

  versusBottomSection: {
    paddingBottom: Platform.OS === 'ios' ? 52 : 32,
  },
  cdStepsRow: { flexDirection: 'row', gap: 18 },
  cdStep: { fontSize: 14, color: COLORS.textMuted, fontWeight: '700' },
  cdStepActive: { fontSize: 15, color: COLORS.primary, fontWeight: '900' },

  // ── NEW GAME SCREEN DESIGN ─────────────────────────────────────────────────
  gameRoot: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: isSmall ? 6 : 10,
    justifyContent: 'space-between',
  },
  roundPillContainer: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 6,
  },
  roundPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1.2,
    borderColor: COLORS.borderGlass,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  roundPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#8B5CF6', // Purple styled round tracker as seen in photo
    letterSpacing: 0.5,
  },
  gameHUDRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SCALE.hudMargin,
    height: SCALE.hudHeight,
  },
  gameScoreCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: COLORS.borderGlass,
    justifyContent: 'space-between',
    height: '100%',
    position: 'relative',
  },
  scoreCardActiveBorder: {
    borderColor: COLORS.border,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  gameCardLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  gameCardScoreText: {
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 32,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 3.5,
  },
  dotIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  circularTimerWrapper: {
    marginHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circularTimerRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2.5,
    borderColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7, 10, 19, 0.7)',
  },
  circularTimerInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#070A13',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  circularTimerText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFF',
    lineHeight: 24,
  },
  circularTimerSec: {
    fontSize: 8,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  gameEquationCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    paddingVertical: SCALE.mathCardPadding,
    paddingHorizontal: 22,
    marginHorizontal: 14,
    marginBottom: SCALE.hudMargin,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 212, 255, 0.12)', // Subtle cyber cyan outline!
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  solveThisLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 3,
    marginBottom: 12,
  },
  gameEquationText: {
    fontSize: SCALE.mathFontSize, // Dynamic math equation text
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  liveStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    gap: 8,
  },
  liveStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14,206,143,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  liveGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  liveStatusText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.primary,
  },
  typingStatusText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  answerDisplayCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    height: SCALE.answerHeight,
    marginHorizontal: 14,
    marginBottom: SCALE.answerMargin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerDisplayCardWrong: {
    borderColor: '#F85149',
  },
  answerDisplayText: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
  },
  newKeypadSection: {
    paddingHorizontal: 14,
    gap: SCALE.keypadGap,
    marginBottom: SCALE.keypadMargin,
    marginTop: SCALE.keypadMargin,
  },
  newKeyRow: {
    flexDirection: 'row',
    gap: SCALE.keypadGap,
    height: SCALE.keyRowHeight, // Dynamic key row height
  },
  newKey: {
    flex: 1,
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  newKeyText: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  newSubmitBtnWrapper: {
    marginHorizontal: 14,
    marginBottom: SCALE.submitBottomMargin,
    borderRadius: 16,
    overflow: 'hidden',
  },
  newSubmitBtn: {
    height: SCALE.submitHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  newSubmitBtnText: {
    fontSize: 16,
    fontWeight: '800',
  },
  scoreFloater: {
    position: 'absolute',
    top: -6,
    right: 2,
    backgroundColor: COLORS.success,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  scoreFloaterText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0B1A14',
  },

  // ── GAME OVER ─────────────────────────────────────────────────────────────
  gameOverRoot: {
    flex: 1, backgroundColor: COLORS.background,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    gap: 10,
  },
  goBackBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    alignSelf: 'flex-start',
    paddingVertical: 6, paddingHorizontal: 4,
  },
  goBackText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
  gameOverGlow: {
    position: 'absolute', top: -40,
    left: '10%', right: '10%', height: 180,
    backgroundColor: COLORS.primaryGlow, opacity: 0.08, borderRadius: 90,
  },
  trophyWrapper: {
    position: 'relative', alignItems: 'center', justifyContent: 'center',
    width: 110, height: 110,
  },
  confettiPiece: { position: 'absolute', width: 3, height: 10, borderRadius: 1.5 },
  trophyRing: {
    width: 108, height: 108, borderRadius: 54,
    borderWidth: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  trophyInner: {
    width: 74, height: 74, borderRadius: 37,
    backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
  },
  winTitle: { fontSize: 34, fontWeight: '900', letterSpacing: -0.5 },
  // xp/rating inline
  xpRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  xpRatingText: { fontSize: 15, fontWeight: '800' },
  xpRatingDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.textMuted },
  // result line below score
  finalResultLine: { fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 6, letterSpacing: 0.3 },
  finalCard: {
    width: '100%', backgroundColor: COLORS.surface, borderRadius: 20,
    paddingVertical: 22, paddingHorizontal: 28,
    borderWidth: 1.5, borderColor: COLORS.border, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 10,
  },
  finalScoreRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
  },
  finalPlayerCol: { alignItems: 'center' },
  finalLabel: {
    fontSize: 11, fontWeight: '800', color: COLORS.textSecondary,
    letterSpacing: 1.5, marginBottom: 6,
  },
  finalNum: { fontSize: 46, fontWeight: '900', lineHeight: 52 },
  finalDash: { fontSize: 20, color: COLORS.textMuted, fontWeight: '800' },
  ratingPill: {
    borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  ratingPillText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  // XP Breakdown Card
  xpCard: {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
  },
  xpCardTitle: { fontSize: 11, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1.5, marginBottom: 12, textAlign: 'center' },
  xpCardDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 8 },
  xpTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 2 },
  xpTotalLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 1 },
  xpTotalValue: { fontSize: 17, fontWeight: '900', color: COLORS.primary },
  // Bonus popup
  bonusPopup: {
    alignSelf: 'center', alignItems: 'center', gap: 6,
    marginBottom: 4,
  },
  bonusPtsText: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  bonusBadgeRow: { flexDirection: 'row', gap: 8 },
  bonusBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1 },
  bonusBadgeText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  playAgainWrapper: { width: '100%', borderRadius: 16, overflow: 'hidden' },
  playAgainBtn: { height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  playAgainText: { fontSize: 16, fontWeight: '800', color: '#0B1A14' },
  homeBtn: { width: '100%', height: 44, alignItems: 'center', justifyContent: 'center' },
  homeBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.textSecondary },

  // New Lobby styling updates
  newRatingCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: COLORS.borderGlass,
    padding: 20,
    marginTop: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  ratingLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  ratingValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 16,
  },
  ratingValueText: {
    fontSize: 34,
    fontWeight: '900',
    color: COLORS.text,
  },
  ratingTrendText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },
  statsCardRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statsMiniCard: {
    flex: 1,
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.02)',
  },
  statsMiniVal: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 2,
  },
  statsMiniSub: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  newDuelCard: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#0ECE8F', // Solid neon green outline!
    backgroundColor: COLORS.surface,
    shadowColor: '#0ECE8F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  newDuelCardGradient: {
    padding: 20,
  },
  duelCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  duelIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(14,206,143,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  duelTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 4,
  },
  duelDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 16,
  },
  lobbyPlayBtnWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  lobbyPlayBtn: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  lobbyPlayBtnTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0B1A14',
    letterSpacing: 0.5,
  },
  lobbyPlayBtnSub: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0B1A14',
    opacity: 0.8,
  },
  gameEquationCardCorrect: {
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 5,
  },
  gameEquationCardWrong: {
    borderColor: '#F85149',
    shadowColor: '#F85149',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 5,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14,206,143,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  liveText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.primary,
  },
});
