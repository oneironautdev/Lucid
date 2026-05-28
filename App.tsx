import { Nunito_300Light, Nunito_600SemiBold, Nunito_800ExtraBold, useFonts } from '@expo-google-fonts/nunito';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Circle, Svg, Text as SvgText } from 'react-native-svg';

import * as Notifications from 'expo-notifications';
import Analytics from './app/analytics';
import Checks from './app/checks';
import Index from './app/index';
import Journal, { JournalHandle } from './app/journal';
import Settings, { loadPin } from './app/settings';
import TabBar from './components/TabBar';
import { colors } from './constants/colors';
import { Dream, loadDreams } from './utils/storage';

const TABS = ['home', 'journal', 'analytics', 'checks', 'settings'] as const;
type Tab = typeof TABS[number];
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ── Star field ────────────────────────────────────────────────────────────────
const STAR_COUNT  = 60;
const FIELD_W     = SCREEN_W * 2.5;
const STAR_COLORS = ['#a78bfa','#7c6fd4','#c4baff','#6d5fc7','#ddd6fe','#9d8df1'];

interface StarDef {
  id: number; x: number; y: number; size: number;
  opacity: number; color: string;
  pulseAnim: Animated.Value; pulseDuration: number; pulseDelay: number;
}

const STARS: StarDef[] = Array.from({ length: STAR_COUNT }, (_, i) => ({
  id: i,
  x: Math.random() * FIELD_W,
  y: Math.random() * SCREEN_H,
  size: Math.random() * 2.8 + 1.2,
  opacity: Math.random() * 0.45 + 0.15,
  color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
  pulseAnim: new Animated.Value(1),
  pulseDuration: 1400 + Math.random() * 2600,
  pulseDelay: Math.random() * 3000,
}));

function StarField({ translateX }: { translateX: Animated.Value }) {
  const animationsStarted = useRef(false);
  const animationRefs = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    if (animationsStarted.current) return;
    animationsStarted.current = true;
    STARS.forEach(star => {
      const loop = () => {
        const anim = Animated.sequence([
          Animated.delay(star.pulseDelay),
          Animated.timing(star.pulseAnim, { toValue: 1.7, duration: star.pulseDuration, useNativeDriver: true }),
          Animated.timing(star.pulseAnim, { toValue: 1,   duration: star.pulseDuration, useNativeDriver: true }),
        ]);
        animationRefs.current.push(anim);
        anim.start(loop);
      };
      loop();
    });
    return () => { animationRefs.current.forEach(a => a.stop()); animationRefs.current = []; };
  }, []);

  const parallaxX = translateX.interpolate({
    inputRange: [-(SCREEN_W * (TABS.length - 1)), 0],
    outputRange: [-(FIELD_W - SCREEN_W) * 0.2, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width: FIELD_W, height: '100%', transform: [{ translateX: parallaxX }], zIndex: 0 }}>
      {STARS.map(star => (
        <Animated.View key={star.id} style={{ position: 'absolute', left: star.x, top: star.y, width: star.size, height: star.size, borderRadius: star.size / 2, backgroundColor: star.color, opacity: star.opacity, transform: [{ scale: star.pulseAnim }] }} />
      ))}
    </Animated.View>
  );
}

// ── Lucid logo ────────────────────────────────────────────────────────────────
function LucidLogo() {
  return (
    <Svg width={204} height={102} viewBox="0 0 680 340">
      <Circle cx={340} cy={130} r={92} fill="#AFA9EC" />
      <Circle cx={388} cy={98}  r={80} fill="#0d0b1e" />
      <Circle cx={272} cy={70}  r={4}   fill="#534AB7" />
      <Circle cx={412} cy={56}  r={2.5} fill="#534AB7" />
      <Circle cx={246} cy={138} r={2}   fill="#534AB7" />
      <Circle cx={434} cy={158} r={3.5} fill="#534AB7" />
      <Circle cx={288} cy={50}  r={2}   fill="#534AB7" />
      <Circle cx={376} cy={44}  r={1.8} fill="#534AB7" />
      <Circle cx={254} cy={100} r={1.5} fill="#534AB7" />
      <Circle cx={420} cy={110} r={2}   fill="#534AB7" />
      <SvgText x={340} y={258} textAnchor="middle" fill="#e8e2ff" fontSize={60} fontWeight="600" letterSpacing={14} fontFamily="Georgia, serif">Lucid</SvgText>
    </Svg>
  );
}

// ── PIN dialpad (lock screen version) ─────────────────────────────────────────
const DIALPAD_KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

function LockDialpad({ onKey }: { onKey: (k: string) => void }) {
  return (
    <View style={ldStyles.grid}>
      {DIALPAD_KEYS.map((key, i) => (
        key === '' ? (
          <View key={i} style={ldStyles.keyEmpty} />
        ) : (
          <TouchableOpacity key={i} style={[ldStyles.key, key === '⌫' && ldStyles.keyBack]} onPress={() => onKey(key)} activeOpacity={0.55}>
            {key === '⌫'
              ? <Ionicons name="backspace-outline" size={24} color={colors.textPrimary} />
              : <Text style={ldStyles.keyText}>{key}</Text>
            }
          </TouchableOpacity>
        )
      ))}
    </View>
  );
}

const ldStyles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, width: 260 },
  key:  { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.14)', justifyContent: 'center', alignItems: 'center' },
  keyBack: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.07)' },
  keyEmpty: { width: 72, height: 72 },
  keyText: { fontSize: 26, fontFamily: 'Nunito_600SemiBold', color: colors.textPrimary },
});

// ── Lock screen ───────────────────────────────────────────────────────────────
interface LockScreenProps {
  savedPin: string;
  onDone: () => void;
}

function LockScreen({ savedPin, onDone }: LockScreenProps) {
  const [digits, setDigits]   = useState('');
  const [isError, setIsError] = useState(false);
  const shakeAnim   = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenTranslY = useRef(new Animated.Value(0)).current;

  // Entrance animations
  const logoScale   = useRef(new Animated.Value(0.72)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const bodyOpacity = useRef(new Animated.Value(0)).current;
  const bodyTranslY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(80),
      Animated.parallel([
        Animated.spring(logoScale,   { toValue: 1, useNativeDriver: true, tension: 120, friction: 10 }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
      ]),
    ]).start();
    Animated.sequence([
      Animated.delay(260),
      Animated.parallel([
        Animated.timing(bodyOpacity, { toValue: 1, duration: 340, useNativeDriver: true }),
        Animated.timing(bodyTranslY, { toValue: 0, duration: 340, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const playExit = (cb: () => void) => {
    Animated.parallel([
      Animated.timing(screenOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(screenTranslY, { toValue: -28, duration: 300, useNativeDriver: true }),
    ]).start(cb);
  };

  const shakeWrong = () => {
    setIsError(true);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -12, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  12, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  -9, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   9, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   0, duration: 55, useNativeDriver: true }),
    ]).start(() => { setIsError(false); setDigits(''); });
  };

  const handleKey = (key: string) => {
    if (isError) return;
    if (key === '⌫') { setDigits(d => d.slice(0, -1)); return; }
    const next = digits + key;
    if (next.length > savedPin.length) return;
    setDigits(next);
    // Auto-submit when length matches
    if (next.length === savedPin.length) {
      if (next === savedPin) {
        playExit(onDone);
      } else {
        // brief delay so last dot renders before shake
        setTimeout(shakeWrong, 80);
      }
    }
  };

  const dotColor = isError ? '#f87171' : colors.lightPurple;

  return (
    <Animated.View style={[lockStyles.root, { opacity: screenOpacity, transform: [{ translateY: screenTranslY }] }]}>
      <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
        <LucidLogo />
      </Animated.View>

      <Animated.View style={{ alignItems: 'center', gap: 32, opacity: bodyOpacity, transform: [{ translateY: bodyTranslY }] }}>
        <Text style={lockStyles.sub}>Enter your PIN</Text>

        {/* PIN dots */}
        <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            {Array.from({ length: savedPin.length }).map((_, i) => (
              <View key={i} style={[lockStyles.dot, i < digits.length && { backgroundColor: dotColor, borderColor: dotColor }]} />
            ))}
          </View>
        </Animated.View>

        {/* Wrong PIN label — always in layout, invisible when not erroring */}
        <Text style={[lockStyles.wrongText, { opacity: isError ? 1 : 0 }]}>Wrong PIN</Text>

        <LockDialpad onKey={handleKey} />
      </Animated.View>
    </Animated.View>
  );
}

const lockStyles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, gap: 40 },
  sub:  { fontSize: 15, fontFamily: 'Nunito_300Light', color: colors.textMuted },
  wrongText: { fontSize: 14, fontFamily: 'Nunito_300Light', color: '#f87171', marginTop: -16 },
  dot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
  },
});

// ── Root ──────────────────────────────────────────────────────────────────────
export default function RootApp() {
  const [fontsLoaded] = useFonts({ Nunito_300Light, Nunito_600SemiBold, Nunito_800ExtraBold });
  if (!fontsLoaded) return null;
  return <SafeAreaProvider><App /></SafeAreaProvider>;
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const activeIndex = useRef(0);

  const journalRef = useRef<JournalHandle>(null);
  const [openDreamId, setOpenDreamId]           = useState<string | null>(null);
  const [fromNotification, setFromNotification] = useState(false);
  const [dreams, setDreams]                     = useState<Dream[]>([]);

  const pendingAction = useRef<(() => void) | null>(null);

  const [pinRequired, setPinRequired] = useState(false);
  const [pinLoading, setPinLoading]   = useState(true);
  const [savedPin, setSavedPin]       = useState<string | null>(null);

  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      try {
        const pin = await loadPin();
        if (pin) { setSavedPin(pin); setPinRequired(true); }
      } catch (e) {
        console.error('Startup error:', e);
      } finally {
        setPinLoading(false);
      }
    })();
  }, []);

  useEffect(() => { loadDreams().then(setDreams); }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response received:', response.notification.request.content.data);
      const type = response.notification.request.content.data?.type;
      if (type === 'reality-check') {
        const go = () => { navigateTo(TABS.indexOf('checks')); setFromNotification(true); };
        if (pinRequired) pendingAction.current = go;
        else go();
      }
    });
    return () => sub.remove();
  }, [pinRequired]);

  const navigateTo = (index: number) => {
    const tab = TABS[index];
    if (!tab) return;
    activeIndex.current = index;
    setActiveTab(tab);
    Animated.spring(translateX, {
      toValue: -index * SCREEN_W,
      useNativeDriver: true,
      overshootClamping: true,
      tension: 200,
      friction: 30,
    }).start();
  };

  const switchTab = (tab: Tab | string) => {
    const index = TABS.indexOf(tab as Tab);
    if (index < 0 || index === activeIndex.current) return;
    navigateTo(index);
  };

  const handleLogDream = () => {
    setOpenDreamId(null);
    journalRef.current?.openForm();
    switchTab('journal');
  };

  const handleDreamPress = (dream: Dream) => {
    setOpenDreamId(dream.id);
    switchTab('journal');
  };

  if (pinLoading) return null;

  if (pinRequired && savedPin) {
    return (
      <SafeAreaProvider style={{ flex: 1, backgroundColor: colors.background }}>
        <LockScreen
          savedPin={savedPin}
          onDone={() => {
            setPinRequired(false);
            if (pendingAction.current) {
              setTimeout(() => { pendingAction.current?.(); pendingAction.current = null; }, 50);
            }
          }}
        />
      </SafeAreaProvider>
    );
  }

  return (
    <View style={styles.root}>
      <StarField translateX={translateX} />
      <Animated.View style={[styles.strip, { transform: [{ translateX }] }]} pointerEvents="box-none">
        <View style={styles.screen}>
          <Index onLogDream={handleLogDream} onDreamPress={handleDreamPress} dreams={dreams} onDreamsChange={setDreams} />
        </View>
        <View style={styles.screen}>
          <Journal ref={journalRef} openDreamId={openDreamId} onDreamOpened={() => setOpenDreamId(null)} dreams={dreams} onDreamsChange={setDreams} />
        </View>
        <View style={styles.screen}>
          <Analytics dreams={dreams} onDreamsChange={setDreams} />
        </View>
        <View style={styles.screen}>
          <Checks fromNotification={fromNotification} onCheckDone={() => setFromNotification(false)} />
        </View>
        <View style={styles.screen}>
          <Settings onDataDeleted={() => setDreams([])} />
        </View>
      </Animated.View>
      <TabBar activeTab={activeTab} onTabPress={switchTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, flexDirection: 'column', backgroundColor: colors.background, overflow: 'hidden' },
  strip:  { flex: 1, flexDirection: 'row', width: SCREEN_W * TABS.length },
  screen: { width: SCREEN_W, flex: 1, overflow: 'hidden', backgroundColor: 'transparent' },
});