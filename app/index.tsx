import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    Animated,
    Modal, Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Circle, Path, Svg, Text as SvgText } from 'react-native-svg';
import { colors } from '../constants/colors';
import { Dream, calculateStreak, saveDreams } from '../utils/storage';

function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface Props {
  onLogDream: () => void;
  onDreamPress: (dream: Dream) => void;
  dreams: Dream[];
  onDreamsChange: (dreams: Dream[]) => void;
}

function CloudSvg() {
  return (
    <Svg width={72} height={54} viewBox="0 0 64 48" fill="none">
      <Circle cx={32} cy={30} r={22} fill="rgba(167,139,250,0.08)" />
      <Path
        d="M50 34H16a10 10 0 0 1-2-19.8A14 14 0 0 1 40 18a10 10 0 0 1 10 10v6Z"
        fill="rgba(167,139,250,0.18)"
        stroke="rgba(167,139,250,0.45)"
        strokeWidth={1}
      />
      <Path
        d="M22 38 Q28 42 34 38 Q40 34 46 38"
        stroke="rgba(167,139,250,0.3)"
        strokeWidth={1.2}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M26 42 Q32 46 38 42"
        stroke="rgba(167,139,250,0.2)"
        strokeWidth={1}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

function getStreakMessage(streak: number): string {
  if (streak === 0) {
    const msgs = [
      'Log a dream to start',
      'Your journey begins tonight',
      'Every lucid dreamer started here',
      'The first dream is the hardest to catch',
      'Close your eyes and begin',
      'Tonight could be the night',
      'Your dream journal awaits',
      'Start small — even a feeling counts',
    ];
    return msgs[Math.floor(Date.now() / 86400000) % msgs.length];
  }
  if (streak === 1) {
    const msgs = [
      'Day one. The hardest step.',
      'You showed up. That matters.',
      'One dream logged. Keep going.',
      'The first thread of the tapestry.',
      'A single dream remembered.',
      'It starts with one.',
    ];
    return msgs[Math.floor(Date.now() / 86400000) % msgs.length];
  }
  if (streak === 2) {
    const msgs = [
      'Two nights in a row',
      'A pattern is forming',
      'Back again. Good.',
      'Two down, the rest ahead.',
    ];
    return msgs[Math.floor(Date.now() / 86400000) % msgs.length];
  }
  if (streak < 5) {
    const msgs = [
      'Getting started',
      'Building the habit',
      'Your mind is waking up',
      'The recall is coming',
      'Stay consistent',
      'A few days strong',
      'The subconscious is listening',
    ];
    return msgs[streak % msgs.length];
  }
  if (streak === 7) return 'One full week. Legendary.';
  if (streak < 7) {
    const msgs = [
      'Almost a full week',
      'Keep it up',
      'Your recall is sharpening',
      'The dreams are getting clearer',
      'Nearly a week of logging',
      'You\'re building something real',
      'Almost there',
    ];
    return msgs[streak % msgs.length];
  }
  if (streak === 10) return '10 days. Double digits.';
  if (streak < 10) {
    const msgs = [
      'Over a week strong',
      'Your dream world is expanding',
      'The habit is setting in',
      'Past the hard part',
      'Week two territory',
      'Your subconscious is talking',
    ];
    return msgs[streak % msgs.length];
  }
  if (streak === 14) return 'Two weeks straight. Rare.';
  if (streak < 14) {
    const msgs = [
      'Double digits',
      'The dreams are coming to you now',
      'Your recall is strong',
      'Halfway to two weeks',
      'Committed.',
      'The mind rewards consistency',
      'You\'re deep in the habit now',
    ];
    return msgs[streak % msgs.length];
  }
  if (streak === 21) return '21 days. It\'s a lifestyle now.';
  if (streak < 21) {
    const msgs = [
      'Two weeks and counting',
      'Your dream vocabulary is growing',
      'The patterns are revealing themselves',
      'On a serious roll',
      'Most people quit by now',
      'You\'re in rare company',
      'The subconscious opens up',
      'Dreams are your second language now',
    ];
    return msgs[streak % msgs.length];
  }
  if (streak === 30) return '30 days. You\'re a dreamer.';
  if (streak < 30) {
    const msgs = [
      'Three weeks deep',
      'Approaching a full month',
      'Your dream world is vivid',
      'Almost a month of logging',
      'You\'ve built something rare',
      'The lucid state is within reach',
      'Consistent. Disciplined. Dreaming.',
    ];
    return msgs[streak % msgs.length];
  }
  if (streak === 50) return '50 nights. Absolutely wild.';
  if (streak < 50) {
    const msgs = [
      'A full month and beyond',
      'You\'ve crossed the threshold',
      'This is who you are now',
      'The dream world knows your name',
      'Unstoppable',
      'A month of dreams. Remarkable.',
      'Your journal is a universe',
    ];
    return msgs[streak % msgs.length];
  }
  if (streak === 100) return '100 days. You are the dream.';
  if (streak < 100) {
    const msgs = [
      'Fifty nights and counting',
      'You\'ve gone further than most ever will',
      'A dedicated dreamer',
      'The subconscious is your playground',
      'Legendary consistency',
      'Your dream world is infinite',
    ];
    return msgs[streak % msgs.length];
  }
  const msgs = [
    'Beyond the charts',
    'You are the dream',
    'A hundred nights and still going',
    'There are no words',
    'Infinite dreamer',
    'You live between worlds',
    'The master of the dream state',
  ];
  return msgs[streak % msgs.length];
}

// How cosmic should the number look (0 = plain, 1 = full portal)
function cosmicLevel(streak: number): number {
  if (streak === 0) return 0;
  if (streak < 3)   return 0.08;
  if (streak < 7)   return 0.18;
  if (streak < 14)  return 0.32;
  if (streak < 21)  return 0.48;
  if (streak < 30)  return 0.62;
  if (streak < 50)  return 0.76;
  if (streak < 100) return 0.88;
  return 1;
}

const STAR_COLORS_COSMIC = ['#a78bfa','#c4baff','#ddd6fe','#7c6fd4','#ffffff','#e0d7ff'];

interface CosmicNumberProps { streak: number }

function CosmicStreakNumber({ streak }: CosmicNumberProps) {
  const level = cosmicLevel(streak);
  const label = String(streak);
  const fontSize = label.length === 1 ? 58 : label.length === 2 ? 50 : 40;
  const SIZE = label.length >= 3 ? 100 : 80;

  // Two star layers: subtle background field + brighter foreground stars
  const { bgStars, fgStars } = React.useMemo(() => {
    // Background field — many tiny dim stars, always present from streak 1+
    const bgCount = Math.floor(20 + level * 40);
    const bgStars = Array.from({ length: bgCount }, (_, i) => {
      const seed = (i * 1111111 + streak * 99991) >>> 0;
      return {
        x: ((seed * 2345678) % 10000) / 10000 * SIZE,
        y: ((seed * 8765432) % 10000) / 10000 * SIZE,
        r: 0.3 + ((seed * 141421) % 1000) / 1000 * 0.6,
        opacity: 0.08 + ((seed * 161803) % 1000) / 1000 * (0.12 + level * 0.1),
        color: STAR_COLORS_COSMIC[i % STAR_COLORS_COSMIC.length],
      };
    });
    // Foreground stars — fewer, brighter, bigger, grow with streak
    const fgCount = Math.floor(4 + level * 18);
    const fgStars = Array.from({ length: fgCount }, (_, i) => {
      const seed = (i * 2654435761 + streak * 12345) >>> 0;
      return {
        x: 4 + ((seed * 1234567) % 10000) / 10000 * (SIZE - 8),
        y: 4 + ((seed * 7654321) % 10000) / 10000 * (SIZE - 8),
        r: 0.8 + ((seed * 314159) % 1000) / 1000 * (1.0 + level * 1.2),
        opacity: 0.35 + ((seed * 271828) % 1000) / 1000 * (0.35 + level * 0.25),
        color: STAR_COLORS_COSMIC[i % STAR_COLORS_COSMIC.length],
      };
    });
    return { bgStars, fgStars };
  }, [streak, SIZE]);

  // Pulse animation for glow
  const glowAnim = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    if (level < 0.15) return;
    const loop = () => Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1.35, duration: 1800, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 1,    duration: 1800, useNativeDriver: true }),
    ]).start(loop);
    loop();
  }, [level]);

  const glowRadius = 10 + level * 24;
  const glowColor  = level < 0.5
    ? `rgba(167,139,250,${(level * 0.75).toFixed(2)})`
    : `rgba(196,186,255,${(level * 0.75).toFixed(2)})`;

  // Number colour: white at 0, shifts to vivid purple at max
  // Purple = high R, low G, high B  (e.g. #a78bfa = 167,139,250)
  const r = Math.round(240 - level * 73);   // 240 → 167
  const g = Math.round(236 - level * 97);   // 236 → 139
  const b = 255;                             // always max
  const numColor = level === 0 ? '#f0ecff' : `rgb(${r},${g},${b})`;

  // Nebula glow circle behind the digits
  const nebulaR  = SIZE * 0.42 + level * SIZE * 0.08;
  const nebulaOp = level * 0.6;

  // Glow view needs a non-transparent bg for iOS shadow to render
  const glowBg = level < 0.5
    ? `rgba(91,79,212,${(level * 0.35).toFixed(2)})`
    : `rgba(120,90,255,${(0.5 * 0.35).toFixed(2)})`;

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      {/* Outer iOS shadow glow — pulsing. Needs a real bg color to cast shadow */}
      {level > 0.1 && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: SIZE * 0.7,
            height: SIZE * 0.7,
            borderRadius: (SIZE * 0.7) / 2,
            backgroundColor: glowBg,
            shadowColor: glowColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1,
            shadowRadius: glowRadius,
            opacity: glowAnim,
          }}
        />
      )}

      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* Soft nebula blob — centered on the number */}
        {level > 0.08 && (
          <Circle
            cx={SIZE / 2} cy={SIZE / 2}
            r={nebulaR}
            fill={`rgba(91,79,212,${nebulaOp.toFixed(2)})`}
          />
        )}
        {level > 0.3 && (
          <Circle
            cx={SIZE / 2} cy={SIZE / 2}
            r={nebulaR * 0.6}
            fill={`rgba(167,139,250,${(nebulaOp * 0.65).toFixed(2)})`}
          />
        )}

        {/* Background star field — subtle, dense */}
        {level > 0 && bgStars.map((s, i) => (
          <Circle key={`bg${i}`} cx={s.x} cy={s.y} r={s.r} fill={s.color} opacity={s.opacity} />
        ))}

        {/* Foreground stars — brighter, fewer */}
        {fgStars.map((s, i) => (
          <Circle key={`fg${i}`} cx={s.x} cy={s.y} r={s.r} fill={s.color} opacity={s.opacity} />
        ))}

        {/* The number — centered both axes, drawn last so always on top */}
        <SvgText
          x={SIZE / 2}
          y={SIZE / 2 + fontSize * 0.36}
          textAnchor="middle"
          fontSize={fontSize}
          fontWeight="800"
          fontFamily="Georgia, serif"
          fill={numColor}
        >
          {label}
        </SvgText>
      </Svg>
    </View>
  );
}

export default function Index({ onLogDream, onDreamPress, dreams, onDreamsChange }: Props) {
  const [noMemoryModal, setNoMemoryModal] = useState(false);

  const recentDreams = dreams.filter(d => !d.noMemory).slice(0, 2);
  const streak = calculateStreak(dreams);

  const handleNoMemoryConfirm = async () => {
    const today = new Date();
    const noMemoryEntry: Dream = {
      id: Date.now().toString(),
      title: '',
      description: '',
      vividness: 0,
      tags: [],
      date: today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      dateISO: toLocalISO(today),
      noMemory: true,
    };
    const updated = [noMemoryEntry, ...dreams];
    onDreamsChange(updated);
    await saveDreams(updated);
    setNoMemoryModal(false);
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'Good morning';
    if (h >= 12 && h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getFormattedDate = () =>
    new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.date}>{getFormattedDate()}</Text>
        </View>

        <View style={styles.streakCard}>
          <CosmicStreakNumber streak={streak} />
          <View style={{ flex: 1 }}>
            <Text style={styles.streakLabel}>Day streak</Text>
            <Text style={styles.streakSubtext}>{getStreakMessage(streak)}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>RECENT DREAMS</Text>

        <View style={styles.dreamsContainer}>
          {recentDreams.length === 0 ? (
            <Text style={styles.emptyText}>No dreams logged yet.</Text>
          ) : (
            recentDreams.map((dream) => (
              <TouchableOpacity
                key={dream.id}
                style={styles.dreamCard}
                onPress={() => onDreamPress(dream)}
                activeOpacity={0.75}
              >
                <View style={styles.dreamHeader}>
                  <Text style={styles.dreamTitle}>{dream.title}</Text>
                  <Text style={styles.dreamDate}>{dream.date}</Text>
                </View>
                <View style={styles.dreamMeta}>
                  <View style={styles.tagsContainer}>
                    {dream.tags.slice(0, 3).map((tag, i) => (
                      <View key={i} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.vividRow}>
                    {[1,2,3,4,5].map(n => (
                      <View key={n} style={[styles.vividDot, n <= dream.vividness && styles.vividDotOn]} />
                    ))}
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={onLogDream}>
          <Ionicons name="add" size={20} color={colors.textPrimary} />
          <Text style={styles.primaryButtonText}>Log last night's dream</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.ghostButton} onPress={() => setNoMemoryModal(true)}>
          <Text style={styles.ghostButtonText}>I don't remember my dream</Text>
        </TouchableOpacity>


      </ScrollView>

      <Modal
        visible={noMemoryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setNoMemoryModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setNoMemoryModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalIconWrap}>
              <CloudSvg />
            </View>
            <Text style={styles.modalTitle}>Are you sure?</Text>
            <Text style={styles.modalBody}>
              Even a faint feeling, a color, or a single image counts. Try closing your eyes for a moment — anything come back?
            </Text>
            <TouchableOpacity style={styles.modalPrimary} onPress={() => { setNoMemoryModal(false); onLogDream(); }}>
              <Text style={styles.modalPrimaryText}>Actually, let me log it</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalGhost}
              onPress={handleNoMemoryConfirm}
            >
              <Text style={styles.modalGhostText}>No, I really don't remember</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: 'transparent' },
  scrollView:    { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 56, paddingBottom: 100 },

  header:        { marginBottom: 24 },
  greeting:      { fontSize: 28, fontWeight: '700', fontFamily: 'Nunito_800ExtraBold', color: colors.textPrimary, marginBottom: 4 },
  date:          { fontSize: 16, fontFamily: 'Nunito_300Light', color: colors.textMuted },

  streakCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.streakCardBackground,
    borderWidth: 0.5, borderColor: colors.streakCardBorder,
    borderRadius: 14, padding: 20, marginBottom: 32, gap: 16,
  },
  streakLabel:   { fontSize: 16, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', color: colors.textPrimary, marginBottom: 2 },
  streakSubtext: { fontSize: 14, fontFamily: 'Nunito_300Light', color: colors.textMuted },

  sectionLabel:   { fontSize: 12, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', color: colors.textMuted, letterSpacing: 1, marginBottom: 16 },
  dreamsContainer:{ gap: 12, marginBottom: 32 },
  emptyText:      { fontSize: 14, fontFamily: 'Nunito_300Light', color: colors.textMuted },

  dreamCard: {
    backgroundColor: colors.cardBackground, borderWidth: 0.5,
    borderColor: colors.cardBorder, borderRadius: 12, padding: 16,
  },
  dreamHeader:   { marginBottom: 12 },
  dreamTitle:    { fontSize: 18, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', color: colors.textPrimary, marginBottom: 4 },
  dreamDate:     { fontSize: 14, fontFamily: 'Nunito_300Light', color: colors.textMuted },
  dreamMeta:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  tagsContainer: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', flex: 1 },
  tag:           { backgroundColor: colors.tagBackground, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  tagText:       { fontSize: 12, fontWeight: '500', fontFamily: 'Nunito_600SemiBold', color: colors.tagColor },

  vividRow:   { flexDirection: 'row', gap: 4 },
  vividDot:   { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)' },
  vividDotOn: { backgroundColor: colors.primaryPurple },

  primaryButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primaryPurple, borderRadius: 12,
    padding: 16, gap: 8, marginBottom: 12,
  },
  primaryButtonText: { fontSize: 16, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', color: colors.textPrimary },
  ghostButton:       { alignItems: 'center', padding: 12 },
  ghostButtonText:   { fontSize: 14, fontFamily: 'Nunito_300Light', color: colors.textMuted },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end', paddingBottom: 32, paddingHorizontal: 16,
  },
  modalCard: {
    backgroundColor: '#1a1730', borderRadius: 24,
    padding: 28, alignItems: 'center',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)',
  },
  modalIconWrap:    { marginBottom: 16 },
  modalTitle:       { fontSize: 22, fontWeight: '700', fontFamily: 'Nunito_800ExtraBold', color: colors.textPrimary, marginBottom: 10 },
  modalBody:        { fontSize: 15, fontFamily: 'Nunito_300Light', color: colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  modalPrimary: {
    backgroundColor: colors.primaryPurple, borderRadius: 12,
    padding: 14, width: '100%', alignItems: 'center', marginBottom: 10,
  },
  modalPrimaryText: { fontSize: 15, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', color: colors.textPrimary },
  modalGhost:       { padding: 12, width: '100%', alignItems: 'center' },
  modalGhostText:   { fontSize: 14, fontFamily: 'Nunito_300Light', color: colors.textMuted },
});