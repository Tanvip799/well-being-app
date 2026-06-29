import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';

export type TabType = 'home' | 'leaderboard' | 'history' | 'profile';

interface TabNavigationProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

const TABS = [
  { key: 'leaderboard' as TabType, label: 'Leaderboard', icon: 'bar-chart-outline', iconActive: 'bar-chart' },
  { key: 'history'     as TabType, label: 'History',     icon: 'time-outline',      iconActive: 'time'      },
  { key: 'profile'     as TabType, label: 'Settings',    icon: 'settings-outline',  iconActive: 'settings'  },
];

export default function TabNavigation({ activeTab, setActiveTab }: TabNavigationProps) {
  return (
    <View style={s.container}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={s.tabItem}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={(isActive ? tab.iconActive : tab.icon) as any}
              size={22}
              color={isActive ? COLORS.primary : '#4A5568'}
            />
            <Text style={[s.label, isActive && s.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#0F1724',
    borderTopWidth: 1,
    borderTopColor: '#1A2235',
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    paddingTop: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    color: '#4A5568',
  },
  labelActive: {
    color: COLORS.primary,
  },
});
