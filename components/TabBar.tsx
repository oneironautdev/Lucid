import { Ionicons } from '@expo/vector-icons';
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/colors';

export interface TabBarHandle {
  setActiveIndex: (index: number) => void;
}

interface TabBarProps {
  initialIndex?: number;
  onTabPress: (tab: string, index: number) => void;
}

const tabs = [
  { id: 'home',      label: 'Home',      icon: 'home-outline'      },
  { id: 'journal',   label: 'Journal',   icon: 'book-outline'      },
  { id: 'analytics', label: 'Analytics', icon: 'bar-chart-outline' },
  { id: 'checks',    label: 'Checks',    icon: 'checkbox-outline'  },
  { id: 'settings',  label: 'Settings',  icon: 'settings-outline'  },
];

const ACTIVE   = '#a78bfa';
const INACTIVE = colors.tabBarInactive;
const DURATION = 120;

const TabBar = forwardRef<TabBarHandle, TabBarProps>(function TabBar(
  { initialIndex = 0, onTabPress },
  ref
) {
  const insets = useSafeAreaInsets();

  const anims = useRef(
    tabs.map((_, i) => new Animated.Value(i === initialIndex ? 1 : 0))
  ).current;

  const activeIndexRef = useRef(initialIndex);

  const activate = (index: number) => {
    if (index === activeIndexRef.current) return;
    Animated.timing(anims[activeIndexRef.current], {
      toValue: 0,
      duration: DURATION,
      useNativeDriver: false,
    }).start();
    Animated.timing(anims[index], {
      toValue: 1,
      duration: DURATION,
      useNativeDriver: false,
    }).start();
    activeIndexRef.current = index;
  };

  // Expose imperative handle for App to control TabBar
  useImperativeHandle(ref, () => ({
    setActiveIndex: activate,
  }));

  const handlePress = (id: string, index: number) => {
    activate(index);
    onTabPress(id, index);
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {tabs.map((tab, index) => {
        const color = anims[index].interpolate({
          inputRange:  [0, 1],
          outputRange: [INACTIVE, ACTIVE],
        });

        return (
          <Pressable
            key={tab.id}
            style={styles.tab}
            onPress={() => handlePress(tab.id, index)}
            android_ripple={null}
            unstable_pressDelay={0}
          >
            <Animated.View style={{ alignItems: 'center', gap: 4 }}>
              <Animated.Text style={{ color }}>
                <Ionicons name={tab.icon as any} size={24} />
              </Animated.Text>
              <Animated.Text style={[styles.tabLabel, { color }]}>
                {tab.label}
              </Animated.Text>
            </Animated.View>
          </Pressable>
        );
      })}
    </View>
  );
});

export default TabBar;

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
});