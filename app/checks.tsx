import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Circle, Ellipse, Line, Path, Rect, Svg } from 'react-native-svg';
import { colors } from '../constants/colors';

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
    <Path d="M13 26 C13 30 27 30 27 26 L27 18 C27 16.3 25.7 15 24 15 L24 12 C24 10.9 23.1 10 22 10 C20.9 10 20 10.9 20 12 L20 11 C20 9.9 19.1 9 18 9 C16.9 9 16 9.9 16 11 L16 12 C16 10.9 15.1 10 14 10 C12.9 10 12 10.9 12 12 L12 20 L11 19 C10.4 18.4 9.4 18.5 8.9 19.2 C8.5 19.8 8.6 20.6 9.1 21.1 L13 26Z"
      fill="rgba(167,139,250,0.2)" stroke="rgba(167,139,250,0.6)" strokeWidth={1} strokeLinejoin="round" />
  </Svg>
);

const NoseIcon = () => (
  <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
    <Circle cx={20} cy={20} r={19} stroke="rgba(167,139,250,0.3)" strokeWidth={1} />
    <Path d="M20 9 C20 9 17 14 17 19 C17 22 15 23 15 25 C15 27 17 28 20 28 C23 28 25 27 25 25 C25 23 23 22 23 19 C23 14 20 9 20 9Z"
      fill="rgba(167,139,250,0.2)" stroke="rgba(167,139,250,0.6)" strokeWidth={1} strokeLinejoin="round" />
    <Path d="M16 25 C16 25 14 26 14 27.5 C14 29 16 30 20 30 C24 30 26 29 26 27.5 C26 26 24 25 24 25"
      stroke="rgba(167,139,250,0.4)" strokeWidth={1} fill="none" strokeLinecap="round" />
  </Svg>
);

const TextCheckIcon = () => (
  <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
    <Circle cx={20} cy={20} r={19} stroke="rgba(167,139,250,0.3)" strokeWidth={1} />
    <Rect x={10} y={12} width={20} height={16} rx={2} fill="rgba(167,139,250,0.15)" stroke="rgba(167,139,250,0.5)" strokeWidth={1} />
    <Line x1={13} y1={17} x2={27} y2={17} stroke="rgba(167,139,250,0.6)" strokeWidth={1.2} strokeLinecap="round" />
    <Line x1={13} y1={20} x2={27} y2={20} stroke="rgba(167,139,250,0.6)" strokeWidth={1.2} strokeLinecap="round" />
    <Line x1={13} y1={23} x2={21} y2={23} stroke="rgba(167,139,250,0.6)" strokeWidth={1.2} strokeLinecap="round" />
  </Svg>
);

const ClockIcon = () => (
  <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
    <Circle cx={20} cy={20} r={19} stroke="rgba(167,139,250,0.3)" strokeWidth={1} />
    <Circle cx={20} cy={20} r={10} fill="rgba(167,139,250,0.15)" stroke="rgba(167,139,250,0.5)" strokeWidth={1} />
    <Line x1={20} y1={20} x2={20} y2={13} stroke="rgba(167,139,250,0.8)" strokeWidth={1.5} strokeLinecap="round" />
    <Line x1={20} y1={20} x2={25} y2={22} stroke="rgba(167,139,250,0.8)" strokeWidth={1.5} strokeLinecap="round" />
    <Circle cx={20} cy={20} r={1.5} fill="rgba(167,139,250,0.9)" />
  </Svg>
);

const FingerIcon = () => (
  <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
    <Circle cx={20} cy={20} r={19} stroke="rgba(167,139,250,0.3)" strokeWidth={1} />
    <Path d="M10 22 L10 18 C10 17 11 16 12 16 C13 16 14 17 14 18 L14 20 L18 20 C18 18 19 14 20 14 C21 14 21 18 21 20 L25 20 L25 18 C25 17 26 16 27 16 C28 16 29 17 29 18 L29 22 C29 25 27 27 25 27 L15 27 C13 27 10 25 10 22Z"
      fill="rgba(167,139,250,0.2)" stroke="rgba(167,139,250,0.6)" strokeWidth={1} strokeLinejoin="round" />
    <Line x1={19} y1={19} x2={21} y2={19} stroke="rgba(91,79,212,0.8)" strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

const MirrorIcon = () => (
  <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
    <Circle cx={20} cy={20} r={19} stroke="rgba(167,139,250,0.3)" strokeWidth={1} />
    <Rect x={12} y={10} width={16} height={20} rx={2} fill="rgba(167,139,250,0.12)" stroke="rgba(167,139,250,0.5)" strokeWidth={1} />
    <Circle cx={20} cy={19} r={4} fill="rgba(167,139,250,0.2)" stroke="rgba(167,139,250,0.5)" strokeWidth={1} />
    <Line x1={18} y1={30} x2={22} y2={30} stroke="rgba(167,139,250,0.5)" strokeWidth={1.5} strokeLinecap="round" />
    <Line x1={20} y1={30} x2={20} y2={33} stroke="rgba(167,139,250,0.4)" strokeWidth={1.5} strokeLinecap="round" />
    <Line x1={22} y1={15} x2={25} y2={13} stroke="rgba(167,139,250,0.25)" strokeWidth={1} strokeLinecap="round" />
  </Svg>
);

const LightIcon = () => (
  <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
    <Circle cx={20} cy={20} r={19} stroke="rgba(167,139,250,0.3)" strokeWidth={1} />
    <Circle cx={20} cy={18} r={5} fill="rgba(167,139,250,0.2)" stroke="rgba(167,139,250,0.6)" strokeWidth={1} />
    <Rect x={17} y={23} width={6} height={3} rx={1} fill="rgba(167,139,250,0.3)" stroke="rgba(167,139,250,0.4)" strokeWidth={0.8} />
    <Rect x={18} y={26} width={4} height={2} rx={1} fill="rgba(167,139,250,0.2)" stroke="rgba(167,139,250,0.3)" strokeWidth={0.8} />
    <Line x1={20} y1={11} x2={20} y2={9} stroke="rgba(167,139,250,0.4)" strokeWidth={1.2} strokeLinecap="round" />
    <Line x1={25} y1={13} x2={26.4} y2={11.6} stroke="rgba(167,139,250,0.4)" strokeWidth={1.2} strokeLinecap="round" />
    <Line x1={15} y1={13} x2={13.6} y2={11.6} stroke="rgba(167,139,250,0.4)" strokeWidth={1.2} strokeLinecap="round" />
    <Line x1={27} y1={18} x2={29} y2={18} stroke="rgba(167,139,250,0.4)" strokeWidth={1.2} strokeLinecap="round" />
    <Line x1={13} y1={18} x2={11} y2={18} stroke="rgba(167,139,250,0.4)" strokeWidth={1.2} strokeLinecap="round" />
  </Svg>
);

const JumpIcon = () => (
  <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
    <Circle cx={20} cy={20} r={19} stroke="rgba(167,139,250,0.3)" strokeWidth={1} />
    <Circle cx={20} cy={12} r={3} fill="rgba(167,139,250,0.3)" stroke="rgba(167,139,250,0.6)" strokeWidth={1} />
    <Path d="M20 15 L20 22 M17 17 L14 15 M23 17 L26 15 M18 22 L15 28 M22 22 L25 28"
      stroke="rgba(167,139,250,0.6)" strokeWidth={1.3} strokeLinecap="round" />
    <Path d="M16 30 Q20 31 24 30" stroke="rgba(167,139,250,0.25)" strokeWidth={1} strokeLinecap="round" fill="none" />
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
    detail: "In dreams, hands are almost always wrong — extra fingers, melting edges, blurry details. Count every finger on both hands slowly. If anything is off, you're dreaming.",
    icon: <HandIcon />,
  },
  {
    id: 'nose',
    name: 'Nose Pinch',
    instruction: 'Pinch your nose closed and try to breathe.',
    detail: "Hold your nose completely shut. Try to inhale through it. In reality this is impossible. In a dream, air passes through anyway. If you can breathe — you're dreaming.",
    icon: <NoseIcon />,
  },
  {
    id: 'text',
    name: 'Text Check',
    instruction: 'Find something with text. Read it twice.',
    detail: "Look at any sign, label, or screen. Look away. Look back. In a dream, text almost always changes, scrambles, or becomes unreadable the second time. If it's different — you're dreaming.",
    icon: <TextCheckIcon />,
  },
  {
    id: 'clock',
    name: 'Clock Check',
    instruction: 'Look at a clock. Look away. Look back.',
    detail: "Check the time. Look away for a moment. Look again. Dream clocks display impossible times, jump wildly, or have no hands at all. If the time changed drastically — you're dreaming.",
    icon: <ClockIcon />,
  },
  {
    id: 'finger',
    name: 'Finger Through Palm',
    instruction: 'Push your index finger into your opposite palm.',
    detail: "Press your finger against your palm like you're trying to push it through. Use actual force. In waking life, nothing happens. In a dream, your finger will often pass through. If it does — you're dreaming.",
    icon: <FingerIcon />,
  },
  {
    id: 'mirror',
    name: 'Mirror Check',
    instruction: 'Find a reflective surface. Look at yourself.',
    detail: "Approach a mirror, window, or any reflection. Dream reflections are often delayed, distorted, or show someone else entirely. Move your hand — does the reflection keep up? If something's wrong — you're dreaming.",
    icon: <MirrorIcon />,
  },
  {
    id: 'light',
    name: 'Light Switch',
    instruction: 'Find a light switch. Flip it.',
    detail: "Dream environments don't respond to light switches the way reality does. Lights may brighten randomly, do nothing, or dim when they should brighten. If the light doesn't respond normally — you're dreaming.",
    icon: <LightIcon />,
  },
  {
    id: 'jump',
    name: 'Gravity Check',
    instruction: 'Jump. Notice how you land.',
    detail: "Take a small jump. Pay attention to the feeling of coming back down. In dreams, gravity often feels lighter, landings feel floaty or delayed, or you might not come down at all. If it feels wrong — you're dreaming.",
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
}

export default function Checks({ fromNotification, onCheckDone }: Props) {
  const [technique, setTechnique] = useState<Technique>(getRandomTechnique);
  const [presence, setPresence] = useState(1);
  const [answered, setAnswered] = useState<'awake' | 'dreaming' | null>(null);
  const [done, setDone] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const prevTech = useRef(technique.id);

  useEffect(() => {
    if (prevTech.current === technique.id) return;
    prevTech.current = technique.id;
    fadeAnim.setValue(0.3);
    Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [technique]);

  const reset = () => {
    setPresence(1);
    setAnswered(null);
    setDone(false);
    setTechnique(getRandomTechnique());
    onCheckDone?.();
  };

  const handleAnswer = (ans: 'awake' | 'dreaming') => {
    setAnswered(ans);
  };

  const handlePresence = (n: number) => {
    setPresence(n);
  };

  const handleConfirm = () => {
    if (answered !== null && presence > 0) setDone(true);
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
            {answered === 'dreaming' ? "You're dreaming." : "You're awake."}
          </Text>
          <Text style={styles.doneSubtitle}>
            {answered === 'dreaming'
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

          <Text style={styles.sectionLabel}>WHAT'S THE VERDICT?</Text>
          <View style={styles.answerRow}>
            <TouchableOpacity
              style={[styles.answerBtn, answered === 'awake' && styles.answerBtnActive]}
              onPress={() => handleAnswer('awake')}
              activeOpacity={0.75}
            >
              <EyeIcon />
              <Text style={[styles.answerBtnText, answered === 'awake' && styles.answerBtnTextActive]}>I'm awake</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.answerBtn, styles.answerBtnDream, answered === 'dreaming' && styles.answerBtnDreamActive]}
              onPress={() => handleAnswer('dreaming')}
              activeOpacity={0.75}
            >
              <MoonIcon />
              <Text style={[styles.answerBtnText, answered === 'dreaming' && styles.answerBtnTextActive]}>I'm dreaming</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 28 }]}>HOW PRESENT WERE YOU?</Text>
          <Text style={styles.presenceHint}>Did you actually do the check, or just tap through?</Text>
          <View style={styles.presenceRow}>
            {[1,2,3,4,5].map(n => (
              <TouchableOpacity
                key={n}
                style={[styles.presenceBtn, presence === n && styles.presenceBtnOn]}
                onPress={() => handlePresence(n)}
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

        </Animated.View>

        <Text style={[styles.sectionLabel, { marginTop: 36 }]}>ALL TECHNIQUES</Text>
        <View style={styles.techniqueList}>
          {TECHNIQUES.map(t => (
            <TouchableOpacity
              key={t.id}
              style={[styles.techniqueRow, technique.id === t.id && styles.techniqueRowActive]}
              onPress={() => { setTechnique(t); setPresence(0); setAnswered(null); setDone(false); }}
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
    alignItems: 'center', marginBottom: 24,
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