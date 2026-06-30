import React, { useState, useEffect } from 'react';
import { StyleSheet, View, StatusBar, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { COLORS } from './src/theme';
import SplashScreen from './src/screens/SplashScreen';
import MentalScreen from './src/screens/MentalScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import LoginScreen from './src/screens/LoginScreen';

function getDefaultServerUrl() {
  const debuggerHost =
    Constants.expoConfig?.hostUri || (Constants as any).manifest?.debuggerHost;
  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0]!;
    if (ip === '127.0.0.1' || ip === 'localhost') {
      return Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
    }
    return `http://${ip}:3000`;
  }
  return Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
}

type TabType = 'home' | 'leaderboard' | 'history' | 'profile';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [bootstrapping, setBootstrapping] = useState(true); // checking stored JWT

  // Auth
  const [jwtToken, setJwtToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const serverUrl = getDefaultServerUrl();

  // User data — all sourced from DB
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [xp, setXp] = useState(1000);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [streak, setStreak] = useState(0);
  const [rank, setRank] = useState(1);
  const [rating, setRating] = useState(500);
  const [lastXpChange, setLastXpChange] = useState(0);
  const [avatarColor, setAvatarColor] = useState('');

  // ── Refresh access token using stored refresh token ──────────────────────────
  const tryRefreshToken = async (): Promise<string | null> => {
    try {
      const storedRefresh = Platform.OS !== 'web'
        ? await SecureStore.getItemAsync('refresh_token')
        : null;
      if (!storedRefresh) return null;
      const res = await fetch(`${serverUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: storedRefresh }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (Platform.OS !== 'web') {
        await SecureStore.setItemAsync('jwt_token', data.token);
        await SecureStore.setItemAsync('refresh_token', data.refreshToken);
      }
      return data.token as string;
    } catch {
      return null;
    }
  };

  // ── On mount: try restoring session from SecureStore ──────────────────────────
  useEffect(() => {
    const restoreSession = async () => {
      try {
        if (Platform.OS === 'web') { setBootstrapping(false); return; }
        const storedToken = await SecureStore.getItemAsync('jwt_token');
        if (storedToken) {
          let ok = await loadUserFromDB(storedToken);
          if (ok) {
            setJwtToken(storedToken);
            setIsAuthenticated(true);
          } else {
            // Access token expired — try refreshing
            const newToken = await tryRefreshToken();
            if (newToken) {
              ok = await loadUserFromDB(newToken);
              if (ok) {
                setJwtToken(newToken);
                setIsAuthenticated(true);
              }
            }
          }
        }
      } catch (e) {
        console.warn('Session restore failed:', e);
      } finally {
        setBootstrapping(false);
      }
    };
    restoreSession();
  }, []);

  // ── Load/refresh user data from DB using JWT ──────────────────────────────────
  const loadUserFromDB = async (token: string): Promise<boolean> => {
    try {
      const res = await fetch(`${serverUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return false;
      const data = await res.json();
      const u = data.user;
      setUserId(u.id);
      setUsername(u.username);
      setXp(u.xp);
      setWins(u.wins);
      setLosses(u.losses);
      setStreak(u.streak ?? 0);
      setRank(u.rank ?? 1);
      setRating(u.rating ?? 500);
      setLastXpChange(u.lastXpChange ?? 0);
      setAvatarColor(u.avatar_color ?? '');
      return true;
    } catch {
      return false;
    }
  };

  const handleLoginSuccess = async (
    _name: string,
    _email: string,
    _userXp: number,
    _userWins: number,
    token: string,
    uid: string,
    refreshToken?: string,
  ) => {
    setJwtToken(token);
    setUserId(uid);
    setIsAuthenticated(true);
    if (Platform.OS !== 'web' && refreshToken) {
      await SecureStore.setItemAsync('refresh_token', refreshToken);
    }
    // Always source user data from DB — don't trust caller-supplied values
    await loadUserFromDB(token);
  };

  // ── Ensure JWT is valid before socket connect; refresh if needed ───────────────
  // Mutex ref prevents concurrent refresh calls from consuming the single-use Supabase refresh token twice
  const refreshInFlight = React.useRef<Promise<string | null> | null>(null);
  const getFreshToken = async (): Promise<string | null> => {
    if (!jwtToken) return null;
    const ok = await fetch(`${serverUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${jwtToken}` },
    }).then(r => r.ok).catch(() => false);
    if (ok) return jwtToken;
    if (refreshInFlight.current) return refreshInFlight.current;
    refreshInFlight.current = tryRefreshToken().then(newToken => {
      if (newToken) setJwtToken(newToken);
      refreshInFlight.current = null;
      return newToken;
    });
    return refreshInFlight.current;
  };

  const handleGameFinished = async (_result: {
    won: boolean; opponentName: string;
    myScore: number; oppScore: number; ratingChange: number;
  }) => {
    if (_result.won) setStreak(s => s + 1); else setStreak(0);
    const token = await getFreshToken();
    if (token) await loadUserFromDB(token);
  };

  const handleLogout = async () => {
    if (Platform.OS !== 'web') {
      await SecureStore.deleteItemAsync('jwt_token');
      await SecureStore.deleteItemAsync('refresh_token');
    }
    setJwtToken(null);
    setIsAuthenticated(false);
    setUsername('');
    setUserId(null);
    setXp(1000);
    setWins(0);
    setLosses(0);
    setStreak(0);
    setRank(1);
    setRating(500);
    setLastXpChange(0);
    setActiveTab('home');
  };

  // ── Splash ────────────────────────────────────────────────────────────────────
  if (showSplash) {
    return (
      <>
        <ExpoStatusBar style="light" />
        <SplashScreen onFinish={() => setShowSplash(false)} />
      </>
    );
  }

  // ── JWT restore loading spinner ───────────────────────────────────────────────
  if (bootstrapping) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const renderScreen = () => {
    if (!isAuthenticated) {
      return (
        <LoginScreen
          serverUrl={serverUrl}
          onLoginSuccess={handleLoginSuccess}
        />
      );
    }

    switch (activeTab) {
      case 'home':
        return (
          <MentalScreen
            username={username}
            avatarColor={avatarColor}
            serverUrl={serverUrl}
            jwtToken={jwtToken}
            getFreshToken={getFreshToken}
            soundEnabled={true}
            vibrationEnabled={true}
            onScreenStateChange={() => {}}
            onGameFinished={handleGameFinished}
            navigateTo={setActiveTab}
            wins={wins}
            losses={losses}
            xp={xp}
            streak={streak}
            rank={rank}
            lastXpChange={lastXpChange}
          />
        );

      case 'leaderboard':
        return (
          <LeaderboardScreen
            currentUsername={username}
            currentUserXP={xp}
            currentUserRank={rank}
            wins={wins}
            losses={losses}
            streak={streak}
            serverUrl={serverUrl}
            jwtToken={jwtToken}
            onBack={() => setActiveTab('home')}
          />
        );

      case 'history':
        return (
          <HistoryScreen
            serverUrl={serverUrl}
            jwtToken={jwtToken}
            wins={wins}
            losses={losses}
            xp={xp}
            streak={streak}
            onBack={() => setActiveTab('home')}
          />
        );

      case 'profile':
        return (
          <ProfileScreen
            username={username}
            email=""
            wins={wins}
            losses={losses}
            xp={xp}
            rating={rating}
            streak={streak}
            avatarColor={avatarColor}
            serverUrl={serverUrl}
            jwtToken={jwtToken}
            onBack={() => setActiveTab('home')}
            onLogout={handleLogout}
            onProfileUpdated={(newUsername, newAvatarColor) => {
              setUsername(newUsername);
              setAvatarColor(newAvatarColor);
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.container}>
        <ExpoStatusBar style="light" />
        <View style={s.screen}>{renderScreen()}</View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  screen: { flex: 1 },
});
