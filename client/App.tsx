import React, { useState } from 'react';
import { StyleSheet, View, SafeAreaView, StatusBar, Platform } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { COLORS } from './src/theme';
import SplashScreen from './src/screens/SplashScreen';
import MentalScreen from './src/screens/MentalScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import HistoryScreen, { HistoryItem } from './src/screens/HistoryScreen';
import ProfileScreen from './src/screens/ProfileScreen';

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
  const [isGameActive, setIsGameActive] = useState(false);

  // User state
  const [username, setUsername] = useState('Alex Rivera');
  const [serverUrl, setServerUrl] = useState(getDefaultServerUrl());

  // Preferences
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

  // Stats
  const [wins, setWins] = useState(182);
  const [totalGames, setTotalGames] = useState(278);
  const [xp, setXp] = useState(1420);
  const [streak, setStreak] = useState(5);

  // Match history
  const [history, setHistory] = useState<HistoryItem[]>([
    {
      id: 'h1',
      opponentName: 'Maya K.',
      myScore: 5,
      oppScore: 3,
      won: true,
      timestamp: 'Today',
      duration: '1:42',
    },
    {
      id: 'h2',
      opponentName: 'Jon Park',
      myScore: 4,
      oppScore: 5,
      won: false,
      timestamp: 'Today',
      duration: '2:08',
    },
    {
      id: 'h3',
      opponentName: 'Lena B.',
      myScore: 5,
      oppScore: 1,
      won: true,
      timestamp: 'Yesterday',
      duration: '1:15',
    },
    {
      id: 'h4',
      opponentName: 'Tom M.',
      myScore: 5,
      oppScore: 4,
      won: true,
      timestamp: 'Jun 27',
      duration: '1:58',
    },
  ]);

  const navigateTo = (tab: TabType) => setActiveTab(tab);
  const goHome = () => setActiveTab('home');

  const handleGameFinished = (result: {
    won: boolean;
    opponentName: string;
    myScore: number;
    oppScore: number;
  }) => {
    const xpGained = result.won ? 120 : 10;
    setXp((prev) => prev + xpGained);
    setTotalGames((prev) => prev + 1);
    if (result.won) {
      setWins((prev) => prev + 1);
      setStreak((prev) => prev + 1);
    } else {
      setStreak(0);
    }

    const newItem: HistoryItem = {
      id: `match_${Date.now()}`,
      opponentName: result.opponentName,
      myScore: result.myScore,
      oppScore: result.oppScore,
      won: result.won,
      timestamp: 'Just now',
      duration: '--',
    };
    setHistory((prev) => [newItem, ...prev]);
  };

  // ── Splash ──
  if (showSplash) {
    return (
      <>
        <ExpoStatusBar style="light" />
        <SplashScreen onFinish={() => setShowSplash(false)} />
      </>
    );
  }

  // ── Screens ──
  const renderScreen = () => {
    switch (activeTab) {
      case 'home':
        return (
          <MentalScreen
            username={username}
            serverUrl={serverUrl}
            soundEnabled={soundEnabled}
            vibrationEnabled={vibrationEnabled}
            onScreenStateChange={(state) => setIsGameActive(state !== 'LOBBY')}
            onGameFinished={handleGameFinished}
            navigateTo={navigateTo}
            wins={wins}
            xp={xp}
            streak={streak}
          />
        );

      case 'leaderboard':
        return (
          <LeaderboardScreen
            currentUsername={username}
            currentUserXP={xp}
            wins={wins}
            onBack={goHome}
          />
        );

      case 'history':
        return (
          <HistoryScreen
            history={history}
            wins={wins}
            totalGames={totalGames}
            xp={xp}
            streak={streak}
            onBack={goHome}
          />
        );

      case 'profile':
        return (
          <ProfileScreen
            username={username}
            setUsername={setUsername}
            serverUrl={serverUrl}
            setServerUrl={setServerUrl}
            soundEnabled={soundEnabled}
            setSoundEnabled={setSoundEnabled}
            vibrationEnabled={vibrationEnabled}
            setVibrationEnabled={setVibrationEnabled}
            wins={wins}
            xp={xp}
            onBack={goHome}
          />
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <ExpoStatusBar style="light" />
      <View style={s.screen}>{renderScreen()}</View>
    </SafeAreaView>
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
