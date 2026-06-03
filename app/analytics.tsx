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
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Svg, Circle as SvgCircle, Path as SvgPath } from 'react-native-svg';
import { Dream, RealityCheck, groupChecksByDay } from '../utils/storage';

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

// Get Monday of week for date
function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // Sunday is 0
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function getWeekKey(date: Date): string {
  const mon = getWeekMonday(date);
  return toISO(mon);
}

// Week label format
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatWeekLabel(isoMonday: string): string {
  const [y, m, d] = isoMonday.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

// Parse ISO date string as LOCAL midnight (avoids UTC-offset shifting the date)
function isoToLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
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

// Mood face data
const MOOD_FACES = [0, 1, 2, 3, 4]; // 0=awful to 4=great

function MoodFaceSvg({ index, size = 24 }: { index: number; size?: number }) {
  const c = size / 2;
  const cols = ['#f87171', '#fb923c', 'rgba(255,255,255,0.28)', '#a78bfa', '#c4baff'];
  const col = cols[index];
  const strokeW = 1.2;
  const mouthY = c + size * 0.18;
  const mouthW = size * 0.22;
  const curves = [-size * 0.14, -size * 0.07, 0, size * 0.07, size * 0.14];
  const curve = curves[index];
  const mouthPath = `M ${c - mouthW} ${mouthY - (curve < 0 ? curve : 0)} Q ${c} ${mouthY + curve} ${c + mouthW} ${mouthY - (curve < 0 ? curve : 0)}`;
  const eyeY = c - size * 0.08;
  const eyeX = size * 0.22;
  const browY = eyeY - size * 0.17;
  const browW = size * 0.14;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <SvgCircle cx={c} cy={c} r={c - 1} fill={`${col}18`} stroke={col} strokeWidth={strokeW} />
      <SvgCircle cx={c - eyeX} cy={eyeY} r={size * 0.055} fill={col} />
      <SvgCircle cx={c + eyeX} cy={eyeY} r={size * 0.055} fill={col} />
      {index === 0 && (
        <>
          <SvgPath d={`M ${c-eyeX-browW} ${browY+size*0.04} L ${c-eyeX+browW} ${browY}`} stroke={col} strokeWidth={strokeW} strokeLinecap="round" />
          <SvgPath d={`M ${c+eyeX-browW} ${browY} L ${c+eyeX+browW} ${browY+size*0.04}`} stroke={col} strokeWidth={strokeW} strokeLinecap="round" />
        </>
      )}
      {index === 4 && (
        <>
          <SvgPath d={`M ${c-eyeX-browW} ${browY} L ${c-eyeX+browW} ${browY-size*0.04}`} stroke={col} strokeWidth={strokeW} strokeLinecap="round" />
          <SvgPath d={`M ${c+eyeX-browW} ${browY-size*0.04} L ${c+eyeX+browW} ${browY}`} stroke={col} strokeWidth={strokeW} strokeLinecap="round" />
        </>
      )}
      <SvgPath d={mouthPath} stroke={col} strokeWidth={strokeW} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

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

// ─── Tooltip context ──────────────────────────────────────────────────────────
interface TipPos { text: string; top: number; right: number }
const TipContext = createContext<{
  show: (p: TipPos) => void;
  hide: () => void;
  visible: boolean;
}>({ show: () => {}, hide: () => {}, visible: false });

function InfoTooltip({ text }: { text: string }) {
  const { show, hide, visible } = useContext(TipContext);
  const ref = useRef<View>(null);
  const toggle = () => {
    if (visible) { hide(); return; }
    ref.current?.measure((_x, _y, w, h, px, py) => {
      const bw = 232;
      let right = SCREEN_W - px - w;
      if (SCREEN_W - right - bw < 12) right = SCREEN_W - bw - 12;
      show({ text, top: py + h + 6, right: Math.max(right, 12) });
    });
  };
  return (
    <View ref={ref} collapsable={false}>
      <TouchableOpacity onPress={toggle} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7} style={infoStyles.btn}>
        <Text style={infoStyles.btnText}>i</Text>
      </TouchableOpacity>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  btn: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  btnText: { fontSize: 10, fontFamily: 'Nunito_800ExtraBold', color: 'rgba(167,139,250,0.9)', lineHeight: 13 },
  bubble: {
    position: 'absolute',
    width: 232,
    backgroundColor: '#1a1235',
    borderRadius: 12, borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.35)',
    paddingHorizontal: 14, paddingVertical: 11,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.8, shadowRadius: 16, elevation: 14,
  },
  bubbleText: { fontSize: 12.5, fontFamily: 'Nunito_400Regular', color: 'rgba(255,255,255,0.92)', lineHeight: 19 },
});

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

// ─── Card header with optional info button ────────────────────────────────────
function CardHeader({ title, subtitle, info }: { title: string; subtitle?: string; info?: string }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: subtitle ? 2 : 14 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        {info && <InfoTooltip text={info} />}
      </View>
      {subtitle && <Text style={styles.cardSubtitle}>{subtitle}</Text>}
    </View>
  );
}

// ─── Line chart ───────────────────────────────────────────────────────────────
interface LineChartSkiaProps {
  data: number[];
  trend: number[];
  labels: string[];
  height?: number;
  yMin?: number;
  yMax?: number;
  yStep?: number; // tick interval, e.g. 20
  valueLabel?: string; // e.g. dreams or mood
}

function LineChartSkia({ data, trend, labels, height = 180, yMin, yMax, yStep, valueLabel = 'dreams' }: LineChartSkiaProps) {
  const font = useFont(FONT_SEMI, 10);
  const [tooltip, setTooltip] = useState<{ i: number; x: number; y: number } | null>(null);
  const tooltipAnim = useRef(new Animated.Value(0)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chartW = SCREEN_W - CARD_PADDING * 2 - 32;
  const chartH = height;
  const padL = 22; const padR = 10; const padT = 10; const padB = 32;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const maxVal = (() => {
    const raw = yMax ?? data.reduce((m, v) => Math.max(m, v), 1);
    if (yStep) return raw;
    // Round up to avoid crowding
    if (raw <= 5)  return raw;
    if (raw <= 10) return Math.ceil(raw / 2) * 2;
    if (raw <= 20) return Math.ceil(raw / 5) * 5;
    return Math.ceil(raw / 10) * 10;
  })();
  const minVal = yMin ?? 0;
  const yTicks = yStep
    ? Array.from({ length: Math.floor((maxVal - minVal) / yStep) + 1 }, (_, i) => minVal + i * yStep)
    : (() => {
        const range = maxVal - minVal;
        const step = range <= 5 ? 1 : range <= 10 ? 2 : range <= 20 ? 5 : 10;
        const ticks: number[] = [];
        for (let t = minVal; t <= maxVal; t += step) ticks.push(t);
        if (ticks[ticks.length - 1] !== maxVal) ticks.push(maxVal);
        return ticks;
      })();

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

  const minLabelSpacingPx = 62;
  const spacingPx = data.length > 1 ? plotW / (data.length - 1) : plotW;
  const labelEvery = Math.max(1, Math.ceil(minLabelSpacingPx / spacingPx));
  const showLabel = (i: number) => (data.length - 1 - i) % labelEvery === 0;

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: any) => {
    touchStartRef.current = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
  };

  const handleTouchEnd = (e: any) => {
    const start = touchStartRef.current;
    if (!start) return;
    const dx = Math.abs(e.nativeEvent.locationX - start.x);
    const dy = Math.abs(e.nativeEvent.locationY - start.y);
    // If finger moved more than 8px it's a scroll, ignore
    if (dx > 8 || dy > 8) return;

    const touchX = start.x;
    let nearest = 0;
    let minDist = Infinity;
    data.forEach((_, i) => {
      const dist = Math.abs(xOf(i) - touchX);
      if (dist < minDist) { minDist = dist; nearest = i; }
    });
    if (minDist > 40) { setTooltip(null); return; }
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    tooltipAnim.setValue(0);
    setTooltip({ i: nearest, x: xOf(nearest), y: yOf(data[nearest]) });
    Animated.spring(tooltipAnim, { toValue: 1, useNativeDriver: true, tension: 200, friction: 12 }).start();
    dismissTimer.current = setTimeout(() => {
      Animated.timing(tooltipAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setTooltip(null));
    }, 2500);
  };

  const canvasKey = data.join(',') + (font ? '1' : '0');
  if (!font) return <View style={{ height: chartH }} />;

  return (
    <View>
      <Canvas key={canvasKey} style={{ width: chartW, height: chartH }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}>
        {/* Y grid + labels */}
        {yTicks.map((tick, ti) => (
          <Group key={ti}>
            <Line p1={vec(padL, yOf(tick))} p2={vec(padL + plotW, yOf(tick))} color="rgba(255,255,255,0.07)" strokeWidth={1} />
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
        {data.map((v, i) => {
          const isActive = tooltip?.i === i;
          return (
            <Group key={i}>
              <Circle cx={xOf(i)} cy={yOf(v)} r={isActive ? 8 : 5} color="rgba(167,139,250,0.25)" />
              <Circle cx={xOf(i)} cy={yOf(v)} r={isActive ? 5 : 3} color={PURPLE} />
            </Group>
          );
        })}
        {/* Tooltip vertical line */}
        {tooltip && (
          <Line
            p1={vec(tooltip.x, padT)}
            p2={vec(tooltip.x, padT + plotH)}
            color="rgba(167,139,250,0.3)"
            strokeWidth={1}
          />
        )}
        {/* X labels */}
        {labels.map((lbl, i) => {
          if (!showLabel(i)) return null;
          const cx = xOf(i);
          const lblW = lbl.length * 5.5;
          const x = clamp(cx - lblW / 2, padL, chartW - lblW - padR);
          return <SkiaText key={i} x={x} y={padT + plotH + 18} text={lbl} font={font} color={TEXT_MUTED} />;
        })}
      </Canvas>
      {/* Floating tooltip label, rendered in RN so it can animate */}
      {tooltip && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: clamp(tooltip.x - 52, 0, chartW - 104),
            top: Math.max(tooltip.y - 38, 0),
            opacity: tooltipAnim,
            transform: [{ scale: tooltipAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
            backgroundColor: 'rgba(25,18,50,0.92)',
            borderRadius: 8,
            borderWidth: 0.5,
            borderColor: 'rgba(167,139,250,0.35)',
            paddingHorizontal: 10,
            paddingVertical: 5,
          }}
        >
          <Text style={{ fontSize: 11, fontFamily: 'Nunito_600SemiBold', color: TEXT_PRIMARY }}>
            {labels[tooltip.i]} · <Text style={{ color: PURPLE }}>{data[tooltip.i]} {valueLabel}</Text>
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

// ─── Vividness chart ──────────────────────────────────────────────────────────
interface VividnessChartProps {
  data: { label: string; avg: number }[];
}

function VividnessChart({ data }: VividnessChartProps) {
  const font = useFont(FONT_SEMI, 10);
  const [tooltip, setTooltip] = useState<{ i: number; x: number; y: number } | null>(null);
  const tooltipAnim = useRef(new Animated.Value(0)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chartW = SCREEN_W - CARD_PADDING * 2 - 32;
  const chartH = 140;
  const padL = 26;
  const padR = 8;
  const padT = 10;
  const padB = 28;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const n = data.length;
  const BAR_W = Math.max(10, Math.min(32, plotW / Math.max(n, 1) - 6));
  const yOf = (v: number) => padT + plotH - ((v - 1) / 4) * plotH;

  const vivTouchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: any) => {
    vivTouchStartRef.current = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
  };

  const handleTouchEnd = (e: any) => {
    const start = vivTouchStartRef.current;
    if (!start) return;
    const dx = Math.abs(e.nativeEvent.locationX - start.x);
    const dy = Math.abs(e.nativeEvent.locationY - start.y);
    if (dx > 8 || dy > 8) return;

    const touchX = start.x;
    const barSpacing = plotW / Math.max(n, 1);
    const i = Math.floor((touchX - padL) / barSpacing);
    if (i < 0 || i >= n) { setTooltip(null); return; }
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    tooltipAnim.setValue(0);
    const centerX = padL + (i + 0.5) * barSpacing;
    const barH = Math.max(((data[i].avg - 1) / 4) * plotH, 2);
    const y = padT + plotH - barH;
    setTooltip({ i, x: centerX, y });
    Animated.spring(tooltipAnim, { toValue: 1, useNativeDriver: true, tension: 200, friction: 12 }).start();
    dismissTimer.current = setTimeout(() => {
      Animated.timing(tooltipAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setTooltip(null));
    }, 2500);
  };

  if (!font) return <View style={{ height: chartH }} />;

  const vivCanvasKey = data.map(d => d.avg).join(',') + (font ? '1' : '0');

  return (
    <View>
      <Canvas key={vivCanvasKey} style={{ width: chartW, height: chartH }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}>
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

        {/* Bars */}
        {(() => {
          const barSpacingPx = n > 0 ? plotW / n : plotW;
          const vivLabelEvery = Math.max(1, Math.ceil(46 / barSpacingPx));
          return data.map((d, i) => {
            const centerX = padL + (i + 0.5) * (plotW / n);
            const x = centerX - BAR_W / 2;
            const barH = Math.max(((d.avg - 1) / 4) * plotH, 2);
            const y = padT + plotH - barH;
            const opacity = 0.35 + (d.avg / 5) * 0.65;
            const isActive = tooltip?.i === i;
            const showLbl = (n - 1 - i) % vivLabelEvery === 0;
            const lblW = d.label.length * 5.5;
            const lblX = clamp(centerX - lblW / 2, padL, chartW - lblW);
            return (
              <Group key={i}>
                <RoundedRect x={x} y={padT} width={BAR_W} height={plotH} r={4} color="rgba(255,255,255,0.05)" />
                <RoundedRect x={x} y={y} width={BAR_W} height={barH} r={4} color={PURPLE} opacity={isActive ? 1 : opacity} />
                {!isActive && (
                  <SkiaText
                    x={clamp(centerX - 7, padL, chartW - 16)}
                    y={Math.max(y - 4, padT + 10)}
                    text={d.avg.toFixed(1)}
                    font={font}
                    color="rgba(167,139,250,0.7)"
                  />
                )}
                {showLbl && (
                  <SkiaText x={lblX} y={chartH - 6} text={d.label} font={font} color={TEXT_MUTED} />
                )}
              </Group>
            );
          });
        })()}
      </Canvas>

      {/* Floating tooltip */}
      {tooltip && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: clamp(tooltip.x - 52, 0, chartW - 104),
            top: Math.max(tooltip.y - 38, 0),
            opacity: tooltipAnim,
            transform: [{ scale: tooltipAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
            backgroundColor: 'rgba(25,18,50,0.92)',
            borderRadius: 8,
            borderWidth: 0.5,
            borderColor: 'rgba(167,139,250,0.35)',
            paddingHorizontal: 10,
            paddingVertical: 5,
          }}
        >
          <Text style={{ fontSize: 11, fontFamily: 'Nunito_600SemiBold', color: TEXT_PRIMARY }}>
            {data[tooltip.i].label} · <Text style={{ color: PURPLE }}>{data[tooltip.i].avg.toFixed(1)} vividness</Text>
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

// ─── Horizontal bar chart ─────────────────────────────────────────────────────
function HBarChart({ items }: { items: { label: string; value: number }[] }) {
  const font = useFont(FONT_SEMI, 12);
  const topItems = items.slice(0, 7);
  const ROW_H = 36;
  const LABEL_W = 100;
  const COUNT_W = 28;
  const chartW = SCREEN_W - CARD_PADDING * 2 - 32;
  const chartH = topItems.length * ROW_H + 4;
  const barZoneW = chartW - LABEL_W - COUNT_W - 8;
  const maxVal = topItems.reduce((m, i) => Math.max(m, i.value), 1);

  if (!font) return <View style={{ height: chartH }} />;

  const hbarCanvasKey = topItems.map(i => i.value).join(',') + (font ? '1' : '0');

  // Truncate label to fit width
  const truncate = (s: string) => {
    const maxChars = Math.floor(LABEL_W / 7.2);
    return s.length > maxChars ? s.slice(0, maxChars - 1) + '…' : s;
  };

  return (
    <Canvas key={hbarCanvasKey} style={{ width: chartW, height: chartH }}>
      {topItems.map((item, i) => {
        const cy = i * ROW_H + ROW_H / 2;
        const bw = (item.value / maxVal) * barZoneW;
        const lbl = truncate(item.label);
        return (
          <Group key={i}>
            <SkiaText x={0} y={cy + 4} text={lbl} font={font} color={TEXT_MUTED} />
            {/* Track */}
            <RoundedRect x={LABEL_W} y={cy - 9} width={barZoneW} height={18} r={9} color="rgba(255,255,255,0.05)" />
            {/* Fill */}
            {bw > 0 && (
              <RoundedRect x={LABEL_W} y={cy - 9} width={bw} height={18} r={9} color={PURPLE} opacity={0.8} />
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

  // Anchor to first logged day
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Anchor logic: start from first real dream date, include adjacent noMemory
  const realDreams = allDreams.filter(d => !d.noMemory);
  const sortedISOs = [...new Set(allDreams.map(d => d.dateISO))].sort();

  const firstRealISO = realDreams.length > 0
    ? [...new Set(realDreams.map(d => d.dateISO))].sort()[0]
    : toISO(today);

  // Day before first real dream
  const [fry, frm, frd] = firstRealISO.split('-').map(Number);
  const dayBeforeFirstReal = new Date(fry, frm - 1, frd - 1, 0, 0, 0, 0);
  const dayBeforeFirstRealISO = toISO(dayBeforeFirstReal);

  // Use earliest entry >= dayBeforeFirstReal
  const firstEverISO = sortedISOs[0] ?? firstRealISO;
  const firstISO = firstEverISO >= dayBeforeFirstRealISO ? firstEverISO : firstRealISO;
  // Parse as local date to avoid timezone issues
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

  // All logged dates including noMemory
  const loggedAll = new Set(allDreams.map(d => d.dateISO));
  // Dates with recall
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

  // Summary stats from start date
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
function FactorRow({ label, sub, scoreA, scoreB, labelA, labelB }: {
  label: string; sub: string;
  scoreA: number; scoreB: number;
  labelA: string; labelB: string;
}) {
  const better = scoreA >= scoreB;
  const diff = Math.abs(scoreA - scoreB);
  const diffColor = diff < 0.05 ? TEXT_MUTED : better ? PURPLE : AMBER;
  const fmt = (n: number) => n % 1 === 0 ? `${n}` : n.toFixed(1);
  return (
    <View style={factorStyles.row}>
      <View style={{ flex: 1 }}>
        <Text style={factorStyles.label}>{label}</Text>
        <Text style={factorStyles.sub}>{sub}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 3, minWidth: 80 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Nunito_400Regular', color: TEXT_MUTED }}>{labelA}</Text>
          <Text style={{ fontSize: 15, fontFamily: 'Nunito_800ExtraBold', color: diffColor }}>{fmt(scoreA)}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Nunito_400Regular', color: TEXT_MUTED }}>{labelB}</Text>
          <Text style={{ fontSize: 15, fontFamily: 'Nunito_800ExtraBold', color: TEXT_MUTED }}>{fmt(scoreB)}</Text>
        </View>
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
  checks: RealityCheck[];
  onChecksChange?: (checks: RealityCheck[]) => void;
  onInsightsChange?: (insights: { text: string; sub: string }[]) => void;
}

export default function Analytics({ dreams, onDreamsChange, checks, onChecksChange, onInsightsChange }: AnalyticsProps) {

  // ── Shared tooltip ─────────────────────────────────────────────────────────
  const [tipPos, setTipPos] = useState<TipPos | null>(null);
  const tipAnim = useRef(new Animated.Value(0)).current;
  const showTip = useCallback((p: TipPos) => {
    setTipPos(p);
    tipAnim.setValue(0);
    Animated.spring(tipAnim, { toValue: 1, useNativeDriver: true, tension: 220, friction: 22 }).start();
  }, []);
  const hideTip = useCallback(() => {
    Animated.timing(tipAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => setTipPos(null));
  }, []);



  // Only real dreams (exclude noMemory) for recall + vividness charts
  const recallDreams = useMemo(() => dreams.filter(d => !d.noMemory), [dreams]);

  // ── Weekly recall (count all recall dreams per week, no dedup per night) ──
  const weeklyData = useMemo(() => {
    const counts: Record<string, number> = {};
    recallDreams.forEach(d => {
      const k = getWeekKey(isoToLocal(d.dateISO));
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
        const k = getWeekKey(isoToLocal(d.dateISO));
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
        // Skip 'vivid', vividness is tracked separately with the 1-5 rating
        if (t && t !== 'vivid') counts[t] = (counts[t] || 0) + 1;
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
    // Monday-based week (consistent with getWeekMonday used in charts)
    const monDiff = (now.getDay() + 6) % 7; // days since Monday
    const thisStart = new Date(now); thisStart.setDate(now.getDate() - monDiff);
    const lastStart = new Date(thisStart); lastStart.setDate(thisStart.getDate() - 7);

    let thisCount = 0, lastCount = 0;
    let thisViv = 0, lastViv = 0, thisVivN = 0, lastVivN = 0;
    let thisLucid = 0, lastLucid = 0;

    recallDreams.forEach(d => {
      const date = isoToLocal(d.dateISO);
      if (date >= thisStart) {
        thisCount++;
        if (d.vividness) { thisViv += d.vividness; thisVivN++; }
        if (d.lucid) thisLucid++;
      } else if (date >= lastStart) {
        lastCount++;
        if (d.vividness) { lastViv += d.vividness; lastVivN++; }
        if (d.lucid) lastLucid++;
      }
    });

    const thisAvgViv = thisVivN ? parseFloat((thisViv / thisVivN).toFixed(1)) : 0;
    const lastAvgViv = lastVivN ? parseFloat((lastViv / lastVivN).toFixed(1)) : 0;

    return {
      dreamDelta: thisCount - lastCount,
      vivDelta: parseFloat((thisAvgViv - lastAvgViv).toFixed(1)),
      lucidDelta: thisLucid - lastLucid,
      thisCount,
      thisAvgViv,
      thisLucid,
    };
  }, [recallDreams]);

  // ── Mood per week ──────────────────────────────────────────────────────────
  const moodData = useMemo(() => {
    const map: Record<string, number[]> = {};
    recallDreams.forEach(d => {
      if (d.mood && d.mood > 0) {
        const k = getWeekKey(isoToLocal(d.dateISO));
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

  // ── Dream factors (actual value comparisons) ───────────────────────────────
  const dreamFactors = useMemo(() => {
    const factors: { label: string; sub: string; scoreA: number; scoreB: number; labelA: string; labelB: string }[] = [];
    if (recallDreams.length < 10) return factors;

    const byDate: Record<string, typeof recallDreams> = {};
    recallDreams.forEach(d => {
      if (!byDate[d.dateISO]) byDate[d.dateISO] = [];
      byDate[d.dateISO].push(d);
    });
    const nights = Object.values(byDate);

    // 1. WBTB nights vs normal — dreams recalled per night
    const wbtbNights = nights.filter(n => n.some(d => d.wbtbNight));
    const normNights = nights.filter(n => n.every(d => !d.wbtbNight));
    if (wbtbNights.length >= 3 && normNights.length >= 3) {
      const avgWbtb = parseFloat((wbtbNights.reduce((s, n) => s + n.length, 0) / wbtbNights.length).toFixed(1));
      const avgNorm = parseFloat((normNights.reduce((s, n) => s + n.length, 0) / normNights.length).toFixed(1));
      factors.push({ label: 'After a WBTB night', sub: 'avg dreams recalled per night', scoreA: avgWbtb, scoreB: avgNorm, labelA: 'WBTB', labelB: 'regular' });
    }

    // 2. Quick logging (within 10 min) vs later — avg vividness
    const withLogTime = recallDreams.filter(d => d.loggedAt && d.vividness > 0);
    if (withLogTime.length >= 6) {
      const quick = withLogTime.filter(d => {
        const logMs = new Date(d.loggedAt!).getTime();
        const dayMs = new Date(d.dateISO + 'T00:00:00').getTime();
        return (logMs - dayMs) / 60000 <= 10;
      });
      const later = withLogTime.filter(d => {
        const logMs = new Date(d.loggedAt!).getTime();
        const dayMs = new Date(d.dateISO + 'T00:00:00').getTime();
        return (logMs - dayMs) / 60000 > 10;
      });
      if (quick.length >= 3 && later.length >= 3) {
        const avgQ = parseFloat((quick.reduce((s, d) => s + d.vividness, 0) / quick.length).toFixed(1));
        const avgL = parseFloat((later.reduce((s, d) => s + d.vividness, 0) / later.length).toFixed(1));
        factors.push({ label: 'When you log within 10 minutes', sub: 'avg vividness vs logging later', scoreA: avgQ, scoreB: avgL, labelA: 'quick', labelB: 'later' });
      }
    }

    // 3. High vividness nights vs low — recall count
    const highVivNights = nights.filter(n => {
      const vs = n.filter(d => d.vividness > 0);
      return vs.length > 0 && vs.reduce((s, d) => s + d.vividness, 0) / vs.length >= 4;
    });
    const lowVivNights = nights.filter(n => {
      const vs = n.filter(d => d.vividness > 0);
      return vs.length > 0 && vs.reduce((s, d) => s + d.vividness, 0) / vs.length < 4;
    });
    if (highVivNights.length >= 3 && lowVivNights.length >= 3) {
      const avgHigh = parseFloat((highVivNights.reduce((s, n) => s + n.length, 0) / highVivNights.length).toFixed(1));
      const avgLow  = parseFloat((lowVivNights.reduce((s, n) => s + n.length, 0) / lowVivNights.length).toFixed(1));
      factors.push({ label: 'After a highly vivid night (4 to 5)', sub: 'avg dreams recalled vs less vivid nights', scoreA: avgHigh, scoreB: avgLow, labelA: 'vivid', labelB: 'less vivid' });
    }

    // 4. Lucid nights vs non-lucid — avg vividness
    const lucidNights  = nights.filter(n => n.some(d => d.lucid));
    const normalNights = nights.filter(n => n.every(d => !d.lucid));
    if (lucidNights.length >= 2 && normalNights.length >= 3) {
      const lucidFlat  = lucidNights.flatMap(n => n.filter(d => d.vividness > 0));
      const normalFlat = normalNights.flatMap(n => n.filter(d => d.vividness > 0));
      const avgLucid = parseFloat((lucidFlat.reduce((s, d) => s + d.vividness, 0) / lucidFlat.length).toFixed(1));
      const avgNorm  = parseFloat((normalFlat.reduce((s, d) => s + d.vividness, 0) / normalFlat.length).toFixed(1));
      factors.push({ label: 'On nights with a lucid dream', sub: 'avg vividness vs non-lucid nights', scoreA: avgLucid, scoreB: avgNorm, labelA: 'lucid', labelB: 'non-lucid' });
    }

    // 5. High RC days vs low — next-night recall count
    if (checks.length >= 10) {
      const checksByDay = groupChecksByDay(checks);
      const highCheckDays = new Set(Object.entries(checksByDay).filter(([, cs]) => cs.length >= 3).map(([iso]) => iso));
      const lowCheckDays  = new Set(Object.entries(checksByDay).filter(([, cs]) => cs.length <= 1).map(([iso]) => iso));
      const dreamsAfterHigh: typeof recallDreams = [];
      const dreamsAfterLow:  typeof recallDreams = [];
      recallDreams.forEach(d => {
        const [y, m, day] = d.dateISO.split('-').map(Number);
        const prev = new Date(y, m - 1, day - 1);
        const prevISO = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
        if (highCheckDays.has(prevISO)) dreamsAfterHigh.push(d);
        else if (lowCheckDays.has(prevISO)) dreamsAfterLow.push(d);
      });
      const nightAvg = (ds: typeof recallDreams) => {
        const map: Record<string, number> = {};
        ds.forEach(d => { map[d.dateISO] = (map[d.dateISO] || 0) + 1; });
        const vals = Object.values(map);
        return vals.length > 0 ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)) : 0;
      };
      if (dreamsAfterHigh.length >= 5 && dreamsAfterLow.length >= 5) {
        factors.push({ label: 'On days with 3 or more reality checks', sub: 'next-night avg recall vs low-check days', scoreA: nightAvg(dreamsAfterHigh), scoreB: nightAvg(dreamsAfterLow), labelA: '3+ checks', labelB: '0-1 checks' });
      }
    }

    return factors;
  }, [recallDreams, checks]);

  // ── Lucid stats ────────────────────────────────────────────────────────────
  const lucidData = useMemo(() => {
    const lucidDreams = recallDreams.filter(d => d.lucid);
    const total = recallDreams.length;
    if (total === 0) return null;

    const lucidRate = Math.round((lucidDreams.length / total) * 100);

    // Avg vividness lucid vs non-lucid
    const lucidViv = lucidDreams.filter(d => d.vividness > 0);
    const nonLucidViv = recallDreams.filter(d => !d.lucid && d.vividness > 0);
    const avgLucidViv = lucidViv.length > 0
      ? lucidViv.reduce((s, d) => s + d.vividness, 0) / lucidViv.length : null;
    const avgNonLucidViv = nonLucidViv.length > 0
      ? nonLucidViv.reduce((s, d) => s + d.vividness, 0) / nonLucidViv.length : null;
    const vividnessDiff = avgLucidViv && avgNonLucidViv && nonLucidViv.length >= 3
      ? Math.max(-100, Math.min(100, Math.round(((avgLucidViv - avgNonLucidViv) / avgNonLucidViv) * 100))) : null;

    // Weekly lucid rate for chart (% of dreams that week that were lucid)
    const weekMap: Record<string, { total: number; lucid: number }> = {};
    recallDreams.forEach(d => {
      const date = isoToLocal(d.dateISO);
      const monday = new Date(date);
      monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
      const key = toISO(monday);
      if (!weekMap[key]) weekMap[key] = { total: 0, lucid: 0 };
      weekMap[key].total++;
      if (d.lucid) weekMap[key].lucid++;
    });
    const sortedWeeks = Object.keys(weekMap).sort().slice(-8);
    const chartData = sortedWeeks.map(k => Math.round((weekMap[k].lucid / weekMap[k].total) * 100));
    const chartLabels = sortedWeeks.map(k => {
      const d = new Date(k);
      return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
    });

    // Simple trend (same EMA as recall chart)
    const alpha = 0.35;
    const trend = chartData.reduce<number[]>((acc, v, i) => {
      acc.push(i === 0 ? v : alpha * v + (1 - alpha) * acc[i - 1]);
      return acc;
    }, []);

    return {
      count: lucidDreams.length,
      total,
      lucidRate,
      avgLucidViv,
      avgNonLucidViv,
      vividnessDiff,
      chartData,
      chartLabels,
      trend,
    };
  }, [recallDreams]);

  // ── Mood correlations ──────────────────────────────────────────────────────
  const moodCorrelations = useMemo(() => {
    const corrs: { label: string; sub: string; scoreA: number; scoreB: number; labelA: string; labelB: string }[] = [];
    const moodDreams = recallDreams.filter(d => d.mood && d.mood > 0);
    if (moodDreams.length < 8) return corrs;

    const allByDate: Record<string, typeof recallDreams> = {};
    recallDreams.forEach(d => {
      if (!allByDate[d.dateISO]) allByDate[d.dateISO] = [];
      allByDate[d.dateISO].push(d);
    });

    const avgMoodForNight = (iso: string) => {
      const ms = allByDate[iso]?.filter(d => d.mood && d.mood > 0) ?? [];
      return ms.length > 0 ? ms.reduce((s, d) => s + (d.mood ?? 0), 0) / ms.length : null;
    };

    const nightISOs = Object.keys(allByDate).filter(iso => avgMoodForNight(iso) !== null);
    const avgMoodGroup = (isos: string[]) => {
      const scores = isos.map(iso => avgMoodForNight(iso)!);
      return parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2));
    };

    // 1. WBTB vs regular
    const wbtbISOs = nightISOs.filter(iso => allByDate[iso].some(d => d.wbtbNight));
    const normISOs = nightISOs.filter(iso => allByDate[iso].every(d => !d.wbtbNight));
    if (wbtbISOs.length >= 3 && normISOs.length >= 3) {
      corrs.push({ label: 'After a WBTB night', sub: 'avg waking mood, WBTB vs regular nights', scoreA: avgMoodGroup(wbtbISOs), scoreB: avgMoodGroup(normISOs), labelA: 'WBTB', labelB: 'regular' });
    }

    // 2. High recall (2+) vs single dream
    const highISOs = nightISOs.filter(iso => allByDate[iso].length >= 2);
    const lowISOs  = nightISOs.filter(iso => allByDate[iso].length === 1);
    if (highISOs.length >= 3 && lowISOs.length >= 3) {
      corrs.push({ label: 'Nights with 2+ dreams recalled', sub: 'avg waking mood, high recall vs single dream', scoreA: avgMoodGroup(highISOs), scoreB: avgMoodGroup(lowISOs), labelA: '2+ dreams', labelB: '1 dream' });
    }

    // 3. High vividness (avg >= 4) vs lower
    const highVivISOs = nightISOs.filter(iso => {
      const vs = allByDate[iso].filter(d => d.vividness > 0);
      return vs.length > 0 && vs.reduce((s, d) => s + d.vividness, 0) / vs.length >= 4;
    });
    const lowVivISOs = nightISOs.filter(iso => {
      const vs = allByDate[iso].filter(d => d.vividness > 0);
      return vs.length > 0 && vs.reduce((s, d) => s + d.vividness, 0) / vs.length < 4;
    });
    if (highVivISOs.length >= 3 && lowVivISOs.length >= 3) {
      corrs.push({ label: 'After a highly vivid night (4 to 5)', sub: 'avg waking mood, vivid nights vs less vivid', scoreA: avgMoodGroup(highVivISOs), scoreB: avgMoodGroup(lowVivISOs), labelA: 'vivid', labelB: 'less vivid' });
    }

    return corrs;
  }, [recallDreams]);

  // ── Insights ───────────────────────────────────────────────────────────────
  // Strategy: generate all candidate insights, score them, show top 4.
  //
  // Score = base priority + magnitude bonus
  //   HIGH   (30), discoveries: comparisons that teach the user something
  //   MEDIUM (20), meaningful trends over multiple weeks
  //   LOW    (10), pure observations (numbers from charts)
  //
  // Within a tier, larger magnitude = higher score.
  // The final list shows the top 4 by score, deduplicated by topic.
  const insights = useMemo(() => {
    type Insight = { text: string; sub: string; score: number };
    const candidates: Insight[] = [];

    const push = (score: number, text: string, sub: string) =>
      candidates.push({ text, sub, score });

    // ── HIGH PRIORITY: discoveries (comparisons that teach something) ─────────
    // Note on language: vividness and mood are self-reported, so we use
    // hedged language ("tend to", "appear to", "on average") rather than
    // stating causal facts. Dream counts are objective so no hedge needed.

    // High reality-check days → next-night recall
    const rcFactor = dreamFactors.find(f => f.label.startsWith('On days with 3'));
    if (rcFactor && Math.abs(rcFactor.scoreA - rcFactor.scoreB) >= 0.2) {
      const better = rcFactor.scoreA > rcFactor.scoreB;
      push(29,
        `Days with 3+ reality checks tend to produce ${better ? 'better' : 'fewer'} dreams the following night.`,
        `On nights after high-check days you recalled an average of ${rcFactor.scoreA} dreams vs ${rcFactor.scoreB} after low-check days.`
      );
    }

    // WBTB vs normal recall
    const wbtbFactor = dreamFactors.find(f => f.label === 'After a WBTB night');
    if (wbtbFactor && Math.abs(wbtbFactor.scoreA - wbtbFactor.scoreB) >= 0.2) {
      const dir = wbtbFactor.scoreA > wbtbFactor.scoreB ? 'more' : 'fewer';
      push(30,
        `WBTB nights tend to produce ${dir} dreams.`,
        `On WBTB nights you recalled ${wbtbFactor.scoreA} dreams on average vs ${wbtbFactor.scoreB} on regular nights.`
      );
    }

    // Quick logging vs later
    const quickFactor = dreamFactors.find(f => f.label.startsWith('Logging within'));
    if (quickFactor && Math.abs(quickFactor.scoreA - quickFactor.scoreB) >= 0.2) {
      const dir = quickFactor.scoreA > quickFactor.scoreB ? 'more' : 'less';
      push(30,
        `Dreams logged within 10 minutes tend to feel ${dir} vivid.`,
        `Quick entries averaged ${quickFactor.scoreA}/5 vividness vs ${quickFactor.scoreB}/5 for entries logged later.`
      );
    }

    // Lucid vividness vs non-lucid (vividness is self-reported, hedge it)
    if (lucidData && lucidData.vividnessDiff !== null && Math.abs(lucidData.vividnessDiff) >= 10 && lucidData.count >= 2) {
      const diff = lucidData.vividnessDiff;
      push(30 + Math.abs(diff) / 10,
        `Lucid dreams tend to feel ${Math.abs(diff)}% ${diff > 0 ? 'more' : 'less'} vivid than your average dream.`,
        `Self-reported vividness: ${lucidData.avgLucidViv?.toFixed(1)}/5 for lucid dreams vs ${lucidData.avgNonLucidViv?.toFixed(1)}/5 for non-lucid, on average.`
      );
    }

    // Lucid rate milestone (count is objective)
    if (lucidData && lucidData.count >= 1) {
      if (lucidData.count === 1) {
        push(29,
          `You've logged your first lucid dream.`,
          `The awareness you build through daily reality checks makes the next one significantly more likely.`
        );
      } else if (lucidData.lucidRate >= 20) {
        push(30 + lucidData.lucidRate / 10,
          `${lucidData.lucidRate}% of your dreams have been lucid.`,
          `${lucidData.count} lucid dreams out of ${lucidData.total} total, that's an unusually strong rate.`
        );
      } else {
        push(25,
          `${lucidData.count} lucid dreams logged so far.`,
          `That's ${lucidData.lucidRate}% of your total entries. Keep up the reality checks.`
        );
      }
    }

    // High recall streak (objective)
    if (consistencyData.streak >= 14) {
      push(32,
        `${consistencyData.streak} days logged in a row.`,
        `That level of consistency is rare. Long streaks are one of the strongest predictors of improved recall.`
      );
    } else if (consistencyData.streak >= 7) {
      push(28,
        `${consistencyData.streak}-day logging streak.`,
        `Over a full week of consecutive mornings logged. That kind of consistency tends to compound over time.`
      );
    } else if (consistencyData.streak >= 3) {
      push(20,
        `You're on a ${consistencyData.streak}-day streak.`,
        `Keep going, morning logging every day is where the biggest long-term gains tend to come from.`
      );
    }

    // Top mood correlation
    const topMoodCorr = moodCorrelations?.[0];
    if (topMoodCorr) {
      const diff = topMoodCorr.scoreA - topMoodCorr.scoreB;
      if (Math.abs(diff) >= 0.2) {
        push(28 + Math.abs(diff) * 10,
          `${topMoodCorr.label} appear to correlate with ${diff > 0 ? 'better' : 'lower'} waking mood.`,
          `Average waking mood: ${topMoodCorr.scoreA.toFixed(1)}/5 (${topMoodCorr.labelA}) vs ${topMoodCorr.scoreB.toFixed(1)}/5 (${topMoodCorr.labelB}), based on your logged entries.`
        );
      }
    }

    // High vividness nights → recall count
    const highVivFactor = dreamFactors.find(f => f.label.startsWith('After a highly vivid'));
    if (highVivFactor && Math.abs(highVivFactor.scoreA - highVivFactor.scoreB) >= 0.2) {
      const dir = highVivFactor.scoreA > highVivFactor.scoreB ? 'more' : 'fewer';
      push(26,
        `Nights you rated highly vivid tend to have ${dir} recalled dreams.`,
        `Vivid nights (avg vividness 4+) averaged ${highVivFactor.scoreA} dreams vs ${highVivFactor.scoreB} on less vivid nights.`
      );
    }

    // ── MEDIUM PRIORITY: meaningful multi-week trends ─────────────────────────

    // Recall trend over 4+ weeks (objective)
    const { data: recallWeeks, trend: recallTrend } = weeklyData;
    if (recallTrend.length >= 4) {
      const slope = recallTrend[recallTrend.length - 1] - recallTrend[recallTrend.length - 4];
      if (slope > 0.5)
        push(22, `Dream recall has been trending upward.`, `Your weekly dream count has been steadily rising over the past month.`);
      else if (slope < -0.5)
        push(21, `Dream recall has been gradually declining.`, `Consistent morning logging is the most reliable way to reverse this.`);
    }

    // Vividness trend (self-reported, hedge)
    if (vividnessData.length >= 4) {
      const vals = vividnessData.map(v => v.avg);
      const first2avg = (vals[0] + vals[1]) / 2;
      const last2avg  = (vals[vals.length - 1] + vals[vals.length - 2]) / 2;
      const vivSlope  = parseFloat((last2avg - first2avg).toFixed(1));
      if (vivSlope >= 0.5)
        push(22 + vivSlope, `Self-reported vividness appears to be improving.`, `Average has risen from around ${first2avg.toFixed(1)}/5 to ${last2avg.toFixed(1)}/5 over the past 4 weeks.`);
      else if (vivSlope <= -0.5)
        push(20, `Self-reported vividness appears to be declining.`, `Down from around ${first2avg.toFixed(1)}/5 to ${last2avg.toFixed(1)}/5 over the past month. Logging quickly after waking tends to help.`);
      else if (vividnessData.length >= 3) {
        const lastAvg = vividnessData[vividnessData.length - 1].avg;
        push(12, `Vividness has been consistent for several weeks.`, `Averaging around ${lastAvg}/5 based on self-reported ratings.`);
      }
    }

    // Mood trend (self-reported, hedge)
    if (moodData && moodData.data.length >= 3) {
      const md = moodData.data;
      const mSlope = parseFloat((md[md.length - 1] - md[md.length - 3]).toFixed(1));
      if (mSlope >= 0.4)
        push(20, `Waking mood appears to be improving.`, `Self-reported mood has trended from ${md[md.length - 3].toFixed(1)} to ${md[md.length - 1].toFixed(1)}/5 over the past few weeks.`);
      else if (mSlope <= -0.4)
        push(18, `Waking mood appears to have dipped recently.`, `Self-reported mood has trended from ${md[md.length - 3].toFixed(1)} to ${md[md.length - 1].toFixed(1)}/5 over the past few weeks.`);
    }

    // Week-over-week recall (objective, no hedge)
    if (recallWeeks.length >= 2) {
      const latest = recallWeeks[recallWeeks.length - 1];
      const prev   = recallWeeks[recallWeeks.length - 2];
      const diff   = latest - prev;
      if (diff >= 3)
        push(20 + diff, `Recall jumped this week.`, `${latest} dreams logged this week, up ${diff} from last week's ${prev}.`);
      else if (diff <= -3)
        push(18, `Recall dropped this week.`, `${latest} dreams logged, down ${Math.abs(diff)} from last week. Try logging the moment you wake up.`);
    }

    // ── LOW PRIORITY: observations ────────────────────────────────────────────

    // Most recurring theme (objective)
    if (tagData.length >= 2)
      push(10, `"${tagData[0].label}" is your most recurring dream theme.`, `Appears in ${tagData[0].value} dream${tagData[0].value !== 1 ? 's' : ''}. "${tagData[1].label}" is close behind at ${tagData[1].value}.`);
    else if (tagData.length === 1)
      push(8, `"${tagData[0].label}" is your only tagged theme so far.`, `Adding more tags helps surface patterns over time.`);

    // ── Sort by score, return all (preview slices top 4) ────────────────────
    return candidates
      .sort((a, b) => b.score - a.score)
      .map(({ text, sub, score }) => ({ text, sub, score }));
  }, [weeklyData, vividnessData, moodData, consistencyData, tagData, recallDreams, dreamFactors, moodCorrelations, weekOverWeek, lucidData]);

  const previewInsights = insights.slice(0, 4);

  // Sync top 2 insights to home screen
  React.useEffect(() => {
    onInsightsChange?.(previewInsights.slice(0, 2));
  }, [insights]);
  const [insightsModalVisible, setInsightsModalVisible] = useState(false);
  const insets = useSafeAreaInsets();

  const isEmpty = dreams.length === 0;

  return (
    <TipContext.Provider value={{ show: showTip, hide: hideTip, visible: tipPos !== null }}>
      <View style={{ flex: 1 }}>
        <ScrollView
          style={styles.root}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          delayContentTouches={false}
          canCancelContentTouches={true}
          onScroll={() => { if (tipPos) hideTip(); }}
        >
      <Text style={styles.pageTitle}>Analytics</Text>
      <Text style={styles.pageSubtitle}>
        {isEmpty ? 'Start logging dreams to see your patterns' : `${recallDreams.length} recalled dream${recallDreams.length !== 1 ? 's' : ''} analysed`}
      </Text>

      {isEmpty ? (
        <Card style={styles.emptyCard}>
          <Svg width={56} height={56} viewBox="0 0 56 56" style={{ marginBottom: 16 }}>
            <SvgCircle cx={28} cy={28} r={27} fill="rgba(167,139,250,0.08)" stroke="rgba(167,139,250,0.2)" strokeWidth={1} />
            <SvgPath d="M28 14 C22 14 17 19 17 25 C17 33 28 42 28 42 C28 42 39 33 39 25 C39 19 34 14 28 14Z" fill="rgba(167,139,250,0.15)" stroke="rgba(167,139,250,0.4)" strokeWidth={1.2} />
            <SvgCircle cx={28} cy={24} r={4} fill="rgba(167,139,250,0.5)" />
          </Svg>
          <Text style={styles.emptyText}>Nothing to analyse yet</Text>
          <Text style={styles.emptySubtext}>Start logging dreams to unlock trends, patterns, and personal insights about your sleep and recall.</Text>
          <Text style={styles.emptyHint}>Insights improve the more you log, even a week of entries makes a difference.</Text>
        </Card>
      ) : (
        <>
          {/* ── Insights ── */}
          {previewInsights.length > 0 && (
            <>
              <Modal
                visible={insightsModalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setInsightsModalVisible(false)}
              >
                <View style={styles.modalRoot}>
                  <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, 20) }]}>
                    <Text style={styles.modalTitle}>All insights</Text>
                    <TouchableOpacity onPress={() => setInsightsModalVisible(false)} activeOpacity={0.7} style={styles.modalClose}>
                      <Text style={styles.modalCloseText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
                    <Text style={styles.modalSubtitle}>{insights.length} insight{insights.length !== 1 ? 's' : ''} based on your data</Text>
                    {insights.map((ins, i) => (
                      <View key={i} style={[styles.insightRow, styles.insightRowBorder, { marginBottom: 0 }]}>
                        <View style={styles.insightDot} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.insightText}>{ins.text}</Text>
                          {ins.sub && <Text style={styles.insightSub}>{ins.sub}</Text>}
                        </View>
                      </View>
                    ))}
                    <Text style={[styles.insightsFooter, { marginTop: 20 }]}>Insights improve as more dreams are logged.</Text>
                    <View style={{ height: 40 }} />
                  </ScrollView>
                </View>
              </Modal>

              <Card style={styles.insightsCard}>
                {previewInsights.map((ins, i) => (
                  <View key={i} style={[styles.insightRow, i > 0 && styles.insightRowBorder]}>
                    <View style={styles.insightDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.insightText}>{ins.text}</Text>
                      {ins.sub && <Text style={styles.insightSub}>{ins.sub}</Text>}
                    </View>
                  </View>
                ))}
                <View style={styles.insightsCardFooter}>
                  <Text style={styles.insightsFooter}>Insights improve as more dreams are logged.</Text>
                  {insights.length > 4 && (
                    <TouchableOpacity onPress={() => setInsightsModalVisible(true)} activeOpacity={0.7} style={styles.viewAllBtn}>
                      <Text style={styles.viewAllText}>View all insights ({insights.length})</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Card>
            </>
          )}

          {/* ── Am I improving? ── */}
          <SectionHeader label="Am I improving?" />
          <Card>
            <CardHeader
              title="Dream recall over time"
              subtitle={'Dreams recalled per week (excludes "no memory" nights)'}
              info="How many dreams you wrote down each week. Purple is the actual count, amber smooths it so you can see if recall is trending up or down."
            />
            {weeklyData.data.length > 1 ? (
              <>
                <View style={styles.chartWrap}>
                  <LineChartSkia data={weeklyData.data} trend={weeklyData.trend} labels={weeklyData.labels} height={180} valueLabel="dreams" />
                </View>
                <View style={styles.legend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: PURPLE }]} />
                    <Text style={styles.legendText}>
                      Dreams recalled
                      {weeklyData.data.length > 0 && (
                        <Text style={{ color: PURPLE }}> · {weeklyData.data[weeklyData.data.length - 1]} this week</Text>
                      )}
                    </Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendLine, { backgroundColor: AMBER }]} />
                    <Text style={styles.legendText}>
                      Trend
                      {weeklyData.trend.length > 0 && (
                        <Text style={{ color: AMBER }}> · {weeklyData.trend[weeklyData.trend.length - 1].toFixed(1)}</Text>
                      )}
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.placeholderWrap}>
                <Svg width={32} height={32} viewBox="0 0 32 32" style={{ marginBottom: 8 }}>
                  <SvgPath d="M4 24 L8 18 L12 20 L17 12 L22 16 L28 8" stroke="rgba(167,139,250,0.3)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  <SvgCircle cx={28} cy={8} r={2.5} fill="rgba(167,139,250,0.3)" />
                </Svg>
                <Text style={styles.placeholderTitle}>Keep logging</Text>
                <Text style={styles.placeholderBody}>Log dreams across at least 2 weeks and your recall trend will appear here.</Text>
              </View>
            )}
          </Card>

          {/* ── Vividness ── */}
          {vividnessData.length > 1 && (
            <Card>
              <CardHeader
                title="Vividness over time"
                subtitle="Average vividness per week (1 to 5, recall only)"
                info="Your average vividness score each week. Higher means dreams felt more real and detailed. Nights with no recall are not included."
              />
              <View style={styles.chartWrap}>
                <VividnessChart data={vividnessData} />
              </View>
            </Card>
          )}

          {/* ── Mood ── */}
          {moodData ? (
            <Card>
              <CardHeader
                title="Mood over time"
                subtitle="Average self-reported mood per week (1 to 5)"
                info="Your waking mood per week, rated 1 to 5 when you logged. The amber line smooths out the noise so bigger patterns are easier to see."
              />
              <View style={styles.chartWrap}>
                <LineChartSkia data={moodData.data} trend={moodData.trend} labels={moodData.labels} height={160} yMin={1} yMax={5} valueLabel="mood" />
              </View>
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: PURPLE }]} />
                  <Text style={styles.legendText}>
                    Mood
                    {moodData.data.length > 0 && (
                      <Text style={{ color: PURPLE }}> · {moodData.data[moodData.data.length - 1].toFixed(1)}/5</Text>
                    )}
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendLine, { backgroundColor: AMBER }]} />
                  <Text style={styles.legendText}>
                    Trend
                    {moodData.trend.length > 0 && (
                      <Text style={{ color: AMBER }}> · {moodData.trend[moodData.trend.length - 1].toFixed(1)}</Text>
                    )}
                  </Text>
                </View>
              </View>
              <View style={styles.moodLegendRow}>
                {MOOD_FACES.map((face, i) => (
                  <View key={i} style={styles.moodLegendItem}>
                    <MoodFaceSvg index={i} size={22} />
                    <Text style={styles.moodLegendNum}>{i + 1}</Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : (
            recallDreams.some(d => d.mood && d.mood > 0) ? null : null
          )}

          {/* ── Lucid dreaming ── */}
          <SectionHeader label="Lucid dreaming" />
          {lucidData && lucidData.count > 0 ? (
            <Card>
              <CardHeader
                title="Lucid dream rate"
                subtitle="How often your dreams have been lucid"
                info="What percentage of your remembered dreams were lucid each week. More reality checks during the day tends to push this number up."
              />

              {/* Summary stats row */}
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16, marginTop: 14 }}>
                <View style={styles.lucidStatBox}>
                  <Text style={styles.lucidStatNum}>{lucidData.count}</Text>
                  <Text style={styles.lucidStatLabel}>lucid dreams</Text>
                </View>
                <View style={styles.lucidStatBox}>
                  <Text style={styles.lucidStatNum}>{lucidData.lucidRate}%</Text>
                  <Text style={styles.lucidStatLabel}>of all dreams</Text>
                </View>
                {lucidData.vividnessDiff !== null && lucidData.total - lucidData.count >= 5 && (
                  <View style={styles.lucidStatBox}>
                    <Text style={[styles.lucidStatNum, { color: lucidData.vividnessDiff >= 0 ? PURPLE : '#f87171' }]}>
                      {lucidData.vividnessDiff >= 0 ? '+' : ''}{lucidData.vividnessDiff}%
                    </Text>
                    <Text style={styles.lucidStatLabel}>vividness vs avg</Text>
                  </View>
                )}
              </View>

              {/* Chart, only if 2+ weeks of data */}
              {lucidData.chartData.length > 1 && (
                <View style={styles.chartWrap}>
                  <LineChartSkia
                    data={lucidData.chartData}
                    trend={lucidData.trend}
                    labels={lucidData.chartLabels}
                    height={140}
                    yMin={0}
                    yMax={100}
                    yStep={20}
                    valueLabel="% lucid"
                  />
                  <View style={styles.legend}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: PURPLE }]} />
                      <Text style={styles.legendText}>
                        Lucid rate
                        {lucidData.chartData.length > 0 && (
                          <Text style={{ color: PURPLE }}> · {lucidData.chartData[lucidData.chartData.length - 1]}%</Text>
                        )}
                      </Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendLine, { backgroundColor: AMBER }]} />
                      <Text style={styles.legendText}>
                        Trend
                        {lucidData.trend.length > 0 && (
                          <Text style={{ color: AMBER }}> · {lucidData.trend[lucidData.trend.length - 1].toFixed(1)}%</Text>
                        )}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </Card>
          ) : (
            <Card>
              <View style={styles.placeholderWrap}>
                <Svg width={32} height={32} viewBox="0 0 32 32" style={{ marginBottom: 8 }}>
                  <SvgPath d="M16 3 C10 3 5 8 5 14 C5 22 12 27 16 29 C20 27 27 22 27 14 C27 8 22 3 16 3Z" fill="rgba(167,139,250,0.1)" stroke="rgba(167,139,250,0.3)" strokeWidth={1.2} />
                  <SvgCircle cx={16} cy={13} r={3.5} fill="rgba(167,139,250,0.4)" />
                </Svg>
                <Text style={styles.placeholderTitle}>No lucid dreams yet</Text>
                <Text style={styles.placeholderBody}>When you log a lucid dream, your lucidity rate and patterns will appear here.</Text>
              </View>
            </Card>
          )}

          {/* ── What actually helps? ── */}
          <SectionHeader label="What actually helps?" />
          <Card>
            <CardHeader
              title="Dream factors"
              subtitle="How different conditions correlate with recall and vividness"
              info="Compares groups of nights like high vs low reality check nights. The percentage shows how much better or worse recall was. A bigger number means a stronger pattern."
            />
            {dreamFactors.length > 0 ? (
              dreamFactors.map((f, i) => (
                <FactorRow key={i} label={f.label} sub={f.sub} scoreA={f.scoreA} scoreB={f.scoreB} labelA={f.labelA} labelB={f.labelB} />
              ))
            ) : (
              <View style={styles.placeholderWrap}>
                <Svg width={32} height={32} viewBox="0 0 32 32" style={{ marginBottom: 8 }}>
                  <SvgCircle cx={16} cy={16} r={13} fill="none" stroke="rgba(167,139,250,0.25)" strokeWidth={1} strokeDasharray="3 3" />
                  <SvgPath d="M16 9 L16 17" stroke="rgba(167,139,250,0.4)" strokeWidth={2} strokeLinecap="round" />
                  <SvgCircle cx={16} cy={21} r={1.5} fill="rgba(167,139,250,0.4)" />
                </Svg>
                <Text style={styles.placeholderTitle}>Not enough data yet</Text>
                <Text style={styles.placeholderBody}>Log at least 10 dreams with vividness ratings, and try a WBTB night, to see what actually helps you.</Text>
              </View>
            )}
          </Card>

          {/* ── Mood correlations ── */}
          {recallDreams.some(d => d.mood && d.mood > 0) && (
            <Card>
              <CardHeader
                title="Mood correlations"
                subtitle="How different night types relate to how you felt waking up"
                info="Shows your average waking mood (1-5) for different types of nights. The top number is the condition being tested, the bottom is the baseline. Higher top score means that condition tends to come with a better morning."
              />
              {moodCorrelations.length > 0 ? (
                moodCorrelations.map((c, i) => (
                  <FactorRow key={i} label={c.label} sub={c.sub} scoreA={c.scoreA} scoreB={c.scoreB} labelA={c.labelA} labelB={c.labelB} />
                ))
              ) : (
                <View style={styles.placeholderWrap}>
                  <Svg width={32} height={32} viewBox="0 0 32 32" style={{ marginBottom: 8 }}>
                    <SvgCircle cx={16} cy={16} r={13} fill="rgba(167,139,250,0.1)" stroke="rgba(167,139,250,0.3)" strokeWidth={1.2} />
                    <SvgCircle cx={11} cy={13} r={1.5} fill="rgba(167,139,250,0.5)" />
                    <SvgCircle cx={21} cy={13} r={1.5} fill="rgba(167,139,250,0.5)" />
                    <SvgPath d="M11 20 Q16 24 21 20" stroke="rgba(167,139,250,0.5)" strokeWidth={1.5} strokeLinecap="round" fill="none" />
                  </Svg>
                  <Text style={styles.placeholderTitle}>Almost there</Text>
                  <Text style={styles.placeholderBody}>Log mood on at least 8 entries to reveal patterns.</Text>
                </View>
              )}
            </Card>
          )}

          {/* ── Dream patterns ── */}
          <SectionHeader label="Dream patterns" />
          {tagData.length > 0 ? (
            <Card>
              <CardHeader
                title="Most frequent themes"
                subtitle="Based on your tags"
                info="How many dreams each tag appears in. The longer the bar, the more often that theme showed up. Keep adding tags when logging to build this out."
              />
              <View style={styles.chartWrap}>
                <HBarChart items={tagData} />
              </View>
            </Card>
          ) : (
            <Card>
              <View style={styles.placeholderWrap}>
                <Svg width={32} height={32} viewBox="0 0 32 32" style={{ marginBottom: 8 }}>
                  <SvgPath d="M6 10 Q6 7 9 7 L17 7 L26 16 L17 25 L9 25 Q6 25 6 22 Z" fill="rgba(167,139,250,0.1)" stroke="rgba(167,139,250,0.3)" strokeWidth={1.2} />
                  <SvgCircle cx={11} cy={13} r={1.5} fill="rgba(167,139,250,0.5)" />
                </Svg>
                <Text style={styles.placeholderTitle}>No themes yet</Text>
                <Text style={styles.placeholderBody}>Add tags to your dreams, flying, chase, water, and recurring themes will surface here.</Text>
              </View>
            </Card>
          )}

          {/* ── Practice stability ── */}
          <SectionHeader label="Practice stability" />
          {(() => {
            const uniqueDays = new Set(dreams.map(d => d.dateISO));
            if (uniqueDays.size < 2) return (
              <Card>
                <View style={styles.placeholderWrap}>
                  <Svg width={32} height={32} viewBox="0 0 32 32" style={{ marginBottom: 8 }}>
                    <SvgPath d="M4 22 L4 10 M10 22 L10 14 M16 22 L16 8 M22 22 L22 12 M28 22 L28 6" stroke="rgba(167,139,250,0.3)" strokeWidth={1.5} strokeLinecap="round" />
                    <SvgPath d="M2 24 L30 24" stroke="rgba(167,139,250,0.2)" strokeWidth={1} strokeLinecap="round" />
                  </Svg>
                  <Text style={styles.placeholderTitle}>Not enough data yet</Text>
                  <Text style={styles.placeholderBody}>Log dreams on at least 2 different days to see your consistency grid.</Text>
                </View>
              </Card>
            );
            const sortedDays = [...uniqueDays].sort();
            const firstDate = new Date(sortedDays[0]);
            firstDate.setHours(0, 0, 0, 0);
            const today2 = new Date(); today2.setHours(0, 0, 0, 0);
            const daysSinceFirst = Math.round((today2.getTime() - firstDate.getTime()) / (24*60*60*1000));
            const displayDays = Math.min(Math.max(daysSinceFirst, 1), 49);
            return (
              <Card>
                <View style={styles.consistencyHeader}>
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <Text style={styles.cardTitle}>Logging consistency</Text>
                      <InfoTooltip text="Each dot is one day. Purple means you recalled a dream, faded purple means logged with no memory, empty means nothing logged. The streak counts consecutive days up to today." />
                    </View>
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
                <Text style={styles.wowValue}>{weekOverWeek.thisAvgViv > 0 ? weekOverWeek.thisAvgViv.toFixed(1) : '–'}</Text>
                <DeltaPill value={weekOverWeek.vivDelta} unit="vs last wk" />
              </View>
              <View style={styles.wowDivider} />
              <View style={styles.wowBlock}>
                <Text style={styles.wowLabel}>Lucid dreams</Text>
                <Text style={styles.wowValue}>{weekOverWeek.thisLucid}</Text>
                <DeltaPill value={weekOverWeek.lucidDelta} unit="vs last wk" />
              </View>
            </View>
          </Card>
        </>
      )}


      <View style={{ height: 32 }} />
        </ScrollView>
        {tipPos && (
          <Animated.View
            pointerEvents="box-none"
            style={[infoStyles.bubble, { top: tipPos.top, right: tipPos.right }, {
              opacity: tipAnim,
              transform: [
                { scale: tipAnim.interpolate({ inputRange: [0,1], outputRange: [0.88,1] }) },
                { translateY: tipAnim.interpolate({ inputRange: [0,1], outputRange: [-4,0] }) },
              ],
            }]}
          >
            <Pressable onPress={hideTip} style={{ flex: 1 }}>
              <Text style={infoStyles.bubbleText}>{tipPos.text}</Text>
            </Pressable>
          </Animated.View>
        )}
      </View>
    </TipContext.Provider>
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

  insightsCard:    { gap: 0, paddingVertical: 4 },
  insightsCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  viewAllBtn:  { paddingHorizontal: 10, paddingVertical: 3, backgroundColor: 'rgba(167,139,250,0.12)', borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.25)' },
  viewAllText: { fontSize: 11, fontFamily: 'Nunito_600SemiBold', color: PURPLE },

  // Modal
  modalRoot:      { flex: 1, backgroundColor: '#0d0b1e' },
  modalHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.08)' },
  modalTitle:     { fontSize: 20, fontFamily: 'Nunito_800ExtraBold', color: TEXT_PRIMARY },
  modalClose:     { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: 'rgba(167,139,250,0.12)', borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.25)' },
  modalCloseText: { fontSize: 13, fontFamily: 'Nunito_600SemiBold', color: PURPLE },
  modalContent:   { paddingHorizontal: 20, paddingTop: 16 },
  modalSubtitle:  { fontSize: 13, fontFamily: 'Nunito_300Light', color: TEXT_MUTED, marginBottom: 16 },
  insightRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  insightRowBorder:{ borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.07)' },
  insightDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: PURPLE, marginTop: 6, flexShrink: 0 },
  insightText:     { fontSize: 14, fontFamily: 'Nunito_600SemiBold', color: TEXT_PRIMARY, lineHeight: 20, marginBottom: 2 },
  insightSub:      { fontSize: 12, fontFamily: 'Nunito_400Regular', color: TEXT_MUTED, lineHeight: 17 },
  insightsFooter:  { fontSize: 11, fontFamily: 'Nunito_300Light', color: 'rgba(255,255,255,0.25)', marginTop: 8, textAlign: 'center' },

  insightCard:   { gap: 10 },
  insightBullet: { width: 5, height: 5, borderRadius: 3, backgroundColor: PURPLE, marginTop: 6, flexShrink: 0 },

  placeholderWrap:   { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 8 },
  placeholderTitle:  { fontSize: 14, fontFamily: 'Nunito_800ExtraBold', color: TEXT_PRIMARY, marginBottom: 6, textAlign: 'center' },
  placeholderBody:   { fontSize: 13, fontFamily: 'Nunito_300Light', color: TEXT_MUTED, lineHeight: 19, textAlign: 'center' },

  emptyCard:    { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyText:    { fontSize: 17, fontFamily: 'Nunito_800ExtraBold', color: TEXT_PRIMARY, marginBottom: 8 },
  emptySubtext: { fontSize: 13, fontFamily: 'Nunito_300Light', color: TEXT_MUTED, textAlign: 'center', lineHeight: 20 },
  emptyHint:    { fontSize: 11, fontFamily: 'Nunito_300Light', color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 12, lineHeight: 17 },

  notEnough: { fontSize: 13, fontFamily: 'Nunito_300Light', color: TEXT_MUTED, fontStyle: 'italic', marginTop: 4, marginBottom: 4 },

  lucidStatBox: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    backgroundColor: 'rgba(167,139,250,0.07)',
    borderRadius: 12, borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.2)',
  },
  lucidStatNum:   { fontSize: 20, fontFamily: 'Nunito_800ExtraBold', color: PURPLE, marginBottom: 2 },
  lucidStatLabel: { fontSize: 10, fontFamily: 'Nunito_400Regular', color: TEXT_MUTED, textAlign: 'center' },

  moodLegendRow:  { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: WHITE_MID },
  moodLegendItem: { alignItems: 'center', gap: 4 },
  moodLegendEmoji:{ fontSize: 18 },
  moodLegendNum:  { fontSize: 10, fontFamily: 'Nunito_600SemiBold', color: TEXT_MUTED },

  // Debug
});