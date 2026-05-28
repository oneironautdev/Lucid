import {
  Canvas,
  Circle,
  Group,
  Line,
  Path,
  RoundedRect,
  Skia,
  Text as SkiaText,
  useFont,
  vec,
} from '@shopify/react-native-skia';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Dream, saveDreams } from '../utils/storage';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_PADDING = 16;
const CARD_MARGIN = 12;

// ─── Fonts ────────────────────────────────────────────────────────────────────
const FONT_SEMI = require('@expo-google-fonts/nunito/600SemiBold/Nunito_600SemiBold.ttf');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Returns the Monday of the week containing `date`
function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function getWeekKey(date: Date): string {
  const mon = getWeekMonday(date);
  return toISO(mon);
}

// "May 19" format
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatWeekLabel(isoMonday: string): string {
  const [y, m, d] = isoMonday.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

function expSmooth(data: number[], alpha = 0.35): number[] {
  if (data.length === 0) return [];
  const result = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(alpha * data[i] + (1 - alpha) * result[i - 1]);
  }
  return result;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// ─── Colors ───────────────────────────────────────────────────────────────────
const PURPLE     = '#a78bfa';
const AMBER      = '#fbbf24';
const WHITE_DIM  = 'rgba(255,255,255,0.07)';
const WHITE_MID  = 'rgba(255,255,255,0.12)';
const TEXT_MUTED = 'rgba(255,255,255,0.4)';
const TEXT_PRIMARY = '#f0ecff';

// ─── UI primitives ────────────────────────────────────────────────────────────
function SectionHeader({ label }: { label: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionDot} />
      <Text style={styles.sectionLabel}>{label}</Text>
    </View>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function DeltaPill({ value, unit }: { value: number; unit: string }) {
  const neutral = value === 0;
  const positive = value > 0;
  const bg = neutral ? 'rgba(255,255,255,0.08)' : positive ? 'rgba(167,139,250,0.18)' : 'rgba(251,191,36,0.15)';
  const textColor = neutral ? TEXT_MUTED : positive ? PURPLE : AMBER;
  const prefix = positive ? '+' : '';
  return (
    <View style={[styles.deltaPill, { backgroundColor: bg }]}>
      <Text style={[styles.deltaText, { color: textColor }]}>{prefix}{value} {unit}</Text>
    </View>
  );
}

// ─── Line chart ───────────────────────────────────────────────────────────────
interface LineChartSkiaProps {
  data: number[];
  trend: number[];
  labels: string[];      // "May 19" etc, one per data point
  height?: number;
  yMin?: number;
  yMax?: number;
}

function LineChartSkia({ data, trend, labels, height = 180, yMin, yMax }: LineChartSkiaProps) {
  const font = useFont(FONT_SEMI, 10);

  // Leave generous left pad for y labels, right pad for last x label overflow
  const chartW = SCREEN_W - CARD_PADDING * 2 - 32;
  const chartH = height;
  const padL = 22;
  const padR = 10;
  const padT = 10;
  const padB = 32; // extra room for rotated/angled x labels
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const maxVal = yMax ?? data.reduce((m, v) => Math.max(m, v), 1);
  const minVal = yMin ?? 0;
  const allTicks = Array.from({ length: Math.floor(maxVal - minVal) + 1 }, (_, i) => Math.floor(minVal) + i);
  // If more than 8 ticks, only show every other (or every third etc)
  const tickSkip = Math.ceil(allTicks.length / 8);
  const yTicks = allTicks.filter(t => t % tickSkip === 0 || t === maxVal);

  const xOf = (i: number) => padL + (i / Math.max(data.length - 1, 1)) * plotW;
  const yOf = (v: number) => padT + plotH - ((v - minVal) / (maxVal - minVal)) * plotH;

  const linePath = (() => {
    const p = Skia.Path.Make();
    data.forEach((v, i) => {
      const x = xOf(i); const y = yOf(v);
      if (i === 0) { p.moveTo(x, y); return; }
      const px = xOf(i - 1); const py = yOf(data[i - 1]);
      const cpx = px + (x - px) * 0.5;
      p.cubicTo(cpx, py, cpx, y, x, y);
    });
    return p;
  })();

  const fillPath = (() => {
    const p = Skia.Path.Make();
    data.forEach((v, i) => {
      const x = xOf(i); const y = yOf(v);
      if (i === 0) { p.moveTo(x, y); return; }
      const px = xOf(i - 1); const py = yOf(data[i - 1]);
      const cpx = px + (x - px) * 0.5;
      p.cubicTo(cpx, py, cpx, y, x, y);
    });
    p.lineTo(xOf(data.length - 1), padT + plotH);
    p.lineTo(padL, padT + plotH);
    p.close();
    return p;
  })();

  const trendPath = (() => {
    const p = Skia.Path.Make();
    trend.forEach((v, i) => {
      const x = xOf(i); const y = yOf(v);
      if (i === 0) p.moveTo(x, y); else p.lineTo(x, y);
    });
    return p;
  })();

  if (!font) return <View style={{ height: chartH }} />;

  // Range labels like "Apr 7–13" are ~60px wide at font size 10 — space accordingly
  const minLabelSpacingPx = 62;
  const spacingPx = data.length > 1 ? plotW / (data.length - 1) : plotW;
  const labelEvery = Math.max(1, Math.ceil(minLabelSpacingPx / spacingPx));
  const showLabel = (i: number) =>
    (data.length - 1 - i) % labelEvery === 0;

  const canvasKey = data.join(',') + (font ? '1' : '0');

  return (
    <Canvas key={canvasKey} style={{ width: chartW, height: chartH }}>
      {/* Y grid + labels */}
      {yTicks.map((tick, ti) => (
        <Group key={ti}>
          <Line
            p1={vec(padL, yOf(tick))}
            p2={vec(padL + plotW, yOf(tick))}
            color="rgba(255,255,255,0.07)"
            strokeWidth={1}
          />
          <SkiaText x={0} y={yOf(tick) + 4} text={String(tick)} font={font} color={TEXT_MUTED} />
        </Group>
      ))}

      {/* Area fill */}
      <Path path={fillPath} color="rgba(167,139,250,0.07)" />

      {/* Glow + main line */}
      <Path path={linePath} color="rgba(167,139,250,0.22)" strokeWidth={7} style="stroke" strokeJoin="round" strokeCap="round" />
      <Path path={linePath} color={PURPLE} strokeWidth={2} style="stroke" strokeJoin="round" strokeCap="round" />

      {/* Trend */}
      <Path path={trendPath} color={AMBER} strokeWidth={1.5} style="stroke" strokeJoin="round" strokeCap="round" />

      {/* Dots */}
      {data.map((v, i) => (
        <Group key={i}>
          <Circle cx={xOf(i)} cy={yOf(v)} r={5} color="rgba(167,139,250,0.25)" />
          <Circle cx={xOf(i)} cy={yOf(v)} r={3} color={PURPLE} />
        </Group>
      ))}

      {/* X labels — "May 19", every other */}
      {labels.map((lbl, i) => {
        if (!showLabel(i)) return null;
        const cx = xOf(i);
        const lblW = lbl.length * 5.5;
        const x = clamp(cx - lblW / 2, padL, chartW - lblW - padR);
        return (
          <SkiaText key={i} x={x} y={padT + plotH + 18} text={lbl} font={font} color={TEXT_MUTED} />
        );
      })}
    </Canvas>
  );
}

// ─── Vividness chart ──────────────────────────────────────────────────────────
interface VividnessChartProps {
  data: { label: string; avg: number }[];
}

function VividnessChart({ data }: VividnessChartProps) {
  const font = useFont(FONT_SEMI, 10);

  const chartW = SCREEN_W - CARD_PADDING * 2 - 32;
  const chartH = 140;
  const padL = 26;   // enough room for "5" label
  const padR = 8;
  const padT = 10;
  const padB = 28;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const n = data.length;
  const BAR_W = Math.max(10, Math.min(32, plotW / Math.max(n, 1) - 6));

  const yOf = (v: number) => padT + plotH - ((v - 1) / 4) * plotH;

  if (!font) return <View style={{ height: chartH }} />;

  const vivCanvasKey = data.map(d => d.avg).join(',') + (font ? '1' : '0');

  return (
    <Canvas key={vivCanvasKey} style={{ width: chartW, height: chartH }}>
      {/* Y grid lines + labels at 1, 2, 3, 4, 5 */}
      {[1, 2, 3, 4, 5].map(tick => {
        const y = yOf(tick);
        return (
          <Group key={tick}>
            <Line p1={vec(padL, y)} p2={vec(padL + plotW, y)} color="rgba(255,255,255,0.06)" strokeWidth={1} />
            <SkiaText x={0} y={y + 4} text={String(tick)} font={font} color={TEXT_MUTED} />
          </Group>
        );
      })}

      {/* Bars — evenly distributed across plotW */}
      {(() => {
        const barSpacingPx = n > 0 ? plotW / n : plotW;
        const vivLabelEvery = Math.max(1, Math.ceil(46 / barSpacingPx));
        return data.map((d, i) => {
          const centerX = padL + (i + 0.5) * (plotW / n);
          const x = centerX - BAR_W / 2;
          const barH = Math.max(((d.avg - 1) / 4) * plotH, 2);
          const y = padT + plotH - barH;
          const opacity = 0.35 + (d.avg / 5) * 0.65;
          const showLbl = (n - 1 - i) % vivLabelEvery === 0;
          const lblW = d.label.length * 5.5;
          const lblX = clamp(centerX - lblW / 2, padL, chartW - lblW);
          return (
            <Group key={i}>
              <RoundedRect x={x} y={padT} width={BAR_W} height={plotH} r={4} color="rgba(255,255,255,0.05)" />
              <RoundedRect x={x} y={y} width={BAR_W} height={barH} r={4} color={PURPLE} opacity={opacity} />
              <SkiaText
                x={clamp(centerX - 7, padL, chartW - 16)}
                y={Math.max(y - 4, padT + 10)}
                text={d.avg.toFixed(1)}
                font={font}
                color="rgba(167,139,250,0.7)"
              />
              {showLbl && (
                <SkiaText x={lblX} y={chartH - 6} text={d.label} font={font} color={TEXT_MUTED} />
              )}
            </Group>
          );
        });
      })()}
    </Canvas>
  );
}

// ─── Horizontal bar chart ─────────────────────────────────────────────────────
function HBarChart({ items }: { items: { label: string; value: number }[] }) {
  const font = useFont(FONT_SEMI, 11);
  const topItems = items.slice(0, 7);
  const ROW_H = 32;
  const LABEL_W = 88;
  const COUNT_W = 24;
  const chartW = SCREEN_W - CARD_PADDING * 2 - 32;
  const chartH = topItems.length * ROW_H + 4;
  const barZoneW = chartW - LABEL_W - COUNT_W - 8;
  const maxVal = topItems.reduce((m, i) => Math.max(m, i.value), 1);

  if (!font) return <View style={{ height: chartH }} />;

  const hbarCanvasKey = topItems.map(i => i.value).join(',') + (font ? '1' : '0');

  return (
    <Canvas key={hbarCanvasKey} style={{ width: chartW, height: chartH }}>
      {topItems.map((item, i) => {
        const cy = i * ROW_H + ROW_H / 2;
        const bw = (item.value / maxVal) * barZoneW;
        const lbl = item.label.length > 11 ? item.label.slice(0, 10) + '…' : item.label;
        return (
          <Group key={i}>
            <SkiaText x={0} y={cy + 4} text={lbl} font={font} color={TEXT_MUTED} />
            {/* Track */}
            <RoundedRect x={LABEL_W} y={cy - 8} width={barZoneW} height={16} r={8} color="rgba(255,255,255,0.05)" />
            {/* Fill */}
            {bw > 0 && (
              <RoundedRect x={LABEL_W} y={cy - 8} width={bw} height={16} r={8} color={PURPLE} opacity={0.8} />
            )}
            {/* Count */}
            <SkiaText x={LABEL_W + barZoneW + 6} y={cy + 4} text={String(item.value)} font={font} color={TEXT_MUTED} />
          </Group>
        );
      })}
    </Canvas>
  );
}

// ─── Consistency grid ─────────────────────────────────────────────────────────
interface ConsistencyGridProps {
  allDreams: Dream[];
  maxDays?: number;
}

function ConsistencyGrid({ allDreams, maxDays = 49 }: ConsistencyGridProps) {
  const DOT = 11;
  const GAP = 4;
  const COLS = 7;

  // Anchor to first ever logged day (or up to maxDays ago, whichever is more recent)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Anchor logic:
  // - Start from the first REAL dream date (so phantom noMemory entries from
  //   before the user ever started don't push the grid back).
  // - But also include noMemory entries that are adjacent (within 1 day before)
  //   the first real dream — e.g. user logged "no memory" on day 1 and their
  //   first real dream was day 2.
  const realDreams = allDreams.filter(d => !d.noMemory);
  const sortedISOs = [...new Set(allDreams.map(d => d.dateISO))].sort();

  const firstRealISO = realDreams.length > 0
    ? [...new Set(realDreams.map(d => d.dateISO))].sort()[0]
    : toISO(today);

  // One day before the first real dream (in local time)
  const [fry, frm, frd] = firstRealISO.split('-').map(Number);
  const dayBeforeFirstReal = new Date(fry, frm - 1, frd - 1, 0, 0, 0, 0);
  const dayBeforeFirstRealISO = toISO(dayBeforeFirstReal);

  // Use the earliest entry that is >= dayBeforeFirstReal
  const firstEverISO = sortedISOs[0] ?? firstRealISO;
  const firstISO = firstEverISO >= dayBeforeFirstRealISO ? firstEverISO : firstRealISO;
  // Parse YYYY-MM-DD as local date (not UTC) to avoid timezone-off-by-one
  const [fy, fm, fd] = firstISO.split('-').map(Number);
  const firstDate = new Date(fy, fm - 1, fd, 0, 0, 0, 0);

  const anchorAgo = new Date(today);
  anchorAgo.setDate(today.getDate() - (maxDays - 1));
  const startDate = firstDate > anchorAgo ? firstDate : anchorAgo;

  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.round((today.getTime() - startDate.getTime()) / msPerDay) + 1;

  const ROWS = Math.ceil(days / COLS);
  const gridW = COLS * (DOT + GAP) - GAP;
  const gridH = ROWS * (DOT + GAP) - GAP;

  // All logged dates (including noMemory — it's still a habit)
  const loggedAll = new Set(allDreams.map(d => d.dateISO));
  // Dates with actual recall
  const loggedRecall = new Set(allDreams.filter(d => !d.noMemory).map(d => d.dateISO));

  const dots: { x: number; y: number; recall: boolean; noMem: boolean; isFirst: boolean }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const iso = toISO(d);
    dots.push({
      x: (i % COLS) * (DOT + GAP) + DOT / 2,
      y: Math.floor(i / COLS) * (DOT + GAP) + DOT / 2,
      recall: loggedRecall.has(iso),
      noMem: loggedAll.has(iso) && !loggedRecall.has(iso),
      isFirst: iso === firstISO,
    });
  }

  // Summary stats — only count from start date forward
  const recallNights = dots.filter(d => d.recall).length;
  const noMemNights  = dots.filter(d => d.noMem).length;
  const missedNights = days - recallNights - noMemNights;

  return (
    <View style={styles.consistencyWrap}>
      {/* Dot grid */}
      <Canvas style={{ width: gridW, height: gridH }}>
        {dots.map((dot, i) => (
          <Circle
            key={i}
            cx={dot.x}
            cy={dot.y}
            r={DOT / 2}
            color={
              dot.isFirst ? AMBER
              : dot.recall ? PURPLE
              : dot.noMem ? 'rgba(167,139,250,0.25)'
              : 'rgba(255,255,255,0.08)'
            }
          />
        ))}
      </Canvas>

      {/* Right-side summary */}
      <View style={styles.consistencySummary}>
        <View style={styles.summaryStatBlock}>
          <Text style={styles.summaryStatNum}>{recallNights}</Text>
          <Text style={styles.summaryStatLbl}>recalled</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryStatBlock}>
          <Text style={[styles.summaryStatNum, { color: 'rgba(167,139,250,0.5)' }]}>{noMemNights}</Text>
          <Text style={styles.summaryStatLbl}>no memory</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryStatBlock}>
          <Text style={[styles.summaryStatNum, { color: TEXT_MUTED }]}>{missedNights}</Text>
          <Text style={styles.summaryStatLbl}>not logged</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Factor / correlation row ─────────────────────────────────────────────────
function FactorRow({ label, sub, pct }: { label: string; sub: string; pct: number }) {
  const positive = pct >= 0;
  const color    = positive ? '#a78bfa' : '#fb923c';
  const sign     = positive ? '+' : '';
  return (
    <View style={factorStyles.row}>
      <View style={{ flex: 1 }}>
        <Text style={factorStyles.label}>{label}</Text>
        <Text style={factorStyles.sub}>{sub}</Text>
      </View>
      <View style={[factorStyles.pill, { backgroundColor: positive ? 'rgba(167,139,250,0.13)' : 'rgba(251,146,60,0.13)' }]}>
        <Text style={[factorStyles.pct, { color }]}>{sign}{pct}%</Text>
      </View>
    </View>
  );
}

const factorStyles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.07)' },
  label: { fontSize: 14, fontFamily: 'Nunito_600SemiBold', color: '#f0ecff', marginBottom: 2 },
  sub:   { fontSize: 11, fontFamily: 'Nunito_300Light', color: 'rgba(255,255,255,0.4)' },
  pill:  { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, minWidth: 64, alignItems: 'center' },
  pct:   { fontSize: 14, fontFamily: 'Nunito_800ExtraBold' },
});

// ─── Main component ───────────────────────────────────────────────────────────
interface AnalyticsProps {
  dreams: Dream[];
  onDreamsChange: (dreams: Dream[]) => void;
}

export default function Analytics({ dreams, onDreamsChange }: AnalyticsProps) {
  const [debugDays, setDebugDays] = useState('100');
  const [debugVisible, setDebugVisible] = useState(false);

  // Only real dreams (exclude noMemory) for recall + vividness charts
  const recallDreams = useMemo(() => dreams.filter(d => !d.noMemory), [dreams]);

  // ── Weekly recall (count all recall dreams per week, no dedup per night) ──
  const weeklyData = useMemo(() => {
    const counts: Record<string, number> = {};
    recallDreams.forEach(d => {
      const k = getWeekKey(new Date(d.dateISO));
      counts[k] = (counts[k] || 0) + 1;
    });
    const sorted = Object.keys(counts).sort().slice(-8);
    const data = sorted.map(k => counts[k]);
    const trend = expSmooth(data);
    const labels = sorted.map(formatWeekLabel);
    return { data, trend, labels };
  }, [recallDreams]);

  // ── Vividness per week (recall dreams only) ────────────────────────────────
  const vividnessData = useMemo(() => {
    const map: Record<string, number[]> = {};
    recallDreams.forEach(d => {
      if (d.vividness) {
        const k = getWeekKey(new Date(d.dateISO));
        if (!map[k]) map[k] = [];
        map[k].push(d.vividness);
      }
    });
    return Object.keys(map).sort().slice(-8).map(k => ({
      label: formatWeekLabel(k),
      avg: parseFloat((map[k].reduce((a, b) => a + b, 0) / map[k].length).toFixed(1)),
    }));
  }, [recallDreams]);

  // ── Tags ──────────────────────────────────────────────────────────────────
  const tagData = useMemo(() => {
    const counts: Record<string, number> = {};
    dreams.forEach(d => {
      d.tags?.forEach(tag => {
        const t = tag.toLowerCase().trim();
        if (t) counts[t] = (counts[t] || 0) + 1;
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  }, [dreams]);

  // ── Streak + 28-day consistency ────────────────────────────────────────────
  const consistencyData = useMemo(() => {
    const logged = new Set(dreams.map(d => d.dateISO));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let streak = 0;
    const cursor = new Date(today);
    if (!logged.has(toISO(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (logged.has(toISO(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
    return { streak };
  }, [dreams]);

  // ── Week-over-week ─────────────────────────────────────────────────────────
  const weekOverWeek = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const thisStart = new Date(now); thisStart.setDate(now.getDate() - now.getDay());
    const lastStart = new Date(thisStart); lastStart.setDate(thisStart.getDate() - 7);

    let thisCount = 0, lastCount = 0;
    let thisViv = 0, lastViv = 0, thisVivN = 0, lastVivN = 0;

    recallDreams.forEach(d => {
      const date = new Date(d.dateISO);
      if (date >= thisStart) {
        thisCount++;
        if (d.vividness) { thisViv += d.vividness; thisVivN++; }
      } else if (date >= lastStart) {
        lastCount++;
        if (d.vividness) { lastViv += d.vividness; lastVivN++; }
      }
    });

    const thisAvgViv = thisVivN ? parseFloat((thisViv / thisVivN).toFixed(1)) : 0;
    const lastAvgViv = lastVivN ? parseFloat((lastViv / lastVivN).toFixed(1)) : 0;

    return {
      dreamDelta: thisCount - lastCount,
      vivDelta: parseFloat((thisAvgViv - lastAvgViv).toFixed(1)),
      thisCount,
      thisAvgViv,
    };
  }, [recallDreams]);

  // ── Mood per week ──────────────────────────────────────────────────────────
  const moodData = useMemo(() => {
    const map: Record<string, number[]> = {};
    recallDreams.forEach(d => {
      if (d.mood && d.mood > 0) {
        const k = getWeekKey(new Date(d.dateISO));
        if (!map[k]) map[k] = [];
        map[k].push(d.mood);
      }
    });
    const sorted = Object.keys(map).sort().slice(-8);
    if (sorted.length < 2) return null;
    const data   = sorted.map(k => parseFloat((map[k].reduce((a, b) => a + b, 0) / map[k].length).toFixed(2)));
    const trend  = expSmooth(data);
    const labels = sorted.map(formatWeekLabel);
    return { data, trend, labels };
  }, [recallDreams]);

  // ── Dream factors (% change comparisons) ──────────────────────────────────
  const dreamFactors = useMemo(() => {
    const factors: { label: string; sub: string; pct: number }[] = [];
    if (recallDreams.length < 10) return factors;

    // Group dreams by date so we can look at "nights"
    const byDate: Record<string, typeof recallDreams> = {};
    recallDreams.forEach(d => {
      if (!byDate[d.dateISO]) byDate[d.dateISO] = [];
      byDate[d.dateISO].push(d);
    });
    const nights = Object.values(byDate);

    // 1. WBTB nights vs normal — recall count per night
    const wbtbNights  = nights.filter(n => n.some(d => d.wbtbNight));
    const normNights  = nights.filter(n => n.every(d => !d.wbtbNight));
    if (wbtbNights.length >= 3 && normNights.length >= 3) {
      const avgWbtb = wbtbNights.reduce((s, n) => s + n.length, 0) / wbtbNights.length;
      const avgNorm = normNights.reduce((s, n) => s + n.length, 0) / normNights.length;
      if (avgNorm > 0) {
        factors.push({
          label: 'WBTB nights',
          sub: 'dream recall per night',
          pct: Math.round(((avgWbtb - avgNorm) / avgNorm) * 100),
        });
      }
    }

    // 2. Quick logging (within 10 min) vs later — avg vividness
    const withLogTime = recallDreams.filter(d => d.loggedAt && d.vividness > 0);
    if (withLogTime.length >= 6) {
      const quick = withLogTime.filter(d => {
        const logMs  = new Date(d.loggedAt!).getTime();
        const dayMs  = new Date(d.dateISO + 'T00:00:00').getTime();
        const diffMin = (logMs - dayMs) / 60000;
        return diffMin <= 10;
      });
      const later = withLogTime.filter(d => {
        const logMs  = new Date(d.loggedAt!).getTime();
        const dayMs  = new Date(d.dateISO + 'T00:00:00').getTime();
        const diffMin = (logMs - dayMs) / 60000;
        return diffMin > 10;
      });
      if (quick.length >= 3 && later.length >= 3) {
        const avgQ = quick.reduce((s, d) => s + d.vividness, 0) / quick.length;
        const avgL = later.reduce((s, d) => s + d.vividness, 0) / later.length;
        if (avgL > 0) {
          factors.push({
            label: 'Quick logging (≤10 min)',
            sub: 'vividness vs logging later',
            pct: Math.round(((avgQ - avgL) / avgL) * 100),
          });
        }
      }
    }

    // 3. High vividness nights (avg ≥ 3.5) vs low — recall count
    const highVivNights = nights.filter(n => {
      const vs = n.filter(d => d.vividness > 0);
      return vs.length > 0 && vs.reduce((s, d) => s + d.vividness, 0) / vs.length >= 3.5;
    });
    const lowVivNights = nights.filter(n => {
      const vs = n.filter(d => d.vividness > 0);
      return vs.length > 0 && vs.reduce((s, d) => s + d.vividness, 0) / vs.length < 3.5;
    });
    if (highVivNights.length >= 3 && lowVivNights.length >= 3) {
      const avgHigh = highVivNights.reduce((s, n) => s + n.length, 0) / highVivNights.length;
      const avgLow  = lowVivNights.reduce((s, n) => s + n.length, 0) / lowVivNights.length;
      if (avgLow > 0) {
        factors.push({
          label: 'High vividness nights',
          sub: 'recall count vs low vividness nights',
          pct: Math.round(((avgHigh - avgLow) / avgLow) * 100),
        });
      }
    }

    return factors;
  }, [recallDreams]);

  // ── Mood correlations ──────────────────────────────────────────────────────
  const moodCorrelations = useMemo(() => {
    const corrs: { label: string; sub: string; pct: number }[] = [];
    const moodDreams = recallDreams.filter(d => d.mood && d.mood > 0);
    if (moodDreams.length < 8) return corrs;

    const byDate: Record<string, typeof moodDreams> = {};
    moodDreams.forEach(d => {
      if (!byDate[d.dateISO]) byDate[d.dateISO] = [];
      byDate[d.dateISO].push(d);
    });
    const nights = Object.values(byDate);
    const avgMoodNight = (ns: typeof nights[0]) =>
      ns.reduce((s, d) => s + (d.mood ?? 0), 0) / ns.length;

    // 1. WBTB vs no WBTB — mood
    const wbtbN = nights.filter(n => n.some(d => d.wbtbNight));
    const normN = nights.filter(n => n.every(d => !d.wbtbNight));
    if (wbtbN.length >= 3 && normN.length >= 3) {
      const avgW = wbtbN.reduce((s, n) => s + avgMoodNight(n), 0) / wbtbN.length;
      const avgNo = normN.reduce((s, n) => s + avgMoodNight(n), 0) / normN.length;
      if (avgNo > 0) corrs.push({
        label: 'WBTB nights',
        sub: 'mood vs non-WBTB nights',
        pct: Math.round(((avgW - avgNo) / avgNo) * 100),
      });
    }

    // 2. High recall nights (≥ 2 dreams) vs single-dream — mood
    const highRecall = nights.filter(n => n.length >= 2);
    const lowRecall  = nights.filter(n => n.length === 1);
    if (highRecall.length >= 3 && lowRecall.length >= 3) {
      const avgH = highRecall.reduce((s, n) => s + avgMoodNight(n), 0) / highRecall.length;
      const avgL = lowRecall.reduce((s, n) => s + avgMoodNight(n), 0) / lowRecall.length;
      if (avgL > 0) corrs.push({
        label: 'High recall nights (2+ dreams)',
        sub: 'mood vs single-dream nights',
        pct: Math.round(((avgH - avgL) / avgL) * 100),
      });
    }

    // 3. High vividness (avg ≥ 4) vs lower — mood
    const highViv = nights.filter(n => {
      const vs = n.filter(d => d.vividness > 0);
      return vs.length > 0 && vs.reduce((s, d) => s + d.vividness, 0) / vs.length >= 4;
    });
    const lowViv = nights.filter(n => {
      const vs = n.filter(d => d.vividness > 0);
      return vs.length > 0 && vs.reduce((s, d) => s + d.vividness, 0) / vs.length < 4;
    });
    if (highViv.length >= 3 && lowViv.length >= 3) {
      const avgH = highViv.reduce((s, n) => s + avgMoodNight(n), 0) / highViv.length;
      const avgL = lowViv.reduce((s, n) => s + avgMoodNight(n), 0) / lowViv.length;
      if (avgL > 0) corrs.push({
        label: 'High vividness nights (4–5)',
        sub: 'mood vs lower vividness nights',
        pct: Math.round(((avgH - avgL) / avgL) * 100),
      });
    }

    return corrs;
  }, [recallDreams]);

  // ── Insights ───────────────────────────────────────────────────────────────
  const insights = useMemo(() => {
    const lines: string[] = [];
    const { data, trend } = weeklyData;

    if (data.length >= 2) {
      const latest = data[data.length - 1];
      const prev = data[data.length - 2];
      if (latest > prev) lines.push(`Dream recall is up this week (${latest} vs ${prev} last week)`);
      else if (latest < prev) lines.push(`Recall dipped this week (${latest} vs ${prev} last week)`);
      else lines.push(`Recall held steady this week — ${latest} dream${latest !== 1 ? 's' : ''}`);
    }

    if (trend.length >= 4) {
      const slope = trend[trend.length - 1] - trend[trend.length - 4];
      if (slope > 0.4) lines.push('Trend is rising — your recall is genuinely improving');
      else if (slope < -0.4) lines.push('Trend is declining — try logging every morning, even fragments');
    }

    if (weekOverWeek.dreamDelta > 0) lines.push(`+${weekOverWeek.dreamDelta} more dreams recalled than last week`);

    if (consistencyData.streak >= 3) lines.push(`${consistencyData.streak}-day logging streak — keep it going`);

    if (tagData.length > 0) lines.push(`Most recurring theme: "${tagData[0].label}" (${tagData[0].value}×)`);

    return lines.slice(0, 4);
  }, [weeklyData, weekOverWeek, consistencyData, tagData]);

  const isEmpty = dreams.length === 0;

  // ── Debug data generator ───────────────────────────────────────────────────
  const DREAM_TITLES = [
    'Flying over the city', 'Lost in a maze', 'Old school hallways', 'Ocean flooding streets',
    'Chased through forest', 'Talking to a stranger', 'Giant building collapse', 'Missing a flight',
    'Underwater cave', 'Familiar face, wrong name', 'Endless staircase', 'Back in childhood home',
    'The red door', 'Falling slowly', 'Someone I used to know', 'Teeth falling out',
    'Running but not moving', 'Bright desert', 'Night market', 'The quiet room',
  ];
  const DREAM_BODIES = [
    'Was soaring above rooftops, everything vivid and strange. Could feel the wind.',
    'Kept turning corners and finding the same hallway. Someone was always just ahead.',
    'Recognised the locker room but couldn\'t find my class. The bell kept ringing.',
    'The water was warm and rising fast. Everyone was calm except me.',
    'Trees blurred past. Couldn\'t see what was behind me but knew it was close.',
    'We talked for what felt like hours. Woke up not remembering a word.',
    'Watched it happen from across the street. No sound at all.',
    'Ran through the terminal but the gate number kept changing.',
    'Crystal clear water. Strange symbols on the walls.',
    'She had my sister\'s face but wasn\'t her. We both knew it.',
    'Every flight led to another. No top in sight.',
    'Everything was slightly smaller than it should be.',
    'The door was always locked. Painted bright red.',
    'Gravity barely working. Took forever to land.',
    'Couldn\'t place the name. The feeling stayed all morning.',
    'Looked in a mirror and kept counting. Never the right number.',
    'Legs moving but the ground didn\'t change.',
    'Flat and bright and very still. No shadows anywhere.',
    'Lights and noise and food I\'ve never seen.',
    'Sitting in a chair. Everything outside the window was dark.',
  ];
  const ALL_TAGS = [
    'flying', 'chase', 'water', 'school', 'family', 'falling', 'lucid', 'recurring',
    'vivid', 'anxiety', 'stranger', 'travel', 'home', 'nature', 'dark', 'light',
  ];

  function generateDebugData() {
    const n = Math.max(1, Math.min(365, parseInt(debugDays, 10) || 100));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Natural recall rate: roughly 70% of nights have something logged, 15% are no-memory
    // Some nights have 2-3 dreams
    const generated: Dream[] = [];
    let idCounter = 0;

    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = toISO(d);

      // Decide what happened this night
      const roll = Math.random();
      if (roll < 0.22) continue; // ~22% nothing logged — skipped entirely

      if (roll < 0.37) {
        // ~15% no-memory night
        generated.push({
          id: `dbg-${idCounter++}`,
          title: 'No memory',
          description: '',
          date: d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
          dateISO: iso,
          vividness: 0,
          tags: [],
          noMemory: true,
        });
        continue;
      }

      // ~20% of nights are WBTB nights
      const isWbtb = Math.random() < 0.20;

      // Mood: slightly higher on WBTB nights (realistic correlation)
      // 80% of entries have a mood logged
      const hasMood = Math.random() < 0.80;
      const moodBase = isWbtb ? 3.6 : 3.0;
      const moodRoll = Math.random();
      const moodRaw = moodBase + (moodRoll - 0.5) * 2.5;
      const mood = hasMood ? Math.min(5, Math.max(1, Math.round(moodRaw))) : undefined;

      // 1-3 recalled dreams (more on WBTB nights)
      const dreamCount = isWbtb
        ? (Math.random() > 0.4 ? 2 : 1)
        : roll > 0.85 ? (Math.random() > 0.6 ? 3 : 2) : 1;

      for (let k = 0; k < dreamCount; k++) {
        const titleIdx = Math.floor(Math.random() * DREAM_TITLES.length);
        const bodyIdx  = Math.floor(Math.random() * DREAM_BODIES.length);

        // Vividness: weighted toward 3-4, higher on WBTB nights
        const vivRoll = Math.random();
        const vivBase = isWbtb
          ? (vivRoll < 0.05 ? 2 : vivRoll < 0.25 ? 3 : vivRoll < 0.75 ? 4 : 5)
          : (vivRoll < 0.08 ? 1 : vivRoll < 0.22 ? 2 : vivRoll < 0.55 ? 3 : vivRoll < 0.88 ? 4 : 5);
        const vividness = vivBase;

        // 1-3 tags, picked from pool without repeats within same dream
        const tagCount = Math.floor(Math.random() * 3) + 1;
        const shuffled = [...ALL_TAGS].sort(() => Math.random() - 0.5);
        const tags = shuffled.slice(0, tagCount);

        // loggedAt: 60% logged within 10 min of waking (assume waking at 7am),
        // rest logged anywhere from 15 min to 3 hours later
        const wakeMs = new Date(iso + 'T07:00:00').getTime();
        const quickLog = Math.random() < 0.60;
        const delayMs = quickLog
          ? Math.random() * 10 * 60 * 1000          // 0–10 min
          : (15 + Math.random() * 165) * 60 * 1000; // 15 min – 3 hr
        const loggedAt = new Date(wakeMs + delayMs).toISOString();

        generated.push({
          id: `dbg-${idCounter++}`,
          title: DREAM_TITLES[titleIdx],
          description: DREAM_BODIES[bodyIdx],
          date: d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
          dateISO: iso,
          vividness,
          tags,
          noMemory: false,
          mood,
          wbtbNight: isWbtb || undefined,
          loggedAt,
        });
      }
    }

    // Sort newest first, then save
    generated.sort((a, b) => b.dateISO.localeCompare(a.dateISO));
    saveDreams(generated);
    onDreamsChange(generated);
    setDebugVisible(false);
    Alert.alert('Debug data loaded', `Generated ${generated.length} entries across ${n} days.`);
  }

  function clearDebugData() {
    saveDreams([]);
    onDreamsChange([]);
    setDebugVisible(false);
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.pageTitle}>Analytics</Text>
      <Text style={styles.pageSubtitle}>
        {isEmpty ? 'Start logging dreams to see your patterns' : `${recallDreams.length} recalled dream${recallDreams.length !== 1 ? 's' : ''} analysed`}
      </Text>

      {isEmpty ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>No dreams logged yet.</Text>
          <Text style={styles.emptySubtext}>Log your first dream from the Home or Journal tab to start seeing insights.</Text>
        </Card>
      ) : (
        <>
          {/* ── Am I improving? ── */}
          <SectionHeader label="Am I improving?" />
          <Card>
            <Text style={styles.cardTitle}>Dream recall over time</Text>
            <Text style={styles.cardSubtitle}>Dreams recalled per week (excludes "no memory" nights)</Text>
            {weeklyData.data.length > 1 ? (
              <>
                <View style={styles.chartWrap}>
                  <LineChartSkia data={weeklyData.data} trend={weeklyData.trend} labels={weeklyData.labels} height={180} />
                </View>
                <View style={styles.legend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: PURPLE }]} />
                    <Text style={styles.legendText}>Dreams recalled</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendLine, { backgroundColor: AMBER }]} />
                    <Text style={styles.legendText}>Trend</Text>
                  </View>
                </View>
              </>
            ) : (
              <Text style={styles.notEnough}>Log dreams across at least 2 weeks to see the chart</Text>
            )}
          </Card>

          {/* ── Vividness ── */}
          {vividnessData.length > 1 && (
            <Card>
              <Text style={styles.cardTitle}>Vividness over time</Text>
              <Text style={styles.cardSubtitle}>Average vividness per week (1–5, recall only)</Text>
              <View style={styles.chartWrap}>
                <VividnessChart data={vividnessData} />
              </View>
            </Card>
          )}

          {/* ── Mood ── */}
          {moodData ? (
            <Card>
              <Text style={styles.cardTitle}>Mood over time</Text>
              <Text style={styles.cardSubtitle}>Average self-reported mood per week (1–5)</Text>
              <View style={styles.chartWrap}>
                <LineChartSkia data={moodData.data} trend={moodData.trend} labels={moodData.labels} height={160} yMin={1} yMax={5} />
              </View>
              <View style={styles.moodLegendRow}>
                {(['😞','😐','🙂','😄','😆'] as const).map((e, i) => (
                  <View key={i} style={styles.moodLegendItem}>
                    <Text style={styles.moodLegendEmoji}>{e}</Text>
                    <Text style={styles.moodLegendNum}>{i + 1}</Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : (
            recallDreams.some(d => d.mood && d.mood > 0) ? null : null
          )}

          {/* ── What actually helps? ── */}
          <SectionHeader label="What actually helps?" />
          <Card>
            <Text style={styles.cardTitle}>Dream factors</Text>
            <Text style={styles.cardSubtitle}>How different conditions correlate with recall and vividness</Text>
            {dreamFactors.length > 0 ? (
              dreamFactors.map((f, i) => (
                <FactorRow key={i} label={f.label} sub={f.sub} pct={f.pct} />
              ))
            ) : (
              <Text style={styles.notEnough}>
                Log at least 10 dreams — with vividness ratings and some WBTB nights — to see correlations
              </Text>
            )}
          </Card>

          {/* ── Mood correlations ── */}
          {recallDreams.some(d => d.mood && d.mood > 0) && (
            <Card>
              <Text style={styles.cardTitle}>Mood correlations</Text>
              <Text style={styles.cardSubtitle}>Conditions that correlate with how you felt on waking</Text>
              {moodCorrelations.length > 0 ? (
                moodCorrelations.map((c, i) => (
                  <FactorRow key={i} label={c.label} sub={c.sub} pct={c.pct} />
                ))
              ) : (
                <Text style={styles.notEnough}>
                  Log mood on at least 8 entries to see patterns
                </Text>
              )}
            </Card>
          )}

          {/* ── Dream patterns ── */}
          <SectionHeader label="Dream patterns" />
          {tagData.length > 0 ? (
            <Card>
              <Text style={styles.cardTitle}>Most frequent themes</Text>
              <Text style={styles.cardSubtitle}>Based on your tags</Text>
              <View style={styles.chartWrap}>
                <HBarChart items={tagData} />
              </View>
            </Card>
          ) : (
            <Card>
              <Text style={styles.cardTitle}>Most frequent themes</Text>
              <Text style={styles.notEnough}>Add tags to your dreams to see recurring themes</Text>
            </Card>
          )}

          {/* ── Practice stability ── */}
          <SectionHeader label="Practice stability" />
          {(() => {
            const uniqueDays = new Set(dreams.map(d => d.dateISO));
            if (uniqueDays.size < 2) return null;
            const sortedDays = [...uniqueDays].sort();
            const firstDate = new Date(sortedDays[0]);
            firstDate.setHours(0, 0, 0, 0);
            const today2 = new Date(); today2.setHours(0, 0, 0, 0);
            const daysSinceFirst = Math.round((today2.getTime() - firstDate.getTime()) / (24*60*60*1000)) + 1;
            const displayDays = Math.min(daysSinceFirst, 49);
            return (
              <Card>
                <View style={styles.consistencyHeader}>
                  <View>
                    <Text style={styles.cardTitle}>Logging consistency</Text>
                    <Text style={styles.cardSubtitle}>
                      {displayDays === 1 ? 'Since today' : `Last ${displayDays} day${displayDays !== 1 ? 's' : ''}`}
                    </Text>
                  </View>
                  <View style={styles.streakBadge}>
                    <Text style={styles.streakNum}>{consistencyData.streak}</Text>
                    <Text style={styles.streakLbl}>day streak</Text>
                  </View>
                </View>

                <ConsistencyGrid allDreams={dreams} maxDays={49} />

                <View style={styles.consistencyLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: AMBER }]} />
                    <Text style={styles.legendText}>First day</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: PURPLE }]} />
                    <Text style={styles.legendText}>Recalled</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: 'rgba(167,139,250,0.25)' }]} />
                    <Text style={styles.legendText}>No memory</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />
                    <Text style={styles.legendText}>Not logged</Text>
                  </View>
                </View>
              </Card>
            );
          })()}

          {/* ── This week vs last ── */}
          <SectionHeader label="This week vs last" />
          <Card>
            <View style={styles.wowRow}>
              <View style={styles.wowBlock}>
                <Text style={styles.wowLabel}>Dreams recalled</Text>
                <Text style={styles.wowValue}>{weekOverWeek.thisCount}</Text>
                <DeltaPill value={weekOverWeek.dreamDelta} unit="vs last wk" />
              </View>
              <View style={styles.wowDivider} />
              <View style={styles.wowBlock}>
                <Text style={styles.wowLabel}>Avg vividness</Text>
                <Text style={styles.wowValue}>{weekOverWeek.thisAvgViv > 0 ? weekOverWeek.thisAvgViv.toFixed(1) : '—'}</Text>
                <DeltaPill value={weekOverWeek.vivDelta} unit="vs last wk" />
              </View>
            </View>
          </Card>

          {/* ── Weekly insights ── */}
          <SectionHeader label="Weekly insights" />
          <Card style={styles.insightCard}>
            {insights.length > 0 ? insights.map((line, i) => (
              <View key={i} style={styles.insightRow}>
                <View style={styles.insightBullet} />
                <Text style={styles.insightText}>{line}</Text>
              </View>
            )) : (
              <Text style={styles.notEnough}>Log more dreams to generate insights</Text>
            )}
          </Card>
        </>
      )}

      {/* ── Debug panel ── */}
      <TouchableOpacity onPress={() => setDebugVisible(v => !v)} activeOpacity={0.4} style={styles.debugToggle}>
        <Text style={styles.debugToggleText}>debug</Text>
      </TouchableOpacity>

      {debugVisible && (
        <View style={styles.debugPanel}>
          <Text style={styles.debugLabel}>Days of history</Text>
          <TextInput
            style={styles.debugInput}
            value={debugDays}
            onChangeText={setDebugDays}
            keyboardType="number-pad"
            maxLength={3}
            placeholderTextColor="rgba(255,255,255,0.2)"
          />
          <TouchableOpacity style={styles.debugBtn} onPress={generateDebugData} activeOpacity={0.7}>
            <Text style={styles.debugBtnText}>Generate data</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.debugBtn, styles.debugBtnDanger]} onPress={clearDebugData} activeOpacity={0.7}>
            <Text style={styles.debugBtnText}>Clear all data</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: CARD_PADDING, paddingTop: 48, paddingBottom: 32 },

  pageTitle:    { fontSize: 28, fontFamily: 'Nunito_800ExtraBold', color: TEXT_PRIMARY, marginBottom: 4 },
  pageSubtitle: { fontSize: 14, fontFamily: 'Nunito_300Light', color: TEXT_MUTED, marginBottom: 24 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 10 },
  sectionDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: PURPLE, opacity: 0.7 },
  sectionLabel:  { fontSize: 11, fontFamily: 'Nunito_800ExtraBold', color: PURPLE, letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.85 },

  card:        { backgroundColor: WHITE_DIM, borderRadius: 16, borderWidth: 0.5, borderColor: WHITE_MID, padding: CARD_PADDING, marginBottom: CARD_MARGIN },
  cardTitle:   { fontSize: 15, fontFamily: 'Nunito_800ExtraBold', color: TEXT_PRIMARY, marginBottom: 2 },
  cardSubtitle:{ fontSize: 12, fontFamily: 'Nunito_300Light', color: TEXT_MUTED, marginBottom: 14 },
  chartWrap:   { alignItems: 'flex-start', marginBottom: 8 },

  legend:      { flexDirection: 'row', gap: 20, marginTop: 8 },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:   { width: 8, height: 8, borderRadius: 4 },
  legendLine:  { width: 16, height: 2, borderRadius: 1 },
  legendText:  { fontSize: 11, fontFamily: 'Nunito_600SemiBold', color: TEXT_MUTED },

  // Consistency
  consistencyHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  streakBadge:       { alignItems: 'center', backgroundColor: 'rgba(167,139,250,0.12)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  streakNum:         { fontSize: 22, fontFamily: 'Nunito_800ExtraBold', color: PURPLE },
  streakLbl:         { fontSize: 10, fontFamily: 'Nunito_300Light', color: TEXT_MUTED },
  consistencyWrap:   { flexDirection: 'row', alignItems: 'center', gap: 16 },
  consistencySummary:{ flex: 1, gap: 10 },
  summaryStatBlock:  { alignItems: 'center' },
  summaryStatNum:    { fontSize: 20, fontFamily: 'Nunito_800ExtraBold', color: TEXT_PRIMARY },
  summaryStatLbl:    { fontSize: 10, fontFamily: 'Nunito_300Light', color: TEXT_MUTED, textAlign: 'center' },
  summaryDivider:    { height: 0.5, backgroundColor: WHITE_MID, width: '100%' },
  consistencyLegend: { flexDirection: 'row', gap: 16, marginTop: 14, flexWrap: 'wrap' },

  // WoW
  wowRow:     { flexDirection: 'row', alignItems: 'center' },
  wowBlock:   { flex: 1, alignItems: 'center', gap: 4 },
  wowDivider: { width: 0.5, height: 60, backgroundColor: WHITE_MID, marginHorizontal: 12 },
  wowLabel:   { fontSize: 11, fontFamily: 'Nunito_600SemiBold', color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.8 },
  wowValue:   { fontSize: 28, fontFamily: 'Nunito_800ExtraBold', color: TEXT_PRIMARY },

  deltaPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  deltaText: { fontSize: 11, fontFamily: 'Nunito_600SemiBold' },

  insightCard:   { gap: 10 },
  insightRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  insightBullet: { width: 5, height: 5, borderRadius: 3, backgroundColor: PURPLE, marginTop: 6, flexShrink: 0 },
  insightText:   { flex: 1, fontSize: 13, fontFamily: 'Nunito_600SemiBold', color: TEXT_PRIMARY, lineHeight: 19 },

  placeholderCard:   { borderStyle: 'dashed', opacity: 0.7 },
  placeholderHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  placeholderBody:   { fontSize: 13, fontFamily: 'Nunito_300Light', color: TEXT_MUTED, lineHeight: 19 },

  emptyCard:    { alignItems: 'center', paddingVertical: 40 },
  emptyText:    { fontSize: 16, fontFamily: 'Nunito_800ExtraBold', color: TEXT_PRIMARY, marginBottom: 8 },
  emptySubtext: { fontSize: 13, fontFamily: 'Nunito_300Light', color: TEXT_MUTED, textAlign: 'center', lineHeight: 20 },

  notEnough: { fontSize: 13, fontFamily: 'Nunito_300Light', color: TEXT_MUTED, fontStyle: 'italic', marginTop: 4, marginBottom: 4 },

  moodLegendRow:  { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  moodLegendItem: { alignItems: 'center', gap: 2 },
  moodLegendEmoji:{ fontSize: 18 },
  moodLegendNum:  { fontSize: 10, fontFamily: 'Nunito_600SemiBold', color: TEXT_MUTED },

  // Debug
  debugToggle:     { alignSelf: 'center', marginTop: 8, paddingVertical: 6, paddingHorizontal: 14 },
  debugToggleText: { fontSize: 11, fontFamily: 'Nunito_300Light', color: 'rgba(255,255,255,0.12)', letterSpacing: 1 },
  debugPanel:      { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', padding: 16, gap: 10, marginBottom: 8 },
  debugLabel:      { fontSize: 11, fontFamily: 'Nunito_600SemiBold', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1 },
  debugInput:      { height: 40, borderRadius: 8, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', paddingHorizontal: 12, fontFamily: 'Nunito_600SemiBold', fontSize: 16 },
  debugBtn:        { height: 38, borderRadius: 8, backgroundColor: 'rgba(167,139,250,0.15)', borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.3)', justifyContent: 'center', alignItems: 'center' },
  debugBtnDanger:  { backgroundColor: 'rgba(251,191,36,0.1)', borderColor: 'rgba(251,191,36,0.25)' },
  debugBtnText:    { fontSize: 13, fontFamily: 'Nunito_600SemiBold', color: 'rgba(255,255,255,0.5)' },
});