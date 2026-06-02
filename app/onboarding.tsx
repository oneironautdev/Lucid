import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Reanimated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Circle, Line, Path, Rect, Svg } from 'react-native-svg';
import { colors } from '../constants/colors';

const { width: W, height: H } = Dimensions.get('window');

// ── Star field ────────────────────────────────────────────────────────────────

const STAR_COUNT  = 60;
const FIELD_W     = W * 2.5;
const STAR_COLORS = ['#a78bfa','#7c6fd4','#c4baff','#6d5fc7','#ddd6fe','#9d8df1'];

interface StarDef {
  id: number; x: number; y: number; size: number;
  opacity: number; color: string;
  pulseAnim: Animated.Value; pulseDuration: number; pulseDelay: number;
}

const STARS: StarDef[] = Array.from({ length: STAR_COUNT }, (_, i) => ({
  id: i,
  x: Math.random() * FIELD_W,
  y: Math.random() * H,
  size: Math.random() * 2.8 + 1.2,
  opacity: Math.random() * 0.45 + 0.15,
  color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
  pulseAnim: new Animated.Value(1),
  pulseDuration: 1400 + Math.random() * 2600,
  pulseDelay: Math.random() * 3000,
}));

function StarField({ scrollX }: { scrollX: Animated.Value }) {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    STARS.forEach(star => {
      const loop = () => {
        Animated.sequence([
          Animated.delay(star.pulseDelay),
          Animated.timing(star.pulseAnim, { toValue: 1.7, duration: star.pulseDuration, useNativeDriver: true }),
          Animated.timing(star.pulseAnim, { toValue: 1,   duration: star.pulseDuration, useNativeDriver: true }),
        ]).start(loop);
      };
      loop();
    });
  }, []);

  const parallaxX = scrollX.interpolate({
    inputRange: [0, W * 4],
    outputRange: [0, -(FIELD_W - W) * 0.3],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, width: FIELD_W, height: '100%', transform: [{ translateX: parallaxX }], zIndex: 0 }}
    >
      {STARS.map(star => (
        <Animated.View
          key={star.id}
          style={{
            position: 'absolute', left: star.x, top: star.y,
            width: star.size, height: star.size, borderRadius: star.size / 2,
            backgroundColor: star.color, opacity: star.opacity,
            transform: [{ scale: star.pulseAnim }],
          }}
        />
      ))}
    </Animated.View>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────

function CloudIcon() {
  return (
    <Svg width={80} height={80} viewBox="0 0 80 80" fill="none">
      <Circle cx={40} cy={44} r={30} fill="rgba(167,139,250,0.07)" />
      <Path
        d="M58 50H24a13 13 0 0 1-2-25.8A18 18 0 0 1 52 28a13 13 0 0 1 13 13v9H58Z"
        fill="rgba(167,139,250,0.15)"
        stroke="rgba(167,139,250,0.5)"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <Circle cx={18} cy={22} r={1.5} fill="#a78bfa" opacity={0.6} />
      <Circle cx={62} cy={18} r={1} fill="#a78bfa" opacity={0.4} />
      <Circle cx={66} cy={36} r={1.8} fill="#a78bfa" opacity={0.5} />
      <Circle cx={14} cy={40} r={1.2} fill="#a78bfa" opacity={0.35} />
      <Circle cx={36} cy={16} r={1} fill="#a78bfa" opacity={0.5} />
      <Path
        d="M26 62 Q32 68 40 62 Q48 56 54 62"
        stroke="rgba(167,139,250,0.25)"
        strokeWidth={1.2}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

function LogIcon() {
  return (
    <Svg width={80} height={80} viewBox="0 0 80 80" fill="none">
      <Circle cx={40} cy={40} r={30} fill="rgba(167,139,250,0.07)" />
      <Rect x={22} y={18} width={36} height={44} rx={4} fill="rgba(167,139,250,0.12)" stroke="rgba(167,139,250,0.45)" strokeWidth={1.2} />
      <Line x1={30} y1={18} x2={30} y2={62} stroke="rgba(167,139,250,0.3)" strokeWidth={1} />
      <Line x1={35} y1={30} x2={51} y2={30} stroke="rgba(167,139,250,0.5)" strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={35} y1={37} x2={51} y2={37} stroke="rgba(167,139,250,0.35)" strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={35} y1={44} x2={46} y2={44} stroke="rgba(167,139,250,0.25)" strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M54 54 L62 46 L66 50 L58 58 Z" fill="rgba(167,139,250,0.3)" stroke="rgba(167,139,250,0.6)" strokeWidth={1} strokeLinejoin="round" />
      <Path d="M54 54 L52 58 L56 56 Z" fill="rgba(167,139,250,0.5)" />
    </Svg>
  );
}

function ChartIcon() {
  return (
    <Svg width={80} height={80} viewBox="0 0 80 80" fill="none">
      <Circle cx={40} cy={40} r={30} fill="rgba(167,139,250,0.07)" />
      <Rect x={20} y={46} width={10} height={16} rx={2} fill="rgba(167,139,250,0.25)" stroke="rgba(167,139,250,0.4)" strokeWidth={1} />
      <Rect x={34} y={34} width={10} height={28} rx={2} fill="rgba(167,139,250,0.35)" stroke="rgba(167,139,250,0.55)" strokeWidth={1} />
      <Rect x={48} y={22} width={10} height={40} rx={2} fill="rgba(167,139,250,0.5)" stroke="rgba(167,139,250,0.7)" strokeWidth={1} />
      <Path d="M25 44 L39 32 L53 20" stroke="#a78bfa" strokeWidth={1.5} strokeLinecap="round" strokeDasharray="3 2" fill="none" />
      <Circle cx={53} cy={20} r={2.5} fill="#a78bfa" opacity={0.8} />
      <Line x1={16} y1={64} x2={64} y2={64} stroke="rgba(167,139,250,0.2)" strokeWidth={1} />
    </Svg>
  );
}

function LockIcon() {
  return (
    <Svg width={80} height={80} viewBox="0 0 80 80" fill="none">
      <Circle cx={40} cy={40} r={30} fill="rgba(167,139,250,0.07)" />
      <Path d="M28 36 V28 a12 12 0 0 1 24 0 V36" stroke="rgba(167,139,250,0.55)" strokeWidth={2} strokeLinecap="round" fill="none" />
      <Rect x={22} y={36} width={36} height={26} rx={5} fill="rgba(167,139,250,0.15)" stroke="rgba(167,139,250,0.5)" strokeWidth={1.2} />
      <Circle cx={40} cy={48} r={4} fill="rgba(167,139,250,0.4)" stroke="rgba(167,139,250,0.7)" strokeWidth={1} />
      <Path d="M38 52 L42 52 L41 57 L39 57 Z" fill="rgba(167,139,250,0.4)" />
      <Circle cx={62} cy={28} r={1.2} fill="#a78bfa" opacity={0.5} />
      <Circle cx={18} cy={32} r={1.5} fill="#a78bfa" opacity={0.4} />
      <Circle cx={64} cy={50} r={1} fill="#a78bfa" opacity={0.35} />
    </Svg>
  );
}

// ── Slide data ─────────────────────────────────────────────────────────────────

// null icon = welcome slide
const SLIDES = [
  {
    icon: null,
    title: null,
    body: null,
  },
  {
    icon: <CloudIcon />,
    title: 'Lucid dreaming',
    body: "A lucid dream is when you realize you're dreaming while it's happening. You stay asleep, but you're aware. Some people can even take control.\n\nIt sounds rare, but it's a skill you can actually build.",
  },
  {
    icon: <LogIcon />,
    title: 'Log fast',
    body: "Dreams disappear within minutes of waking up. The longer you wait, the less you'll remember.\n\nEven a few words jotted down right away is enough. Over time, your brain gets better at holding onto them.",
  },
  {
    icon: <ChartIcon />,
    title: 'What Lucid tracks',
    body: "Your dream journal, logging streak, and daily reality checks all feed into the analytics tab.\n\nOver time it'll show you patterns, like which nights produce the clearest dreams and whether your habits are actually helping.",
  },
  {
    icon: <LockIcon />,
    title: 'Your data stays here',
    body: "Everything is stored on your device. No accounts, no cloud, no servers. Nothing leaves unless you export it yourself.\n\nIf you have questions, check the FAQ inside Settings.",
  },
];

// ── Pill indicator ──────────────────────────────────────────────────────────────

function Pill({ index, scrollX }: { index: number; scrollX: Reanimated.SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const input = [( index - 1) * W, index * W, (index + 1) * W];
    const width   = interpolate(scrollX.value, input, [6, 24, 6],   Extrapolation.CLAMP);
    const opacity = interpolate(scrollX.value, input, [0.3, 1, 0.3], Extrapolation.CLAMP);
    return { width, opacity };
  });

  return <Reanimated.View style={[pillStyles.pill, style]} />;
}

function PillIndicator({ count, scrollX }: { count: number; scrollX: Reanimated.SharedValue<number> }) {
  return (
    <View style={pillStyles.row}>
      {Array.from({ length: count }).map((_, i) => (
        <Pill key={i} index={i} scrollX={scrollX} />
      ))}
    </View>
  );
}

const pillStyles = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pill: { height: 6, borderRadius: 3, backgroundColor: '#a78bfa' },
});

// ── Main component ───────────────────────────────────────────────────────────────

interface OnboardingProps {
  onDone: () => void;
}

export default function Onboarding({ onDone }: OnboardingProps) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useSharedValue(0); // drives pills on UI thread
  const scrollXAnim = useRef(new Animated.Value(0)).current; // drives star parallax

  // Welcome slide entrance
  const logoScale   = useRef(new Animated.Value(0.8)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslY = useRef(new Animated.Value(12)).current;

  // Bottom bar entrance
  const barOpacity  = useRef(new Animated.Value(0)).current;
  const barTranslY  = useRef(new Animated.Value(16)).current;

  // Screen exit
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenTranslY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(100),
      Animated.parallel([
        Animated.spring(logoScale,   { toValue: 1, useNativeDriver: true, tension: 100, friction: 10 }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
    Animated.sequence([
      Animated.delay(340),
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(textTranslY, { toValue: 0, duration: 380, useNativeDriver: true }),
      ]),
    ]).start();
    // Bottom bar slides up after welcome text
    Animated.sequence([
      Animated.delay(500),
      Animated.parallel([
        Animated.timing(barOpacity,  { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(barTranslY,  { toValue: 0, duration: 320, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const exitAndDone = () => {
    Animated.parallel([
      Animated.timing(screenOpacity, { toValue: 0, duration: 260, useNativeDriver: true }),
      Animated.timing(screenTranslY, { toValue: -20, duration: 260, useNativeDriver: true }),
    ]).start(() => onDone());
  };

  const goTo = (i: number) => {
    setIndex(i);
    scrollRef.current?.scrollTo({ x: i * W, animated: true });
  };

  const handleNext = () => {
    if (index < SLIDES.length - 1) goTo(index + 1);
    else exitAndDone();
  };

  const handleScroll = (e: any) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / W);
    if (i !== index) setIndex(i);
  };

  const isLast  = index === SLIDES.length - 1;
  const isFirst = index === 0;

  return (
    <Animated.View style={[styles.root, { paddingBottom: insets.bottom, opacity: screenOpacity, transform: [{ translateY: screenTranslY }] }]}>

      <StarField scrollX={scrollXAnim} />

      {/* Skip, hidden on first and last slides */}
      {!isFirst && !isLast && (
        <TouchableOpacity style={[styles.skipBtn, { top: insets.top + 16 }]} onPress={exitAndDone}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={{ flex: 1, zIndex: 1 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollXAnim } } }],
          {
            useNativeDriver: true,
            listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
              scrollX.value = e.nativeEvent.contentOffset.x;
            },
          }
        )}
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={styles.slide}>
            {i === 0 ? (
              <View style={styles.welcomeContent}>
                <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }], alignItems: 'center' }}>
                  <View style={styles.welcomeIconWrap}>
                    <Image
                      source={require('../assets/images/icon.png')}
                      style={styles.welcomeIcon}
                      resizeMode="cover"
                    />
                  </View>
                </Animated.View>
                <Animated.View style={{ alignItems: 'center', gap: 10, opacity: textOpacity, transform: [{ translateY: textTranslY }] }}>
                  <Text style={styles.welcomeTitle}>Lucid</Text>
                  <Text style={styles.welcomeSub}>Your dream journal and lucid dreaming companion.</Text>
                  <Text style={styles.welcomeHint}>Swipe to learn how it works</Text>
                </Animated.View>
              </View>
            ) : (
              <View style={styles.slideContent}>
                <View style={styles.iconWrap}>
                  {slide.icon}
                </View>
                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.body}>{slide.body}</Text>
              </View>
            )}
          </View>
        ))}
      </Animated.ScrollView>

      {/* Bottom bar, slides up on load */}
      <Animated.View style={[styles.bottom, { opacity: barOpacity, transform: [{ translateY: barTranslY }] }]}>
        <PillIndicator count={SLIDES.length} scrollX={scrollX} />
        <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
          <Text style={styles.nextText}>{isLast ? 'Get started' : isFirst ? "Let's go" : 'Next'}</Text>
        </TouchableOpacity>
      </Animated.View>

    </Animated.View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },

  skipBtn: {
    position: 'absolute',
    right: 24,
    zIndex: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  skipText: {
    fontSize: 13,
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textMuted,
  },

  slide: {
    width: W,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Welcome slide
  welcomeContent: {
    alignItems: 'center',
    gap: 32,
    paddingHorizontal: 36,
  },
  welcomeIconWrap: {
    width: 110,
    height: 110,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.35)',
    shadowColor: '#a78bfa',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  welcomeIcon: {
    width: 110,
    height: 110,
  },
  welcomeTitle: {
    fontSize: 38,
    fontFamily: 'Nunito_800ExtraBold',
    color: colors.textPrimary,
    letterSpacing: 4,
  },
  welcomeSub: {
    fontSize: 16,
    fontFamily: 'Nunito_300Light',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
  },
  welcomeHint: {
    fontSize: 12,
    fontFamily: 'Nunito_300Light',
    color: 'rgba(255,255,255,0.2)',
    marginTop: 8,
    letterSpacing: 0.3,
  },

  // Regular slides
  slideContent: {
    alignItems: 'center',
    paddingHorizontal: 36,
    gap: 24,
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 32,
    backgroundColor: 'rgba(167,139,250,0.07)',
    borderWidth: 0.5,
    borderColor: 'rgba(167,139,250,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontFamily: 'Nunito_800ExtraBold',
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  body: {
    fontSize: 15,
    fontFamily: 'Nunito_300Light',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
  },

  // Bottom bar
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingVertical: 24,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.06)',
    zIndex: 1,
  },
  nextBtn: {
    backgroundColor: colors.primaryPurple,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  nextText: {
    fontSize: 15,
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textPrimary,
  },
});