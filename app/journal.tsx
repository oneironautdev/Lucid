import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Circle, Path, Svg } from 'react-native-svg';
import { colors } from '../constants/colors';
import { trackEvent } from '../utils/analytics';
import { countWords, Dream, saveDreams } from '../utils/storage';

export type { Dream };

export interface JournalHandle {
  openForm: () => void;
  openDream: (dream: Dream) => void;
}

const SCREEN_W = Dimensions.get('window').width;

// ─── Mood face SVG ────────────────────────────────────────────────────────────
function JournalMoodFace({ index, size = 26, active = false }: { index: number; size?: number; active?: boolean }) {
  const c = size / 2;
  // Colors from red to purple
  const cols = ['#f87171', '#fb923c', 'rgba(255,255,255,0.28)', '#a78bfa', '#c4baff'];
  const col = active ? cols[index] : 'rgba(255,255,255,0.25)';
  const strokeW = 1.2;

  // Mouth shape per index
  const mouthY = c + size * 0.18;
  const mouthW = size * 0.22;
  const curves = [-size * 0.14, -size * 0.07, 0, size * 0.07, size * 0.14];
  const curve = curves[index];
  // Frown ends go up, smile ends go down
  const mouthPath = `M ${c - mouthW} ${mouthY - (curve < 0 ? curve : 0)} Q ${c} ${mouthY + curve} ${c + mouthW} ${mouthY - (curve < 0 ? curve : 0)}`;

  // Eye position
  const eyeY = c - size * 0.08;
  const eyeX = size * 0.22;

  // Brow angle per mood
  const browY = eyeY - size * 0.17;
  const browW = size * 0.14;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Face circle */}
      <Circle cx={c} cy={c} r={c - 1} fill={active ? `${col}18` : 'transparent'} stroke={col} strokeWidth={strokeW} />
      {/* Eyes */}
      <Circle cx={c - eyeX} cy={eyeY} r={size * 0.055} fill={col} />
      <Circle cx={c + eyeX} cy={eyeY} r={size * 0.055} fill={col} />
      {/* Brows on expressive faces */}
      {index === 0 && (
        <>
          <Path d={`M ${c - eyeX - browW} ${browY + size*0.04} L ${c - eyeX + browW} ${browY}`} stroke={col} strokeWidth={strokeW} strokeLinecap="round" />
          <Path d={`M ${c + eyeX - browW} ${browY} L ${c + eyeX + browW} ${browY + size*0.04}`} stroke={col} strokeWidth={strokeW} strokeLinecap="round" />
        </>
      )}
      {index === 4 && (
        <>
          <Path d={`M ${c - eyeX - browW} ${browY} L ${c - eyeX + browW} ${browY - size*0.04}`} stroke={col} strokeWidth={strokeW} strokeLinecap="round" />
          <Path d={`M ${c + eyeX - browW} ${browY - size*0.04} L ${c + eyeX + browW} ${browY}`} stroke={col} strokeWidth={strokeW} strokeLinecap="round" />
        </>
      )}
      {/* Mouth */}
      <Path d={mouthPath} stroke={col} strokeWidth={strokeW} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface Props {
  dreams: Dream[];
  onDreamsChange: (dreams: Dream[]) => void;
}

type View_ = 'list' | 'form' | 'detail';

const TAGS = [
  // Common experiences
  'flying', 'falling', 'floating', 'chased', 'lost', 'late for something',
  "can't move", "can't scream", 'paralysis', 'naked',
  // Emotions
  'anxiety', 'joy', 'fear', 'peace', 'confusion', 'love', 'anger', 'sadness',
  // Settings
  'school', 'work', 'home', 'childhood home', 'city', 'forest', 'underwater',
  'space', 'beach', 'mountain', 'desert', 'hospital', 'unknown place',
  // People & beings
  'family', 'friends', 'strangers', 'people', 'animals', 'monsters', 'celebrity',
  'deceased person', 'romantic partner',
  // Elements & phenomena
  'water', 'fire', 'darkness', 'light', 'weather', 'storm', 'flood',
  // Objects & symbols
  'vehicles', 'doors', 'mirrors', 'teeth', 'weapons', 'food', 'technology',
  // Dream types
  'nightmare', 'recurring', 'prophetic', 'vivid', 'fragmented',
  'false awakening', 'sleep paralysis', 'time travel',
  // Sensory
  'voices', 'music', 'colours', 'pain',
  // Narrative
  'violence', 'death', 'transformation', 'being watched', 'maze', 'portal',
  'supernatural', 'adventure', 'romance',
];

// Dreams per page
const PAGE_SIZE = 20;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMonthKey(dateISO: string): string {
  // dateISO format
  const [y, m] = dateISO.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

interface Section {
  title: string;
  data: Dream[];
}

function groupIntoSections(dreams: Dream[]): Section[] {
  const map = new Map<string, Dream[]>();
  for (const dream of dreams) {
    const key = getMonthKey(dream.dateISO);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(dream);
  }
  return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CloudSvg() {
  return (
    <Svg width={64} height={48} viewBox="0 0 64 48" fill="none">
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

const VividDots = ({ v, large = false }: { v: number; large?: boolean }) => (
  <View style={styles.vividRow}>
    {[1, 2, 3, 4, 5].map(n => (
      <View
        key={n}
        style={[
          large ? styles.vividDotLg : styles.vividDot,
          n <= v && (large ? styles.vividDotLgOn : styles.vividDotOn),
        ]}
      />
    ))}
  </View>
);

// ── Main component ────────────────────────────────────────────────────────────

const Journal = React.forwardRef(function Journal(
  { dreams, onDreamsChange }: Props,
  ref
) {
  const { width } = useWindowDimensions();

  const [view, setView] = useState<View_>('list');
  const [selected, setSelected] = useState<Dream | null>(null);
  const [editing, setEditing] = useState(false);
  const [fillingBlankDay, setFillingBlankDay] = useState(false);
  const [alreadyLoggedToday, setAlreadyLoggedToday] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);

  // Search
  const [searchText, setSearchText] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null); // Year-month
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const dropdownAnim = useRef(new Animated.Value(0)).current;
  const triggerRef   = useRef<View>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [dreamsReady, setDreamsReady] = useState(dreams.length > 0);

  // Visible dream count
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const vividShake = useRef(new Animated.Value(0)).current;

  const emptyForm = () => ({ title: '', description: '', vividness: 1, tags: [] as string[], mood: 0 as number, lucid: false });
  const [form, setForm] = useState(emptyForm());

  // Animation refs to avoid flash
  const listOpacity = useRef(new Animated.Value(1)).current;
  const listTransY = useRef(new Animated.Value(0)).current;
  const panelOpacity = useRef(new Animated.Value(0)).current;

  // ── Filtered data ──────────────────────────────────────────────────────

  // Find earliest real dream date
  const firstRealDateISO = useMemo(() => {
    const real = dreams.filter(d => !d.noMemory);
    if (real.length === 0) return null;
    return real.reduce((min, d) => (d.dateISO < min ? d.dateISO : min), real[0].dateISO);
  }, [dreams]);

  // Unique months for picker
  const availableMonths = useMemo(() => {
    const seen = new Set<string>();
    const months: { key: string; label: string }[] = [];
    const valid = firstRealDateISO
      ? dreams.filter(d => !d.noMemory || d.dateISO >= firstRealDateISO)
      : dreams;
    for (const d of valid) {
      const key = d.dateISO.slice(0, 7); // Year-month
      if (!seen.has(key)) {
        seen.add(key);
        const [y, m] = key.split('-');
        const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        months.push({ key, label });
      }
    }
    return months.sort((a, b) => b.key.localeCompare(a.key));
  }, [dreams, firstRealDateISO]);

  const filtered = useMemo(() => {
    // Strip noMemory entries before first dream
    const valid = firstRealDateISO
      ? dreams.filter(d => !d.noMemory || d.dateISO >= firstRealDateISO)
      : dreams;

    if (!searchText.trim() && !selectedMonth) return valid;
    const q = searchText.toLowerCase();
    return valid.filter(
      d => {
        const matchesMonth = !selectedMonth || d.dateISO.startsWith(selectedMonth);
        const matchesSearch = !searchText.trim() || (
          d.title.toLowerCase().includes(q) ||
          d.description?.toLowerCase().includes(q) ||
          d.tags.some(t => t.toLowerCase().includes(q))
        );
        return matchesMonth && matchesSearch;
      }
    );
  }, [dreams, searchText, selectedMonth, firstRealDateISO]);

  // Reset pagination on filter change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchText, selectedMonth]);

  // Slice and group by section
  const sections = useMemo((): Section[] => {
    const sliced = filtered.slice(0, visibleCount);
    return groupIntoSections(sliced);
  }, [filtered, visibleCount]);

  const hasMore = visibleCount < filtered.length;

  const loadMore = useCallback(() => {
    if (hasMore) setVisibleCount(c => c + PAGE_SIZE);
  }, [hasMore]);

  // ── Imperative handle ──────────────────────────────────────────────────────

  useImperativeHandle(ref, () => ({
    openForm: () => {
      const todayISO = toLocalISO(new Date());
      const logged = dreams.some(d => d.dateISO === todayISO && !d.noMemory);
      setAlreadyLoggedToday(logged);
      setForm(emptyForm());
      setEditing(false);
      setSelected(null);
      listOpacity.setValue(0);
      listTransY.setValue(20);
      panelOpacity.setValue(1);
      setView('form');
    },
    openDream: (dream: Dream) => {
      setSelected(dream);
      setEditing(false);
      listOpacity.setValue(0);
      listTransY.setValue(20);
      panelOpacity.setValue(1);
      setView('detail');
    },
  }));

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (dreams.length === 0) {
      setSelected(null);
      setEditing(false);
      showList();
    }
  }, [dreams.length]);

  const didMount = useRef(false);
  useEffect(() => {
    if (didMount.current && !dreamsReady) setDreamsReady(true);
    didMount.current = true;
  }, [dreams]);

  // ── Navigation animations ──────────────────────────────────────────────────

  // Fade in after panel mounts to avoid flash
  const pendingPanel = useRef<'form' | 'detail' | null>(null);
  useEffect(() => {
    if (view === 'list' || !pendingPanel.current) return;
    pendingPanel.current = null;
    Animated.parallel([
      Animated.timing(listOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(listTransY, { toValue: 16, duration: 200, useNativeDriver: true }),
      Animated.timing(panelOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [view]);

  const showPanel = (target: 'form' | 'detail', instant = false) => {
    panelOpacity.setValue(0);
    if (instant) {
      listOpacity.setValue(0);
      listTransY.setValue(20);
      setView(target);
      panelOpacity.setValue(1);
      return;
    }
    pendingPanel.current = target;
    setView(target);
  };

  const showList = () => {
    setView('list');
    Animated.parallel([
      Animated.timing(listOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(listTransY, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(panelOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start();
  };

  // ── Dream actions ──────────────────────────────────────────────────────────

  const openDetail = (dream: Dream) => {
    setSelected(dream);
    setEditing(false);
    showPanel('detail');
  };

  const openEdit = (dream: Dream) => {
    setSelected(dream);
    setForm({
      title: dream.title,
      description: dream.description,
      vividness: dream.vividness || 1,
      tags: [...dream.tags],
      mood: dream.mood ?? 0,
      lucid: dream.lucid ?? false,
    });
    setEditing(true);
  };

  const shakeVividness = () => {
    vividShake.setValue(0);
    Animated.sequence([
      Animated.timing(vividShake, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(vividShake, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(vividShake, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(vividShake, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(vividShake, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  };

  const [saving, setSaving] = useState(false);

  const saveDream = async () => {
    if (saving) return;
    if (!form.title.trim()) return;
    if (!form.vividness || form.vividness < 1) {
      shakeVividness();
      return;
    }

    setSaving(true);
    try {

    const today = new Date();
    const useExisting = (editing || fillingBlankDay) && selected;
    const dreamDate = useExisting
      ? selected!.date
      : today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const dreamDateISO = useExisting ? selected!.dateISO : toLocalISO(today);

    const dream: Dream = {
      id: useExisting ? selected!.id : Date.now().toString(),
      title: form.title,
      description: form.description,
      vividness: form.vividness,
      tags: form.tags,
      date: dreamDate,
      dateISO: dreamDateISO,
      noMemory: false,
      mood: form.mood > 0 ? form.mood : undefined,
      lucid: form.lucid || undefined,
      loggedAt: useExisting ? (selected!.loggedAt ?? new Date().toISOString()) : new Date().toISOString(),
      wbtbNight: useExisting ? selected!.wbtbNight : undefined,
    };

    let updated: Dream[];
    if ((editing || fillingBlankDay) && selected) {
      updated = dreams.map(d => (d.id === selected.id ? dream : d));
    } else {
      updated = [dream, ...dreams];
      trackEvent('dream_logged');
      if (dream.lucid) trackEvent('lucid_dream_logged');
    }

    onDreamsChange(updated);
    await saveDreams(updated);
    setFillingBlankDay(false);
    showList();
    } finally {
      setSaving(false);
    }
  };

  const deleteDream = async () => {
    if (!selected) return;
    const updated = dreams.filter(d => d.id !== selected.id);
    onDreamsChange(updated);
    await saveDreams(updated);
    setDeleteConfirmVisible(false);
    showList();
  };

  const toggleTag = (tag: string) =>
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag],
    }));

  const wordCount = countWords(form.description);
  const overLimit = false; // word cap removed

  // ── Dropdown helpers ───────────────────────────────────────────────────────
  const openMenu = () => {
    triggerRef.current?.measure((_x, _y, w, h, px, py) => {
      setMenuPos({ top: py + h + 4, right: SCREEN_W - px - w });
      setMonthDropdownOpen(true);
      dropdownAnim.setValue(0);
      Animated.timing(dropdownAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  };

  const closeMenu = (key?: string | null) => {
    if (key !== undefined) setSelectedMonth(key);
    Animated.timing(dropdownAnim, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
      setMonthDropdownOpen(false);
      setMenuPos(null);
    });
  };

  // Instant close
  const closeMenuImmediate = (key?: string | null) => {
    if (key !== undefined) setSelectedMonth(key);
    dropdownAnim.setValue(0);
    setMonthDropdownOpen(false);
    setMenuPos(null);
  };

  const arrowRotate = dropdownAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  // ── Skeleton shimmer ───────────────────────────────────────────────────────
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(shimmer, { toValue: 1, duration: 850, useNativeDriver: true }),
      Animated.timing(shimmer, { toValue: 0, duration: 850, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  const shimmerOp = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.13] });

  const SkeletonList = () => (
    <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
      {[0.6, 0.45, 0.72, 0.52].map((w, i) => (
        <Animated.View key={i} style={[skeletonStyles.card, { opacity: shimmerOp }]}>
          <View style={skeletonStyles.row}>
            <View style={[skeletonStyles.line, { flex: w as any, height: 14, marginRight: 12 }]} />
            <View style={[skeletonStyles.line, { width: 58, height: 11 }]} />
          </View>
          <View style={[skeletonStyles.line, { width: '33%', height: 9, marginTop: 10 }]} />
        </Animated.View>
      ))}
    </View>
  );

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item: dream }: { item: Dream }) =>
      dream.noMemory ? (
        <TouchableOpacity
          style={styles.cardNoMemory}
          onPress={() => {
            setSelected(dream);
            setForm({ title: '', description: '', vividness: 1, tags: [], mood: 0, lucid: false });
            setEditing(false);
            setFillingBlankDay(true);
            setAlreadyLoggedToday(false);
            showPanel('form');
          }}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.cardNoMemoryLabel}>No dream recorded</Text>
            <Ionicons name="pencil-outline" size={12} color="rgba(255,255,255,0.2)" />
          </View>
          <Text style={styles.cardNoMemoryDate}>{dream.date}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.card} onPress={() => openDetail(dream)} activeOpacity={0.75}>
          <View style={styles.cardTop}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {dream.title}
            </Text>
            <Text style={styles.cardDate}>{dream.date}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <VividDots v={dream.vividness} />
            {dream.lucid && (
              <View style={styles.lucidBadge}>
                <Svg width={10} height={10} viewBox="0 0 10 10">
                  <Path d="M5 0.5 C2.8 0.5 1 2.3 1 4.5 C1 7 3 9 5 9.5 C7 9 9 7 9 4.5 C9 2.3 7.2 0.5 5 0.5Z" fill="rgba(167,139,250,0.3)" stroke="#a78bfa" strokeWidth={0.8} />
                  <Circle cx={5} cy={4.5} r={1.5} fill="#a78bfa" />
                </Svg>
                <Text style={styles.lucidBadgeText}>lucid</Text>
              </View>
            )}
          </View>
          {dream.tags.length > 0 && (
            <View style={[styles.tagRow, { marginTop: 8 }]}>
              {dream.tags.map(t => (
                <View key={t} style={styles.tag}>
                  <Text style={styles.tagText}>{t}</Text>
                </View>
              ))}
            </View>
          )}
        </TouchableOpacity>
      ),
    []
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{section.title}</Text>
        <View style={styles.sectionHeaderLine} />
      </View>
    ),
    []
  );

  const ListFooter = () =>
    hasMore ? (
      <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore} activeOpacity={0.7}>
        <Text style={styles.loadMoreText}>Load more</Text>
        <Ionicons name="chevron-down" size={16} color="rgba(167,139,250,0.7)" style={{ marginLeft: 4 }} />
      </TouchableOpacity>
    ) : null;

  const ListEmpty = () => (
    <View style={styles.emptyWrap}>
      <CloudSvg />
      <Text style={styles.emptyText}>
        {searchText.trim()
          ? 'No dreams match your search.'
          : 'No dreams logged yet. Tap + to add one.'}
      </Text>
    </View>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {/* ── LIST LAYER ── */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { opacity: listOpacity, transform: [{ translateY: listTransY }] },
          view !== 'list' && { pointerEvents: 'none' },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Journal</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              const todayISO = toLocalISO(new Date());
              const logged = dreams.some(d => d.dateISO === todayISO && !d.noMemory);
              setAlreadyLoggedToday(logged);
              setForm(emptyForm());
              setEditing(false);
              showPanel('form');
            }}
          >
            <Ionicons name="add" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Search bar + month dropdown in one row */}
        <View style={styles.searchRow}>
          <View style={[styles.searchWrap, searchFocused && styles.searchWrapFocused, { flex: 1 }]}>
            <Ionicons name="search-outline" size={16} color="rgba(255,255,255,0.35)" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search dreams, tags..."
              placeholderTextColor="rgba(255,255,255,0.25)"
              value={searchText}
              onChangeText={setSearchText}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>
            )}
          </View>

          {/* Month filter dropdown */}
          {availableMonths.length > 1 && (
            <View ref={triggerRef} collapsable={false}>
              <TouchableOpacity
                onPress={() => monthDropdownOpen ? closeMenu() : openMenu()}
                activeOpacity={0.75}
                style={[styles.monthDropdownTrigger, !!selectedMonth && styles.monthDropdownTriggerActive]}
              >
                <Text style={[styles.monthDropdownTriggerText, !!selectedMonth && styles.monthDropdownTriggerTextActive]}>
                  {selectedMonth ? (availableMonths.find(m => m.key === selectedMonth)?.label ?? 'Filter') : 'All'}
                </Text>
                <Animated.Text style={[styles.monthDropdownCaret, !!selectedMonth && { color: '#c4baff' }, { transform: [{ rotate: arrowRotate }] }]}>
                  ▾
                </Animated.Text>
              </TouchableOpacity>
            </View>
          )}

        </View>

        {/* Count hint when filtered */}
        {(searchText.trim().length > 0 || selectedMonth) && (
          <Text style={styles.resultCount}>
            {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
            {selectedMonth && !searchText.trim() ? ` in ${availableMonths.find(m => m.key === selectedMonth)?.label ?? ''}` : ''}
          </Text>
        )}

        {!dreamsReady ? (
          <SkeletonList />
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={dream => dream.id}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={false}
            ListEmptyComponent={ListEmpty}
            ListFooterComponent={ListFooter}
            initialNumToRender={12}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            scrollEventThrottle={16}
            onScroll={() => { if (monthDropdownOpen) closeMenuImmediate(); }}
          />
        )}
      </Animated.View>


      {/* Month dropdown — no backdrop so scroll passes through; closes on scroll via SectionList onScroll */}
      {monthDropdownOpen && menuPos && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 },
          ]}
        >
          <Animated.View style={[
            styles.monthDropdownMenu,
            { position: 'absolute', top: menuPos.top, right: menuPos.right },
            { opacity: dropdownAnim, transform: [{ scale: dropdownAnim.interpolate({ inputRange: [0,1], outputRange: [0.93,1] }) }, { translateY: dropdownAnim.interpolate({ inputRange: [0,1], outputRange: [-6,0] }) }] },
          ]}>
            <ScrollView style={{ maxHeight: 260 }} bounces={false} showsVerticalScrollIndicator={availableMonths.length > 5} keyboardShouldPersistTaps="handled">
              <TouchableOpacity onPress={() => closeMenuImmediate(null)} style={[styles.monthDropdownItem, styles.monthDropdownItemFirst, !selectedMonth && styles.monthDropdownItemActive]}>
                <Text style={[styles.monthDropdownItemText, !selectedMonth && styles.monthDropdownItemTextActive]}>All time</Text>
              </TouchableOpacity>
              {availableMonths.map((m, idx) => (
                <TouchableOpacity key={m.key} onPress={() => closeMenuImmediate(m.key)} style={[styles.monthDropdownItem, idx === availableMonths.length - 1 && styles.monthDropdownItemLast, selectedMonth === m.key && styles.monthDropdownItemActive]}>
                  <Text style={[styles.monthDropdownItemText, selectedMonth === m.key && styles.monthDropdownItemTextActive]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      )}

      {/* ── PANEL LAYER (detail / form) ── */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { opacity: panelOpacity },
          view === 'list' && { pointerEvents: 'none' },
        ]}
      >
        {/* Detail view */}
        {view === 'detail' && selected && !editing && (
          <View style={styles.root}>
            <View style={styles.header}>
              <TouchableOpacity onPress={showList}>
                <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {selected.noMemory ? 'No Dream Recorded' : selected.title}
              </Text>
              {!selected.noMemory ? (
                <TouchableOpacity onPress={() => openEdit(selected)} style={styles.editBtn}>
                  <Ionicons name="create-outline" size={22} color={colors.lightPurple} />
                </TouchableOpacity>
              ) : (
                <View style={{ width: 32 }} />
              )}
            </View>
            <ScrollView contentContainerStyle={styles.detailContent}>
              <Text style={styles.detailDate}>{selected.date}</Text>
              {!selected.noMemory && selected.vividness > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <VividDots v={selected.vividness} large />
                  {selected.lucid && (
                    <View style={styles.lucidBadge}>
                      <Svg width={10} height={10} viewBox="0 0 10 10">
                        <Path d="M5 0.5 C2.8 0.5 1 2.3 1 4.5 C1 7 3 9 5 9.5 C7 9 9 7 9 4.5 C9 2.3 7.2 0.5 5 0.5Z" fill="rgba(167,139,250,0.3)" stroke="#a78bfa" strokeWidth={0.8} />
                        <Circle cx={5} cy={4.5} r={1.5} fill="#a78bfa" />
                      </Svg>
                      <Text style={styles.lucidBadgeText}>lucid dream</Text>
                    </View>
                  )}
                </View>
              )}
              {!selected.noMemory && selected.mood != null && selected.mood > 0 && (
                <View style={styles.detailMoodRow}>
                  <Text style={styles.detailMoodLabel}>Mood</Text>
                  <JournalMoodFace index={selected.mood - 1} size={28} active />
                </View>
              )}
              {selected.tags.length > 0 && (
                <View style={[styles.tagRow, { marginBottom: 20 }]}>
                  {selected.tags.map(t => (
                    <View key={t} style={styles.tag}>
                      <Text style={styles.tagText}>{t}</Text>
                    </View>
                  ))}
                </View>
              )}
              {selected.noMemory ? (
                <Text style={styles.detailBodyMuted}>No dream was recorded for this night.</Text>
              ) : selected.description ? (
                <Text style={styles.detailBody}>{selected.description}</Text>
              ) : (
                <Text style={styles.detailBodyMuted}>No description recorded.</Text>
              )}
            </ScrollView>
          </View>
        )}

        {/* Form view (new or edit) */}
        {(view === 'form' || (view === 'detail' && editing)) && (
          <KeyboardAvoidingView
            style={styles.root}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.header}>
              <TouchableOpacity onPress={() => { setEditing(false); setFillingBlankDay(false); showList(); }}>
                <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{editing ? 'Edit Dream' : fillingBlankDay ? 'Record Dream' : 'New Dream Entry'}</Text>
              {editing ? (
                <TouchableOpacity onPress={() => setDeleteConfirmVisible(true)} style={styles.editBtn}>
                  <Ionicons name="trash-outline" size={20} color="#f87171" />
                </TouchableOpacity>
              ) : fillingBlankDay ? (
                <TouchableOpacity
                  onPress={async () => {
                    if (!selected) return;
                    const updated = dreams.filter(d => d.id !== selected.id);
                    onDreamsChange(updated);
                    await saveDreams(updated);
                    setFillingBlankDay(false);
                    showList();
                  }}
                  style={styles.editBtn}
                >
                  <Ionicons name="trash-outline" size={20} color="#f87171" />
                </TouchableOpacity>
              ) : (
                <View style={{ width: 24 }} />
              )}
            </View>

            <ScrollView
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
            >
              {alreadyLoggedToday && !editing && (
                <View style={styles.warnBanner}>
                  <Ionicons name="information-circle-outline" size={16} color="#fbbf24" />
                  <Text style={styles.warnText}>
                    You already logged a dream today. You can still add another.
                  </Text>
                </View>
              )}

              <Text style={styles.label}>TITLE</Text>
              <TextInput
                style={styles.input}
                placeholder="Dream title..."
                placeholderTextColor={colors.textMuted}
                value={form.title}
                onChangeText={t => setForm(f => ({ ...f, title: t }))}
              />

              <Text style={[styles.label, { marginTop: 20 }]}>WHAT HAPPENED</Text>
              <TextInput
                style={[styles.input, styles.inputArea]}
                placeholder="Describe your dream..."
                placeholderTextColor={colors.textMuted}
                multiline
                value={form.description}
                onChangeText={text => setForm(f => ({ ...f, description: text }))}
              />
              <Text style={styles.wordCounter}>
                {wordCount} word{wordCount !== 1 ? 's' : ''}
              </Text>

              <Text style={[styles.label, { marginTop: 20 }]}>VIVIDNESS</Text>
              <Animated.View
                style={[styles.vividSelector, { transform: [{ translateX: vividShake }] }]}
              >
                {[1, 2, 3, 4, 5].map(n => (
                  <TouchableOpacity
                    key={n}
                    onPress={() => setForm(f => ({ ...f, vividness: n }))}
                    style={[styles.vividBtn, form.vividness >= n && styles.vividBtnOn]}
                  >
                    <View
                      style={[
                        styles.vividBtnInner,
                        form.vividness >= n && styles.vividBtnInnerOn,
                      ]}
                    />
                  </TouchableOpacity>
                ))}
              </Animated.View>

              <Text style={[styles.label, { marginTop: 20 }]}>LUCID DREAM</Text>
              <TouchableOpacity
                onPress={() => setForm(f => ({ ...f, lucid: !f.lucid }))}
                style={[styles.lucidToggle, form.lucid && styles.lucidToggleOn]}
                activeOpacity={0.75}
              >
                <Svg width={18} height={18} viewBox="0 0 18 18">
                  <Path
                    d="M9 1 C5 1 2 4 2 8 C2 12.5 5.5 15.5 9 17 C12.5 15.5 16 12.5 16 8 C16 4 13 1 9 1Z"
                    fill={form.lucid ? 'rgba(167,139,250,0.3)' : 'transparent'}
                    stroke={form.lucid ? '#a78bfa' : 'rgba(255,255,255,0.3)'}
                    strokeWidth={1.2}
                  />
                  <Circle cx={9} cy={8} r={2.5}
                    fill={form.lucid ? '#a78bfa' : 'rgba(255,255,255,0.2)'}
                  />
                </Svg>
                <Text style={[styles.lucidToggleText, form.lucid && styles.lucidToggleTextOn]}>
                  {form.lucid ? 'Yes, I was lucid' : 'I became aware I was dreaming'}
                </Text>
                <View style={[styles.lucidIndicator, form.lucid && styles.lucidIndicatorOn]} />
              </TouchableOpacity>

              <Text style={[styles.label, { marginTop: 20 }]}>MOOD</Text>
              <View style={styles.moodRow}>
                {([1, 2, 3, 4, 5]).map((v) => (
                  <TouchableOpacity
                    key={v}
                    onPress={() => setForm(f => ({ ...f, mood: f.mood === v ? 0 : v }))}
                    style={[styles.moodBtn, form.mood === v && styles.moodBtnOn]}
                    activeOpacity={0.7}
                  >
                    <JournalMoodFace index={v - 1} size={26} active={form.mood === v} />
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.moodSkip}>Optional. How did you feel when you woke up?</Text>

              <Text style={[styles.label, { marginTop: 20 }]}>TAGS</Text>
              <View style={styles.tagRow}>
                {TAGS.map(tag => (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => toggleTag(tag)}
                    style={[styles.tagToggle, form.tags.includes(tag) && styles.tagToggleOn]}
                  >
                    <Text style={styles.tagToggleText}>{tag}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, (overLimit || saving) && styles.saveBtnDisabled]}
                onPress={saveDream}
                disabled={overLimit || saving}
              >
                <Text style={styles.saveBtnText}>{saving ? 'Saving...' : editing ? 'Save changes' : 'Save dream'}</Text>
              </TouchableOpacity>

              {!editing && !fillingBlankDay && (
                <TouchableOpacity
                  style={styles.noMemoryBtn}
                  onPress={async () => {
                    // Save a no-memory entry for today then go back to list
                    const today = new Date();
                    const noMemEntry: Dream = {
                      id: Date.now().toString(),
                      title: '',
                      description: '',
                      vividness: 0,
                      tags: [],
                      date: today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
                      dateISO: toLocalISO(today),
                      noMemory: true,
                    };
                    const updated = [noMemEntry, ...dreams];
                    onDreamsChange(updated);
                    await saveDreams(updated);
                    setFillingBlankDay(false);
                    showList();
                  }}
                >
                  <Text style={styles.noMemoryBtnText}>I don't remember my dream</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </Animated.View>

      {/* ── Delete confirmation modal ── */}
      <Modal
        visible={deleteConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteConfirmVisible(false)}
      >
        <Pressable style={deleteStyles.overlay} onPress={() => setDeleteConfirmVisible(false)}>
          <Pressable style={deleteStyles.card} onPress={() => {}}>
            <Text style={deleteStyles.title}>Delete this dream?</Text>
            <Text style={deleteStyles.body}>This can't be undone.</Text>
            <View style={deleteStyles.btnRow}>
              <TouchableOpacity
                style={deleteStyles.cancelBtn}
                onPress={() => setDeleteConfirmVisible(false)}
              >
                <Text style={deleteStyles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={deleteStyles.deleteBtn} onPress={deleteDream}>
                <Text style={deleteStyles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
});

export default Journal;

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: 'Nunito_800ExtraBold',
    color: colors.textPrimary,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(167,139,250,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  searchWrapFocused: {
    borderColor: 'rgba(167,139,250,0.5)',
    backgroundColor: 'rgba(167,139,250,0.07)',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Nunito_300Light',
    color: colors.textPrimary,
    padding: 0,
  },
  resultCount: {
    fontSize: 12,
    fontFamily: 'Nunito_300Light',
    color: 'rgba(255,255,255,0.3)',
    marginHorizontal: 22,
    marginBottom: 4,
  },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontFamily: 'Nunito_600SemiBold',
    color: 'rgba(167,139,250,0.7)',
    letterSpacing: 0.5,
    marginRight: 10,
  },
  sectionHeaderLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: 'rgba(167,139,250,0.2)',
  },

  // Load more
  loadMoreBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 4,
  },
  loadMoreText: {
    fontSize: 14,
    fontFamily: 'Nunito_600SemiBold',
    color: 'rgba(167,139,250,0.7)',
  },

  warnBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(251,191,36,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(251,191,36,0.3)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  warnText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Nunito_300Light',
    color: '#fbbf24',
    lineHeight: 18,
  },

  listContent: { paddingHorizontal: 20, paddingBottom: 120 },
  emptyWrap: { alignItems: 'center', marginTop: 60 },
  emptyText: {
    color: colors.textMuted,
    fontFamily: 'Nunito_300Light',
    textAlign: 'center',
    marginTop: 12,
    fontSize: 15,
  },

  card: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: 12,
    padding: 16,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  cardDate: { fontSize: 13, fontFamily: 'Nunito_300Light', color: colors.textMuted },

  cardNoMemory: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cardNoMemoryDate: { fontSize: 13, fontFamily: 'Nunito_300Light', color: colors.textMuted },
  cardNoMemoryLabel: {
    fontSize: 13,
    fontFamily: 'Nunito_300Light',
    color: 'rgba(255,255,255,0.2)',
    fontStyle: 'italic',
  },

  vividRow: { flexDirection: 'row', gap: 6 },
  vividDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.15)' },
  vividDotOn: { backgroundColor: colors.primaryPurple },
  vividDotLg: { width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.15)' },
  vividDotLgOn: { backgroundColor: colors.primaryPurple },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    backgroundColor: 'rgba(139,92,246,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  tagText: { fontSize: 12, fontFamily: 'Nunito_300Light', color: colors.textPrimary },

  detailContent: { paddingHorizontal: 24, paddingBottom: 80 },
  detailDate: {
    fontSize: 14,
    fontFamily: 'Nunito_300Light',
    color: colors.textMuted,
    marginBottom: 16,
  },
  detailBody: {
    fontSize: 16,
    fontFamily: 'Nunito_300Light',
    color: colors.textPrimary,
    lineHeight: 26,
  },
  detailBodyMuted: {
    fontSize: 15,
    fontFamily: 'Nunito_300Light',
    color: colors.textMuted,
    fontStyle: 'italic',
  },

  detailMoodRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16,
  },
  detailMoodLabel: {
    fontSize: 12, fontFamily: 'Nunito_600SemiBold',
    color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  detailMoodEmoji: { fontSize: 22 },

  formContent: { paddingHorizontal: 20, paddingBottom: 60 },
  label: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1,
    marginBottom: 8,
    fontFamily: 'Nunito_600SemiBold',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: 14,
    color: colors.textPrimary,
    fontFamily: 'Nunito_300Light',
    fontSize: 15,
  },
  inputArea: { minHeight: 130, textAlignVertical: 'top' },
  wordCounter: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'right',
    marginTop: 6,
    fontFamily: 'Nunito_300Light',
  },
  wordCounterOver: { color: '#f87171' },

  vividSelector: { flexDirection: 'row', gap: 14 },
  vividBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vividBtnOn: { backgroundColor: 'rgba(91,79,212,0.35)' },
  vividBtnInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  vividBtnInnerOn: { backgroundColor: colors.primaryPurple },

  lucidToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 4,
  },
  lucidToggleOn: {
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderColor: 'rgba(167,139,250,0.4)',
  },
  lucidToggleText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Nunito_400Regular',
    color: 'rgba(255,255,255,0.45)',
  },
  lucidToggleTextOn: {
    color: '#c4baff',
    fontFamily: 'Nunito_600SemiBold',
  },
  lucidIndicator: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
  },
  lucidIndicatorOn: {
    backgroundColor: '#a78bfa',
    borderColor: '#a78bfa',
  },

  lucidBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 1,
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.35)',
  },
  lucidBadgeText: {
    fontSize: 11, fontFamily: 'Nunito_600SemiBold', color: '#c4baff',
  },

  moodRow:    { flexDirection: 'row', gap: 10, marginBottom: 6 },
  moodBtn:    {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)',
  },
  moodBtnOn:  { backgroundColor: 'rgba(167,139,250,0.18)', borderColor: 'rgba(167,139,250,0.5)' },
  moodEmoji:  { fontSize: 24, opacity: 0.4 },
  moodEmojiOn:{ opacity: 1 },
  moodSkip:   { fontSize: 11, fontFamily: 'Nunito_300Light', color: colors.textMuted, marginBottom: 4 },

  tagToggle: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    marginBottom: 8,
  },
  tagToggleOn: { backgroundColor: 'rgba(91,79,212,0.35)' },
  tagToggleText: { fontSize: 14, fontFamily: 'Nunito_300Light', color: colors.textPrimary },

  noMemoryBtn: {
    alignItems: 'center',
    padding: 14,
    marginTop: 4,
  },
  noMemoryBtnText: {
    fontSize: 14,
    fontFamily: 'Nunito_300Light',
    color: 'rgba(255,255,255,0.35)',
  },

  monthRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  monthChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  monthChipActive: {
    backgroundColor: 'rgba(167,139,250,0.18)',
    borderColor: 'rgba(167,139,250,0.45)',
  },
  monthChipText: {
    fontSize: 13,
    fontFamily: 'Nunito_600SemiBold',
    color: 'rgba(255,255,255,0.4)',
  },
  monthChipTextActive: {
    color: '#c4baff',
  },

  // search + filter row
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingBottom: 8,
  },
  // month dropdown trigger
  monthDropdownTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10, paddingVertical: 7,
  },
  monthDropdownTriggerActive: {
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderColor: 'rgba(167,139,250,0.4)',
  },
  monthDropdownTriggerText: {
    fontSize: 12, fontFamily: 'Nunito_600SemiBold', color: 'rgba(255,255,255,0.4)',
  },
  monthDropdownTriggerTextActive: { color: '#c4baff' },
  monthDropdownCaret: { fontSize: 10, color: 'rgba(255,255,255,0.35)', lineHeight: 14 },
  monthDropdownMenu: {
    backgroundColor: '#110c28',
    borderRadius: 12, borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.28)',
    minWidth: 160,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6, shadowRadius: 14, elevation: 12,
  },
  monthDropdownItem: { paddingHorizontal: 14, paddingVertical: 12 },
  monthDropdownItemFirst: { borderTopLeftRadius: 11, borderTopRightRadius: 11 },
  monthDropdownItemLast:  { borderBottomLeftRadius: 11, borderBottomRightRadius: 11 },
  monthDropdownItemActive: { backgroundColor: 'rgba(167,139,250,0.14)' },
  monthDropdownItemText: {
    fontSize: 13, fontFamily: 'Nunito_600SemiBold', color: 'rgba(255,255,255,0.5)',
  },
  monthDropdownItemTextActive: { color: '#c4baff' },

  saveBtn: {
    backgroundColor: colors.primaryPurple,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  saveBtnDisabled: { backgroundColor: 'rgba(91,79,212,0.35)' },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textPrimary,
  },
});

const skeletonStyles = StyleSheet.create({
  card: { backgroundColor: 'rgba(255,255,255,1)', borderRadius: 16, padding: 16, marginBottom: 12 },
  row:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  line: { backgroundColor: 'rgba(255,255,255,1)', borderRadius: 6 },
});

const deleteStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    paddingBottom: 32,
    paddingHorizontal: 16,
    paddingTop: 80,
  },
  card: {
    backgroundColor: '#1a1730',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  title: {
    fontSize: 20,
    fontFamily: 'Nunito_800ExtraBold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  body: { fontSize: 14, fontFamily: 'Nunito_300Light', color: colors.textMuted, marginBottom: 28 },
  btnRow: { flexDirection: 'row', gap: 12, width: '100%' },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontFamily: 'Nunito_600SemiBold', color: colors.textMuted },
  deleteBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(248,113,113,0.15)',
    borderWidth: 0.5,
    borderColor: '#f87171',
    alignItems: 'center',
  },
  deleteText: { fontSize: 15, fontFamily: 'Nunito_600SemiBold', color: '#f87171' },
});