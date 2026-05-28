import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/colors';

interface TabBarProps {
  activeTab: string;
  onTabPress: (tab: string) => void;
}

const tabs = [
  { id: 'home',     label: 'Home',     icon: 'home-outline'     },
  { id: 'journal',  label: 'Journal',  icon: 'book-outline'     },
  { id: 'analytics', label: 'Analytics', icon: 'bar-chart-outline' },
  { id: 'checks',   label: 'Checks',   icon: 'checkbox-outline' },
  { id: 'settings', label: 'Settings', icon: 'settings-outline' },
];

const ACTIVE   = '#a78bfa';
const INACTIVE = colors.tabBarInactive;

function TabItem({ tab, isActive, onPress }: {
  tab: typeof tabs[0];
  isActive: boolean;
  onPress: () => void;
}) {
  const anim = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: isActive ? 1 : 0,
      duration: 150,
      useNativeDriver: false, // color interpolation needs false
    }).start();
  }, [isActive]);

  const color = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [INACTIVE, ACTIVE],
  });

  return (
    <Pressable
      style={styles.tab}
      onPress={onPress}
      android_ripple={null}
      unstable_pressDelay={0}
    >
      <Animated.View style={{ alignItems: 'center', gap: 4 }}>
        {/* Icon color driven by animated value */}
        <Animated.Text style={{ color }}>
          <Ionicons name={tab.icon as any} size={24} />
        </Animated.Text>
        <Animated.Text style={[styles.tabLabel, { color }, isActive && styles.tabLabelActive]}>
          {tab.label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

export default function TabBar({ activeTab, onTabPress }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {tabs.map((tab) => (
        <TabItem
          key={tab.id}
          tab={tab}
          isActive={activeTab === tab.id}
          onPress={() => onTabPress(tab.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: 'Nunito_600SemiBold',
  },
  tabLabelActive: {
    fontFamily: 'Nunito_800ExtraBold',
  },
});