import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Circle, Ellipse, Path, Svg } from 'react-native-svg';
import { colors } from '../constants/colors';
import { RealityCheck, saveChecks } from '../utils/storage';

interface Technique {
  id: string;
  name: string;
  instruction: string;
  detail: string;
  icon: React.ReactNode;
}

const HandIcon = () => (
  <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
    <Circle cx={20} cy={20} r={19} stroke="rgba(167,139,250,0.3)" strokeWidth={1} />
    {/* Phosphor "hand-palm" — viewBox 256x256, scaled to 36x36, offset 2,2 */}
    <Path
      transform="translate(2,2) scale(0.140625)"
      d="M188,88a27.75,27.75,0,0,0-12,2.71V60a28,28,0,0,0-41.36-24.6A28,28,0,0,0,80,44v6.71A27.75,27.75,0,0,0,68,48,28,28,0,0,0,40,76v76a88,88,0,0,0,176,0V116A28,28,0,0,0,188,88Zm12,64a72,72,0,0,1-144,0V76a12,12,0,0,1,24,0v44a8,8,0,0,0,16,0V44a12,12,0,0,1,24,0v68a8,8,0,0,0,16,0V60a12,12,0,0,1,24,0v68.67A48.08,48.08,0,0,0,120,176a8,8,0,0,0,16,0,32,32,0,0,1,32-32,8,8,0,0,0,8-8V116a12,12,0,0,1,24,0Z"
      fill="rgba(167,139,250,0.2)"
      stroke="rgba(167,139,250,0.75)"
      strokeWidth={6}
    />
  </Svg>
);

const NoseIcon = () => (
  <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
    <Circle cx={20} cy={20} r={19} stroke="rgba(167,139,250,0.3)" strokeWidth={1} />
    {/* Phosphor "smiley" — clean happy face, represents the nose pinch check */}
    <Path
      transform="translate(2,2) scale(0.140625)"
      d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216ZM80,108a12,12,0,1,1,12,12A12,12,0,0,1,80,108Zm96,0a12,12,0,1,1-12-12A12,12,0,0,1,176,108Zm-1.07,48c-10.29,17.86-28.18,28-46.93,28s-36.64-10.14-46.93-28a8,8,0,1,1,13.86-8c7.47,12.91,20.4,20,33.07,20s25.6-7.09,33.07-20a8,8,0,0,1,13.86,8Z"
      fill="rgba(167,139,250,0.2)"
      stroke="rgba(167,139,250,0.75)"
      strokeWidth={6}
    />
  </Svg>
);

const TextCheckIcon = () => (
  <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
    <Circle cx={20} cy={20} r={19} stroke="rgba(167,139,250,0.3)" strokeWidth={1} />
    {/* Phosphor "article" — viewBox 256x256, scaled to 36x36, offset 2,2 */}
    <Path
      transform="translate(2,2) scale(0.140625)"
      d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,160H40V56H216V200ZM184,96a8,8,0,0,1-8,8H80a8,8,0,0,1,0-16H176A8,8,0,0,1,184,96Zm0,32a8,8,0,0,1-8,8H80a8,8,0,0,1,0-16H176A8,8,0,0,1,184,128Zm0,32a8,8,0,0,1-8,8H80a8,8,0,0,1,0-16H176A8,8,0,0,1,184,160Z"
      fill="rgba(167,139,250,0.2)"
      stroke="rgba(167,139,250,0.75)"
      strokeWidth={6}
    />
  </Svg>
);

const ClockIcon = () => (
  <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
    <Circle cx={20} cy={20} r={19} stroke="rgba(167,139,250,0.3)" strokeWidth={1} />
    {/* Phosphor "clock" — viewBox 256x256, scaled to 36x36, offset 2,2 */}
    <Path
      transform="translate(2,2) scale(0.140625)"
      d="M128,24a104,104,0,1,0,104,104A104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z"
      fill="rgba(167,139,250,0.2)"
      stroke="rgba(167,139,250,0.75)"
      strokeWidth={6}
    />
  </Svg>
);

const FingerIcon = () => (
  <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
    <Circle cx={20} cy={20} r={19} stroke="rgba(167,139,250,0.3)" strokeWidth={1} />
    {/* Phosphor "hand-pointing" — viewBox 256x256, scaled to 36x36, offset 2,2 */}
    <Path
      transform="translate(2,2) scale(0.140625)"
      d="M196,88a27.86,27.86,0,0,0-13.35,3.39A28,28,0,0,0,144,74.7V44a28,28,0,0,0-56,0v80l-3.82-6.13A28,28,0,0,0,35.73,146l4.67,8.23C74.81,214.89,89.05,240,136,240a88.1,88.1,0,0,0,88-88V116A28,28,0,0,0,196,88Zm12,64a72.08,72.08,0,0,1-72,72c-37.63,0-47.84-18-81.68-77.68l-4.69-8.27,0-.05A12,12,0,0,1,54,121.61a11.88,11.88,0,0,1,6-1.6,12,12,0,0,1,10.41,6,1.76,1.76,0,0,0,.14.23l18.67,30A8,8,0,0,0,104,152V44a12,12,0,0,1,24,0v68a8,8,0,0,0,16,0V100a12,12,0,0,1,24,0v20a8,8,0,0,0,16,0v-4a12,12,0,0,1,24,0Z"
      fill="rgba(167,139,250,0.2)"
      stroke="rgba(167,139,250,0.75)"
      strokeWidth={6}
    />
  </Svg>
);

const MirrorIcon = () => (
  <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
    <Circle cx={20} cy={20} r={19} stroke="rgba(167,139,250,0.3)" strokeWidth={1} />
    {/* Phosphor "user-circle" — person inside a circle, naturally fits the icon boundary */}
    <Path
      transform="translate(2,2) scale(0.140625)"
      d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24ZM74.08,197.5a64,64,0,0,1,107.84,0,87.83,87.83,0,0,1-107.84,0ZM96,120a32,32,0,1,1,32,32A32,32,0,0,1,96,120Zm97.76,66.41a79.66,79.66,0,0,0-36.06-28.56,48,48,0,1,0-59.4,0,79.66,79.66,0,0,0-36.06,28.56,88,88,0,1,1,131.52,0Z"
      fill="rgba(167,139,250,0.2)"
      stroke="rgba(167,139,250,0.75)"
      strokeWidth={6}
    />
  </Svg>
);

const LightIcon = () => (
  <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
    <Circle cx={20} cy={20} r={19} stroke="rgba(167,139,250,0.3)" strokeWidth={1} />
    {/* Phosphor "lightbulb" — viewBox 256x256, scaled to 36x36, offset 2,2 */}
    <Path
      transform="translate(2,2) scale(0.140625)"
      d="M176,232a8,8,0,0,1-8,8H88a8,8,0,0,1,0-16h80A8,8,0,0,1,176,232Zm40-128a87.55,87.55,0,0,1-33.64,69.21A16.24,16.24,0,0,0,176,186v6a16,16,0,0,1-16,16H96a16,16,0,0,1-16-16v-6a16,16,0,0,0-6.23-12.66A87.59,87.59,0,0,1,40,104.49C39.74,56.83,78.26,17.14,125.88,16A88,88,0,0,1,216,104Zm-16,0a72,72,0,0,0-73.74-72c-39,.92-70.47,33.39-70.26,72.39a71.65,71.65,0,0,0,27.26,56.62A32,32,0,0,1,96,186v6h64v-6a32.15,32.15,0,0,1,12.47-25.35A71.65,71.65,0,0,0,200,104Z"
      fill="rgba(167,139,250,0.2)"
      stroke="rgba(167,139,250,0.75)"
      strokeWidth={6}
    />
  </Svg>
);

const JumpIcon = () => (
  <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
    <Circle cx={20} cy={20} r={19} stroke="rgba(167,139,250,0.3)" strokeWidth={1} />
    {/* Phosphor "person-simple" — clean standing figure */}
    <Path
      transform="translate(0,2.5) scale(0.15625)"
      d="M128,80a32,32,0,1,0-32-32A32,32,0,0,0,128,80Zm0-48a16,16,0,1,1-16,16A16,16,0,0,1,128,32Zm61.66,90.17a8,8,0,0,1-10.83,3.17L152,109.45V208a8,8,0,0,1-16,0V160H120v48a8,8,0,0,1-16,0V109.45l-26.83,15.89a8,8,0,1,1-8-13.88l32.54-19.27A24,24,0,0,1,114,88h28a24,24,0,0,1,12.29,4.19l32.54,19.27A8,8,0,0,1,189.66,122.17Z"
      fill="rgba(167,139,250,0.2)"
      stroke="rgba(167,139,250,0.75)"
      strokeWidth={6}
    />
  </Svg>
);

const EyeIcon = () => (
  <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
    <Ellipse cx={14} cy={14} rx={11} ry={7} stroke="rgba(167,139,250,0.7)" strokeWidth={1.5} fill="none" />
    <Circle cx={14} cy={14} r={3.5} fill="rgba(167,139,250,0.3)" stroke="rgba(167,139,250,0.8)" strokeWidth={1.2} />
    <Circle cx={15.2} cy={12.8} r={1} fill="rgba(167,139,250,0.9)" />
  </Svg>
);

const MoonIcon = () => (
  <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
    <Path
      d="M18 6 C14 6 9 10 9 15 C9 20 13 24 18 24 C20 24 22 23 23 22 C20 22 15 19 15 15 C15 11 18 8 22 7 C21 6.4 19.5 6 18 6Z"
      fill="rgba(167,139,250,0.25)" stroke="rgba(167,139,250,0.7)" strokeWidth={1.2} strokeLinejoin="round"
    />
    <Circle cx={21} cy={10} r={1} fill="rgba(167,139,250,0.5)" />
    <Circle cx={23} cy={14} r={0.7} fill="rgba(167,139,250,0.4)" />
  </Svg>
);

const TECHNIQUES: Technique[] = [
  {
    id: 'hands',
    name: 'Hand Check',
    instruction: 'Look at both of your hands.',
    detail: "In dreams, hands are almost always wrong, extra fingers, melting edges, blurry details. Count every finger on both hands slowly. If anything is off, you're dreaming.",
    icon: <HandIcon />,
  },
  {
    id: 'nose',
    name: 'Nose Pinch',
    instruction: 'Pinch your nose closed and try to breathe.',
    detail: "Hold your nose completely shut. Try to inhale through it. In reality this is impossible. In a dream, air passes through anyway. If you can breathe, you're dreaming.",
    icon: <NoseIcon />,
  },
  {
    id: 'text',
    name: 'Text Check',
    instruction: 'Find something with text. Read it twice.',
    detail: "Look at any sign, label, or screen. Look away. Look back. In a dream, text almost always changes, scrambles, or becomes unreadable the second time. If it's different, you're dreaming.",
    icon: <TextCheckIcon />,
  },
  {
    id: 'clock',
    name: 'Clock Check',
    instruction: 'Look at a clock. Look away. Look back.',
    detail: "Check the time. Look away for a moment. Look again. Dream clocks display impossible times, jump wildly, or have no hands at all. If the time changed drastically, you're dreaming.",
    icon: <ClockIcon />,
  },
  {
    id: 'finger',
    name: 'Finger Through Palm',
    instruction: 'Push your index finger into your opposite palm.',
    detail: "Press your finger against your palm like you're trying to push it through. Use actual force. In waking life, nothing happens. In a dream, your finger will often pass through. If it does, you're dreaming.",
    icon: <FingerIcon />,
  },
  {
    id: 'mirror',
    name: 'Mirror Check',
    instruction: 'Find a reflective surface. Look at yourself.',
    detail: "Approach a mirror, window, or any reflection. Dream reflections are often delayed, distorted, or show someone else entirely. Move your hand, does the reflection keep up? If something's wrong, you're dreaming.",
    icon: <MirrorIcon />,
  },
  {
    id: 'light',
    name: 'Light Switch',
    instruction: 'Find a light switch. Flip it.',
    detail: "Dream environments don't respond to light switches the way reality does. Lights may brighten randomly, do nothing, or dim when they should brighten. If the light doesn't respond normally, you're dreaming.",
    icon: <LightIcon />,
  },
  {
    id: 'jump',
    name: 'Gravity Check',
    instruction: 'Jump. Notice how you land.',
    detail: "Take a small jump. Pay attention to the feeling of coming back down. In dreams, gravity often feels lighter, landings feel floaty or delayed, or you might not come down at all. If it feels wrong, you're dreaming.",
    icon: <JumpIcon />,
  },
];

function getRandomTechnique(): Technique {
  return TECHNIQUES[Math.floor(Math.random() * TECHNIQUES.length)];
}

const PRESENCE_LABELS = ['Distracted', 'Partial', 'Present', 'Sharp', 'Fully here'];

interface Props {
  fromNotification?: boolean;
  onCheckDone?: () => void;
  checks: RealityCheck[];
  onChecksChange: (checks: RealityCheck[]) => void;
}

export default function Checks({ fromNotification, onCheckDone, checks, onChecksChange }: Props) {
  const [technique, setTechnique] = useState<Technique>(getRandomTechnique);
  const [presence, setPresence]   = useState(1);
  const [answered, setAnswered]   = useState<'awake' | 'lucid_suspected' | null>(null);
  const [done, setDone]           = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const prevTech = useRef(technique.id);

  // Pick random technique from notification
  useEffect(() => {
    if (fromNotification) {
      const t = getRandomTechnique();
      setTechnique(t);
      setPresence(1);
      setAnswered(null);
      setDone(false);
    }
  }, [fromNotification]);

  useEffect(() => {
    if (prevTech.current === technique.id) return;
    prevTech.current = technique.id;
    fadeAnim.setValue(0.3);
    Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [technique]);

  // ── Today strip data ─────────────────────────────────────────────────────
  const todayStats = useMemo(() => {
    const now = new Date();
    const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const todayChecks = checks.filter(c => {
      const d = new Date(c.timestamp);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return iso === todayISO;
    });

    // Streak: consecutive days with checks
    const daySet = new Set(checks.map(c => {
      const d = new Date(c.timestamp);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }));
    let streak = 0;
    const cursor = new Date(now);
    cursor.setHours(0, 0, 0, 0);
    // Allow today to count even without check yet
    if (!daySet.has(todayISO)) cursor.setDate(cursor.getDate() - 1);
    while (true) {
      const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      if (!daySet.has(iso)) break;
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    return { count: todayChecks.length, streak };
  }, [checks]);

  const reset = () => {
    setPresence(1);
    setAnswered(null);
    setDone(false);
    setTechnique(getRandomTechnique());
    onCheckDone?.();
  };

  const handleConfirm = async () => {
    if (answered === null || presence < 1) return;

    const newCheck: RealityCheck = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      techniqueId: technique.id,
      result: answered,
      presence,
    };

    const updated = [newCheck, ...checks];
    onChecksChange(updated);
    await saveChecks(updated);
    setDone(true);
  };

  if (done) {
    return (
      <View style={styles.root}>
        <View style={styles.doneContainer}>
          <Svg width={56} height={56} viewBox="0 0 56 56" fill="none">
            <Circle cx={28} cy={28} r={27} fill="rgba(91,79,212,0.15)" stroke="rgba(167,139,250,0.4)" strokeWidth={1} />
            <Path d="M18 28 L24 34 L38 20" stroke="#a78bfa" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </Svg>
          <Text style={styles.doneTitle}>
            {answered === 'lucid_suspected' ? "You're dreaming." : "You're awake."}
          </Text>
          <Text style={styles.doneSubtitle}>
            {answered === 'lucid_suspected'
              ? 'Stay calm. Try to stabilise by rubbing your hands together and focusing on the dream.'
              : 'Good. Every check you do awake trains your dreaming mind to do the same.'}
          </Text>
          <TouchableOpacity style={styles.anotherBtn} onPress={reset}>
            <Text style={styles.anotherBtnText}>Do another check</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.pageTitle}>Reality Check</Text>
          <TouchableOpacity style={styles.shuffleBtn} onPress={reset}>
            <Ionicons name="shuffle-outline" size={20} color={colors.lightPurple} />
          </TouchableOpacity>
        </View>

        {/* ── Today strip ── */}
        <View style={styles.todayStrip}>
          <View style={styles.todayStat}>
            <Text style={styles.todayNum}>{todayStats.count}</Text>
            <Text style={styles.todayLabel}>today</Text>
          </View>
          <View style={styles.todayDivider} />
          <View style={styles.todayStat}>
            <Text style={styles.todayNum}>{todayStats.streak}</Text>
            <Text style={styles.todayLabel}>{todayStats.streak === 1 ? 'day streak' : 'day streak'}</Text>
          </View>
          {todayStats.count === 0 && (
            <Text style={styles.todayHint}>No checks yet today</Text>
          )}
        </View>

        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={styles.techniqueCard}>
            <View style={styles.techniqueIconWrap}>
              {technique.icon}
            </View>
            <Text style={styles.techniqueName}>{technique.name}</Text>
            <Text style={styles.techniqueInstruction}>{technique.instruction}</Text>
            <View style={styles.divider} />
            <Text style={styles.techniqueDetail}>{technique.detail}</Text>
          </View>
        </Animated.View>

          <Text style={styles.sectionLabel}>WHAT'S THE VERDICT?</Text>
          <View style={styles.answerRow}>
            <TouchableOpacity
              style={[styles.answerBtn, answered === 'awake' && styles.answerBtnActive]}
              onPress={() => setAnswered('awake')}
              activeOpacity={0.75}
            >
              <EyeIcon />
              <Text style={[styles.answerBtnText, answered === 'awake' && styles.answerBtnTextActive]}>I'm awake</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.answerBtn, styles.answerBtnDream, answered === 'lucid_suspected' && styles.answerBtnDreamActive]}
              onPress={() => setAnswered('lucid_suspected')}
              activeOpacity={0.75}
            >
              <MoonIcon />
              <Text style={[styles.answerBtnText, answered === 'lucid_suspected' && styles.answerBtnTextActive]}>I'm dreaming</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 28 }]}>HOW PRESENT WERE YOU?</Text>
          <Text style={styles.presenceHint}>Did you actually do the check, or just tap through?</Text>
          <View style={styles.presenceRow}>
            {[1,2,3,4,5].map(n => (
              <TouchableOpacity
                key={n}
                style={[styles.presenceBtn, presence === n && styles.presenceBtnOn]}
                onPress={() => setPresence(n)}
                activeOpacity={0.7}
              >
                <View style={[styles.presenceDot, presence >= n && styles.presenceDotOn]}>
                  {presence === n && <View style={styles.presenceDotGlow} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.presenceLabel}>{PRESENCE_LABELS[presence - 1]}</Text>

          {answered !== null && (
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={handleConfirm}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color={colors.textPrimary} />
              <Text style={styles.confirmBtnText}>Confirm check</Text>
            </TouchableOpacity>
          )}

        <Text style={[styles.sectionLabel, { marginTop: 36 }]}>ALL TECHNIQUES</Text>
        <View style={styles.techniqueList}>
          {TECHNIQUES.map(t => (
            <TouchableOpacity
              key={t.id}
              style={[styles.techniqueRow, technique.id === t.id && styles.techniqueRowActive]}
              onPress={() => { setTechnique(t); setPresence(1); setAnswered(null); setDone(false); }}
              activeOpacity={0.7}
            >
              <View style={styles.techniqueRowIcon}>{t.icon}</View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.techniqueRowName, technique.id === t.id && styles.techniqueRowNameActive]}>
                  {t.name}
                </Text>
                <Text style={styles.techniqueRowInstruction} numberOfLines={1}>{t.instruction}</Text>
              </View>
              {technique.id === t.id && (
                <Ionicons name="checkmark-circle" size={18} color={colors.lightPurple} />
              )}
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  scrollContent: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 120 },

  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },

  todayStrip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(167,139,250,0.07)',
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.18)',
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 20,
    marginBottom: 28, gap: 0,
  },
  todayStat: { flex: 1, alignItems: 'center' },
  todayNum: { fontSize: 22, fontFamily: 'Nunito_800ExtraBold', color: colors.lightPurple },
  todayLabel: { fontSize: 11, fontFamily: 'Nunito_300Light', color: colors.textMuted, marginTop: 2 },
  todayDivider: { width: 0.5, height: 32, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 8 },
  todayHint: {
    flex: 2, fontSize: 12, fontFamily: 'Nunito_300Light',
    color: 'rgba(255,255,255,0.2)', fontStyle: 'italic', textAlign: 'right',
  },
  pageTitle: { fontSize: 28, fontWeight: '700', fontFamily: 'Nunito_800ExtraBold', color: colors.textPrimary },
  shuffleBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(167,139,250,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },

  sectionLabel: {
    fontSize: 11, color: colors.textMuted, letterSpacing: 1,
    fontFamily: 'Nunito_600SemiBold', marginBottom: 12,
  },

  techniqueCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 32,
  },
  techniqueIconWrap: { marginBottom: 16 },
  techniqueName: { fontSize: 22, fontWeight: '700', fontFamily: 'Nunito_800ExtraBold', color: colors.textPrimary, marginBottom: 8 },
  techniqueInstruction: {
    fontSize: 16, fontFamily: 'Nunito_600SemiBold', color: colors.lightPurple,
    textAlign: 'center', lineHeight: 22,
  },
  divider: {
    width: '100%', height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 16,
  },
  techniqueDetail: {
    fontSize: 14, fontFamily: 'Nunito_300Light', color: colors.textMuted,
    textAlign: 'center', lineHeight: 22,
  },

  answerRow: { flexDirection: 'row', gap: 12 },
  answerBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14, paddingVertical: 18, gap: 8,
  },
  answerBtnActive: {
    backgroundColor: 'rgba(91,79,212,0.25)',
    borderColor: colors.lightPurple,
  },
  answerBtnDream: {},
  answerBtnDreamActive: {
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderColor: colors.lightPurple,
  },
  answerBtnText: { fontSize: 14, fontFamily: 'Nunito_600SemiBold', color: colors.textMuted },
  answerBtnTextActive: { color: colors.textPrimary },

  presenceHint: { fontSize: 13, fontFamily: 'Nunito_300Light', color: 'rgba(255,255,255,0.25)', marginBottom: 14 },
  presenceRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  presenceBtn: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)',
  },
  presenceBtnOn: {
    backgroundColor: 'rgba(91,79,212,0.2)',
    borderColor: 'rgba(167,139,250,0.5)',
  },
  presenceDot: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  presenceDotOn: { backgroundColor: colors.primaryPurple },
  presenceDotGlow: {
    position: 'absolute',
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(167,139,250,0.25)',
  },
  presenceLabel: {
    marginTop: 10, fontSize: 13, fontFamily: 'Nunito_300Light',
    color: colors.lightPurple,
  },

  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 24,
    backgroundColor: colors.primaryPurple,
    borderRadius: 12, padding: 16,
  },
  confirmBtnText: { fontSize: 16, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', color: colors.textPrimary },

  doneContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 32,
  },
  doneTitle: {
    fontSize: 26, fontWeight: '700', fontFamily: 'Nunito_800ExtraBold',
    color: colors.textPrimary, marginTop: 24, marginBottom: 12, textAlign: 'center',
  },
  doneSubtitle: {
    fontSize: 15, fontFamily: 'Nunito_300Light', color: colors.textMuted,
    textAlign: 'center', lineHeight: 22, marginBottom: 36,
  },
  anotherBtn: {
    backgroundColor: 'rgba(91,79,212,0.3)', borderRadius: 12,
    borderWidth: 0.5, borderColor: colors.lightPurple,
    paddingVertical: 14, paddingHorizontal: 32,
  },
  anotherBtnText: { fontSize: 15, fontFamily: 'Nunito_600SemiBold', color: colors.lightPurple },

  techniqueList: { gap: 8, marginBottom: 20 },
  techniqueRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12, padding: 12,
  },
  techniqueRowActive: {
    backgroundColor: 'rgba(91,79,212,0.15)',
    borderColor: 'rgba(167,139,250,0.3)',
  },
  techniqueRowIcon: { width: 40 },
  techniqueRowName: { fontSize: 15, fontFamily: 'Nunito_600SemiBold', color: colors.textPrimary, marginBottom: 2 },
  techniqueRowNameActive: { color: colors.lightPurple },
  techniqueRowInstruction: { fontSize: 12, fontFamily: 'Nunito_300Light', color: colors.textMuted },
});