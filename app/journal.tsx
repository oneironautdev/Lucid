import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  Animated,
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
import { countWords, Dream, saveDreams, WORD_LIMIT } from '../utils/storage';

export type { Dream };

export interface JournalHandle {
  openForm: () => void;
}

function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface Props {
  openDreamId?: string | null;
  onDreamOpened?: () => void;
  dreams: Dream[];
  onDreamsChange: (dreams: Dream[]) => void;
}

type View_ = 'list' | 'form' | 'detail';

const TAGS = [
  'lucid', 'flying', 'falling', 'vivid', 'nightmare', 'recurring',
  'people', 'places', 'water', 'chased', 'lost', 'school',
  'work', 'family', 'strangers', 'animals', 'darkness', 'light',
  'floating', 'paralysis', 'voices', 'music', 'violence', 'death',
  'transformation', 'time travel', 'space', 'underwater', 'forest',
  'city', 'childhood home', 'teeth', 'naked', 'late for something',
  "can't move", "can't scream", 'doors', 'mirrors', 'vehicles',
  'weather', 'fire', 'being watched', 'maze', 'portal', 'prophetic',
];

// How many dreams to show per "page" before tapping Load More
const PAGE_SIZE = 20;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMonthKey(dateISO: string): string {
  // dateISO is "YYYY-MM-DD"
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

const Journal = React.forwardRef<JournalHandle, Props>(function Journal(
  { openDreamId, onDreamOpened, dreams, onDreamsChange }: Props,
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

  // Pagination — number of dreams (flat) currently visible
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const vividShake = useRef(new Animated.Value(0)).current;

  const emptyForm = () => ({ title: '', description: '', vividness: 1, tags: [] as string[], mood: 0 as number });
  const [form, setForm] = useState(emptyForm());

  // Animation refs — we keep both layers mounted but use opacity + pointerEvents
  // to avoid the remount flash that was happening before.
  const listOpacity = useRef(new Animated.Value(1)).current;
  const listTransY = useRef(new Animated.Value(0)).current;
  const panelOpacity = useRef(new Animated.Value(0)).current;

  // ── Filtered + paginated data ──────────────────────────────────────────────

  // Find the earliest real (non-noMemory) dream date so we never show
  // orphaned noMemory placeholders that predate the user's first entry.
  const firstRealDateISO = useMemo(() => {
    const real = dreams.filter(d => !d.noMemory);
    if (real.length === 0) return null;
    return real.reduce((min, d) => (d.dateISO < min ? d.dateISO : min), real[0].dateISO);
  }, [dreams]);

  const filtered = useMemo(() => {
    // Strip noMemory entries that predate the first real dream
    const valid = firstRealDateISO
      ? dreams.filter(d => !d.noMemory || d.dateISO >= firstRealDateISO)
      : dreams;

    if (!searchText.trim()) return valid;
    const q = searchText.toLowerCase();
    return valid.filter(
      d =>
        d.title.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q) ||
        d.tags.some(t => t.toLowerCase().includes(q))
    );
  }, [dreams, searchText, firstRealDateISO]);

  // Reset pagination when search changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchText]);

  // Slice to current page, then section-group
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
  }));

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!openDreamId || dreams.length === 0) return;
    const dream = dreams.find(d => d.id === openDreamId);
    if (dream) {
      setSelected(dream);
      setEditing(false);
      showPanel('detail', true);
      onDreamOpened?.();
    }
  }, [openDreamId, dreams]);

  useEffect(() => {
    if (dreams.length === 0) {
      setSelected(null);
      setEditing(false);
      showList();
    }
  }, [dreams.length]);

  // ── Navigation animations ──────────────────────────────────────────────────

  // Drives fade-in after panel content has mounted.
  // We set panelOpacity to 0 before setView, then this effect fires
  // after React has committed the new content to the tree — guaranteeing
  // no flash of un-animated content.
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

  const saveDream = async () => {
    if (!form.title.trim()) return;
    if (!form.vividness || form.vividness < 1) {
      shakeVividness();
      return;
    }

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
      loggedAt: useExisting ? (selected!.loggedAt ?? new Date().toISOString()) : new Date().toISOString(),
      wbtbNight: useExisting ? selected!.wbtbNight : undefined, // set by WBTB alarm arm in future
    };

    let updated: Dream[];
    if ((editing || fillingBlankDay) && selected) {
      updated = dreams.map(d => (d.id === selected.id ? dream : d));
    } else {
      updated = [dream, ...dreams];
    }

    onDreamsChange(updated);
    await saveDreams(updated);
    setFillingBlankDay(false);
    showList();
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
  const wordsLeft = WORD_LIMIT - wordCount;
  const overLimit = wordsLeft < 0;

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item: dream }: { item: Dream }) =>
      dream.noMemory ? (
        <TouchableOpacity
          style={styles.cardNoMemory}
          onPress={() => {
            setSelected(dream);
            setForm({ title: '', description: '', vividness: 1, tags: [] });
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
          <VividDots v={dream.vividness} />
          {dream.tags.length > 0 && (
            <View style={styles.tagRow}>
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

        {/* Search bar */}
        <View style={[styles.searchWrap, searchFocused && styles.searchWrapFocused]}>
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

        {/* Count hint when filtered */}
        {searchText.trim().length > 0 && (
          <Text style={styles.resultCount}>
            {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
          </Text>
        )}

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
          // Perf tuning — prevents blank-area scroll bug
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      </Animated.View>

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
                <View style={{ marginBottom: 16 }}>
                  <VividDots v={selected.vividness} large />
                </View>
              )}
              {!selected.noMemory && selected.mood != null && selected.mood > 0 && (
                <View style={styles.detailMoodRow}>
                  <Text style={styles.detailMoodLabel}>Mood</Text>
                  <Text style={styles.detailMoodEmoji}>
                    {(['😞','😐','🙂','😄','😆'])[selected.mood - 1]}
                  </Text>
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
              <Text style={[styles.wordCounter, overLimit && styles.wordCounterOver]}>
                {wordsLeft < 0
                  ? `${Math.abs(wordsLeft)} words over limit`
                  : `${wordsLeft} words remaining`}
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

              <Text style={[styles.label, { marginTop: 20 }]}>MOOD</Text>
              <View style={styles.moodRow}>
                {([
                  { v: 1, emoji: '😞' },
                  { v: 2, emoji: '😐' },
                  { v: 3, emoji: '🙂' },
                  { v: 4, emoji: '😄' },
                  { v: 5, emoji: '😆' },
                ] as { v: number; emoji: string }[]).map(({ v, emoji }) => (
                  <TouchableOpacity
                    key={v}
                    onPress={() => setForm(f => ({ ...f, mood: f.mood === v ? 0 : v }))}
                    style={[styles.moodBtn, form.mood === v && styles.moodBtnOn]}
                  >
                    <Text style={[styles.moodEmoji, form.mood === v && styles.moodEmojiOn]}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.moodSkip}>Optional — how did you feel when you woke up?</Text>

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
                style={[styles.saveBtn, overLimit && styles.saveBtnDisabled]}
                onPress={saveDream}
                disabled={overLimit}
              >
                <Text style={styles.saveBtnText}>{editing ? 'Save changes' : 'Save dream'}</Text>
              </TouchableOpacity>
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
    marginHorizontal: 20,
    marginBottom: 8,
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

  vividRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
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

const deleteStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    paddingBottom: 32,
    paddingHorizontal: 16,
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