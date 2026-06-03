import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  AppState,
  Linking,
  Modal,
  NativeModules,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Path, Svg } from 'react-native-svg';
import { colors } from '../constants/colors';
import { generateDebugData } from '../utils/debugData';
import {
  DEFAULT_NOTIF_SETTINGS,
  loadNotifSettings,
  NotifSettings,
  requestNotifPermission,
  saveNotifSettings,
  scheduleNotifications, scheduleStreakReminders,
  setupNotificationChannel,
} from '../utils/notifications';
import { Dream, exportData, loadDreams, saveChecks, saveDreams } from '../utils/storage';
import { saveWBTBSettingsNative } from '../utils/wbtbBridge';

// ─── Saved checkmark SVG ────────────────────────────────────────────────────
function SavedCheck({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14">
      <Path
        d="M2.5 7L5.5 10L11.5 4"
        stroke="#f0ecff"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

// ─── PIN storage ─────────────────────────────────────────────────────────────
export const PIN_KEY = 'lucid_pin_v1';

export async function loadPin(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(PIN_KEY);
    return raw ?? null;
  } catch { return null; }
}

export async function savePin(pin: string | null): Promise<void> {
  try {
    if (pin === null) await AsyncStorage.removeItem(PIN_KEY);
    else await AsyncStorage.setItem(PIN_KEY, pin);
  } catch {}
}

// ─── Hour formatter ────────────────────────────────────────────────────────────
function formatHour(h: number): string {
  if (h === 0)  return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

// ─── Time formatter (minutes to "3:46 PM") ─────────────────────────────────
function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h < 12 ? 'AM' : 'PM';
  const minStr = m.toString().padStart(2, '0');
  return `${hour}:${minStr} ${ampm}`;
}

// ─── Number Picker Modal ────────────────────────────────────────────────────────
interface NumberPickerModalProps {
  visible: boolean;
  initialValue: number;
  min: number;
  max: number;
  unit: string;
  onSave: (value: number) => void;
  onClose: () => void;
}

const DRUM_ITEM_H = 52;
const DRUM_VISIBLE = 5; // odd to center selected

function NumberPickerModal({ visible, initialValue, min, max, unit, onSave, onClose }: NumberPickerModalProps) {
  const [value, setValue] = useState(initialValue);
  const scrollRef = useRef<ScrollView>(null);
  const didLayoutRef = useRef(false);
  const items = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  // Reset value when modal opens
  useEffect(() => {
    if (visible) {
      setValue(initialValue);
      didLayoutRef.current = false;
    }
  }, [visible, initialValue]);

  // Scroll to position after layout
  const handleLayout = () => {
    if (didLayoutRef.current) return;
    didLayoutRef.current = true;
    const idx = initialValue - min;
    scrollRef.current?.scrollTo({ y: idx * DRUM_ITEM_H, animated: false });
  };

  const handleScroll = (e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    const clamped = Math.max(0, Math.min(items.length - 1, Math.round(y / DRUM_ITEM_H)));
    setValue(items[clamped]);
    scrollRef.current?.scrollTo({ y: clamped * DRUM_ITEM_H, animated: true });
  };

  const windowH = DRUM_ITEM_H * DRUM_VISIBLE;
  const padding = DRUM_ITEM_H * Math.floor(DRUM_VISIBLE / 2);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={npStyles.overlay}>
        <View style={npStyles.card}>
          <Text style={npStyles.title}>
            {value}<Text style={npStyles.titleUnit}> {unit}</Text>
          </Text>

          <View style={[npStyles.drumWrap, { height: windowH }]}>
            {/* Selection highlight band */}
            <View pointerEvents="none" style={[npStyles.selBand, { top: padding }]} />

            <ScrollView
              ref={scrollRef}
              showsVerticalScrollIndicator={false}
              decelerationRate={0.992}
              onLayout={handleLayout}
              onMomentumScrollEnd={handleScroll}
              contentContainerStyle={{ paddingTop: padding, paddingBottom: padding }}
            >
              {items.map(n => {
                const sel = n === value;
                return (
                  <TouchableOpacity
                    key={n}
                    style={npStyles.drumItem}
                    onPress={() => {
                      setValue(n);
                      scrollRef.current?.scrollTo({ y: (n - min) * DRUM_ITEM_H, animated: true });
                    }}
                    activeOpacity={0.6}
                  >
                    <Text style={[npStyles.drumText, sel && npStyles.drumTextSel]}>{n}</Text>
                    <Text style={[npStyles.drumUnit, sel && npStyles.drumUnitSel]}>{unit}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <View style={npStyles.actions}>
            <TouchableOpacity style={npStyles.cancelBtn} onPress={onClose}>
              <Text style={npStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={npStyles.saveBtn} onPress={() => onSave(value)}>
              <Text style={npStyles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const npStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#1a1730', borderRadius: 20,
    padding: 24, width: '100%', maxWidth: 280,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)',
  },
  title: {
    fontSize: 36, fontFamily: 'Nunito_800ExtraBold',
    color: colors.lightPurple, textAlign: 'center', marginBottom: 16,
  },
  titleUnit: { fontSize: 18, fontFamily: 'Nunito_600SemiBold', color: colors.textMuted },
  drumWrap: { overflow: 'hidden', marginBottom: 20, position: 'relative' },
  selBand: {
    position: 'absolute', left: 0, right: 0, height: DRUM_ITEM_H,
    borderTopWidth: 0.5, borderBottomWidth: 0.5,
    borderColor: 'rgba(167,139,250,0.4)',
    backgroundColor: 'rgba(167,139,250,0.09)',
    zIndex: 1,
  },
  drumItem: {
    height: DRUM_ITEM_H, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  drumText: { fontSize: 26, fontFamily: 'Nunito_800ExtraBold', color: 'rgba(255,255,255,0.25)' },
  drumTextSel: { color: colors.textPrimary },
  drumUnit: { fontSize: 15, fontFamily: 'Nunito_600SemiBold', color: 'rgba(255,255,255,0.15)' },
  drumUnitSel: { color: colors.textMuted },
  actions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center' },
  cancelText: { fontSize: 15, fontFamily: 'Nunito_600SemiBold', color: colors.textMuted },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: colors.primaryPurple, alignItems: 'center' },
  saveText: { fontSize: 15, fontFamily: 'Nunito_600SemiBold', color: colors.textPrimary },
});

// ─── Time Picker Modal ─────────────────────────────────────────────────────────
interface TimePickerModalProps {
  visible: boolean;
  initialMinutes: number;
  onSave: (minutes: number) => void;
  onClose: () => void;
}

function TimePickerModal({ visible, initialMinutes, onSave, onClose }: TimePickerModalProps) {
  const toH12 = (h24: number) => (h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24);

  const initH24   = Math.floor(initialMinutes / 60);
  const initH12   = toH12(initH24);
  const initMin   = initialMinutes % 60;
  const initIsPm  = initH24 >= 12;

  const [hour,   setHour]   = useState(initH12);
  const [minute, setMinute] = useState(initMin);
  const [isPm,   setIsPm]   = useState(initIsPm);

  const hourRef   = useRef<ScrollView>(null);
  const minRef    = useRef<ScrollView>(null);
  const hourDidLayout = useRef(false);
  const minDidLayout  = useRef(false);

  useEffect(() => {
    if (visible) {
      setHour(initH12);
      setMinute(initMin);
      setIsPm(initIsPm);
      hourDidLayout.current = false;
      minDidLayout.current  = false;
    }
  }, [visible, initialMinutes]);

  const ITEM_H   = 52;
  const VISIBLE  = 5;
  const padding  = ITEM_H * Math.floor(VISIBLE / 2);
  const windowH  = ITEM_H * VISIBLE;

  const handleHourScroll = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    const h = Math.max(1, Math.min(12, idx + 1));
    setHour(h);
    hourRef.current?.scrollTo({ y: (h - 1) * ITEM_H, animated: true });
  };
  const handleMinScroll = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    const m = Math.max(0, Math.min(59, idx));
    setMinute(m);
    minRef.current?.scrollTo({ y: m * ITEM_H, animated: true });
  };

  const handleSave = () => {
    const h24 = isPm ? (hour === 12 ? 12 : hour + 12) : (hour === 12 ? 0 : hour);
    onSave(h24 * 60 + minute);
  };

  const preview = (() => {
    const h24 = isPm ? (hour === 12 ? 12 : hour + 12) : (hour === 12 ? 0 : hour);
    const hDisp = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
    const ampm  = h24 >= 12 ? 'PM' : 'AM';
    return `${hDisp}:${minute.toString().padStart(2, '0')} ${ampm}`;
  })();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={tpStyles.overlay}>
        <View style={tpStyles.card}>
          <Text style={tpStyles.title}>{preview}</Text>

          <View style={tpStyles.drumRow}>
            {/* Hour drum */}
            <View style={[tpStyles.drumWrap, { height: windowH }]}>
              <View pointerEvents="none" style={[tpStyles.selBand, { top: padding }]} />
              <ScrollView
                ref={hourRef}
                showsVerticalScrollIndicator={false}
                decelerationRate={0.992}
                onLayout={() => {
                  if (hourDidLayout.current) return;
                  hourDidLayout.current = true;
                  hourRef.current?.scrollTo({ y: (initH12 - 1) * ITEM_H, animated: false });
                }}
                onMomentumScrollEnd={handleHourScroll}
                contentContainerStyle={{ paddingTop: padding, paddingBottom: padding }}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                  <TouchableOpacity
                    key={h}
                    style={tpStyles.drumItem}
                    onPress={() => {
                      setHour(h);
                      hourRef.current?.scrollTo({ y: (h - 1) * ITEM_H, animated: true });
                    }}
                    activeOpacity={0.6}
                  >
                    <Text style={[tpStyles.drumText, h === hour && tpStyles.drumTextSel]}>{h}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <Text style={tpStyles.colon}>:</Text>

            {/* Minute drum */}
            <View style={[tpStyles.drumWrap, { height: windowH }]}>
              <View pointerEvents="none" style={[tpStyles.selBand, { top: padding }]} />
              <ScrollView
                ref={minRef}
                showsVerticalScrollIndicator={false}
                decelerationRate={0.992}
                onLayout={() => {
                  if (minDidLayout.current) return;
                  minDidLayout.current = true;
                  minRef.current?.scrollTo({ y: initMin * ITEM_H, animated: false });
                }}
                onMomentumScrollEnd={handleMinScroll}
                contentContainerStyle={{ paddingTop: padding, paddingBottom: padding }}
              >
                {Array.from({ length: 60 }, (_, i) => i).map(m => (
                  <TouchableOpacity
                    key={m}
                    style={tpStyles.drumItem}
                    onPress={() => {
                      setMinute(m);
                      minRef.current?.scrollTo({ y: m * ITEM_H, animated: true });
                    }}
                    activeOpacity={0.6}
                  >
                    <Text style={[tpStyles.drumText, m === minute && tpStyles.drumTextSel]}>
                      {m.toString().padStart(2, '0')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* AM/PM toggle */}
          <View style={tpStyles.ampmRow}>
            <TouchableOpacity
              style={[tpStyles.ampmBtn, !isPm && tpStyles.ampmBtnActive]}
              onPress={() => setIsPm(false)}
            >
              <Text style={[tpStyles.ampmText, !isPm && tpStyles.ampmTextActive]}>AM</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[tpStyles.ampmBtn, isPm && tpStyles.ampmBtnActive]}
              onPress={() => setIsPm(true)}
            >
              <Text style={[tpStyles.ampmText, isPm && tpStyles.ampmTextActive]}>PM</Text>
            </TouchableOpacity>
          </View>

          <View style={tpStyles.actions}>
            <TouchableOpacity style={tpStyles.cancelBtn} onPress={onClose}>
              <Text style={tpStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={tpStyles.saveBtn} onPress={handleSave}>
              <Text style={tpStyles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const tpStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#1a1730', borderRadius: 20,
    padding: 24, width: '100%', maxWidth: 320,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)',
  },
  title: {
    fontSize: 32, fontFamily: 'Nunito_800ExtraBold',
    color: colors.lightPurple, textAlign: 'center', marginBottom: 16,
  },
  drumRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 20 },
  drumWrap: { flex: 1, overflow: 'hidden', position: 'relative' },
  selBand: {
    position: 'absolute', left: 0, right: 0, height: 52,
    borderTopWidth: 0.5, borderBottomWidth: 0.5,
    borderColor: 'rgba(167,139,250,0.4)',
    backgroundColor: 'rgba(167,139,250,0.09)',
    zIndex: 1,
  },
  drumItem: { height: 52, alignItems: 'center', justifyContent: 'center' },
  drumText: { fontSize: 26, fontFamily: 'Nunito_800ExtraBold', color: 'rgba(255,255,255,0.25)' },
  drumTextSel: { color: colors.textPrimary },
  colon: {
    fontSize: 28, fontFamily: 'Nunito_800ExtraBold',
    color: colors.textMuted, paddingBottom: 4,
  },
  ampmRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  ampmBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  ampmBtnActive: { backgroundColor: 'rgba(167,139,250,0.15)', borderColor: 'rgba(167,139,250,0.4)' },
  ampmText: { fontSize: 16, fontFamily: 'Nunito_600SemiBold', color: colors.textMuted },
  ampmTextActive: { color: colors.lightPurple },
  actions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center' },
  cancelText: { fontSize: 15, fontFamily: 'Nunito_600SemiBold', color: colors.textMuted },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: colors.primaryPurple, alignItems: 'center' },
  saveText: { fontSize: 15, fontFamily: 'Nunito_600SemiBold', color: colors.textPrimary },
});

// ─── Stepper ───────────────────────────────────────────────────────────────────
function Stepper({ value, min, max, onChange, format }: {
  value: number; min: number; max: number;
  onChange: (n: number) => void;
  format?: (n: number) => string;
}) {
  return (
    <View style={stepStyles.row}>
      <TouchableOpacity
        style={[stepStyles.btn, value <= min && stepStyles.btnDisabled]}
        onPress={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
      >
        <Ionicons name="remove" size={18} color={value <= min ? 'rgba(255,255,255,0.2)' : colors.textPrimary} />
      </TouchableOpacity>
      <Text style={stepStyles.val}>{format ? format(value) : value}</Text>
      <TouchableOpacity
        style={[stepStyles.btn, value >= max && stepStyles.btnDisabled]}
        onPress={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
      >
        <Ionicons name="add" size={18} color={value >= max ? 'rgba(255,255,255,0.2)' : colors.textPrimary} />
      </TouchableOpacity>
    </View>
  );
}

const stepStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  btn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  btnDisabled: { backgroundColor: 'rgba(255,255,255,0.03)' },
  val: { fontSize: 17, fontFamily: 'Nunito_600SemiBold', color: colors.textPrimary, minWidth: 64, textAlign: 'center' },
});

// ─── Dialpad ───────────────────────────────────────────────────────────────────
const DIALPAD_KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

interface DialpadProps {
  onKey: (key: string) => void;
}

function Dialpad({ onKey }: DialpadProps) {
  return (
    <View style={dialStyles.grid}>
      {DIALPAD_KEYS.map((key, i) => (
        key === '' ? (
          <View key={i} style={dialStyles.keyEmpty} />
        ) : (
          <TouchableOpacity
            key={i}
            style={[dialStyles.key, key === '⌫' && dialStyles.keyBackspace]}
            onPress={() => onKey(key)}
            activeOpacity={0.6}
          >
            {key === '⌫' ? (
              <Ionicons name="backspace-outline" size={22} color={colors.textPrimary} />
            ) : (
              <Text style={dialStyles.keyText}>{key}</Text>
            )}
          </TouchableOpacity>
        )
      ))}
    </View>
  );
}

const dialStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', gap: 14, width: 240,
  },
  key: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  keyBackspace: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  keyEmpty: { width: 64, height: 64 },
  keyText: {
    fontSize: 24, fontFamily: 'Nunito_600SemiBold',
    color: colors.textPrimary,
  },
});

// ─── PIN dots ──────────────────────────────────────────────────────────────────
function PinDots({ length, filled, isError, isSuccess }: {
  length: number; filled: number; isError: boolean; isSuccess: boolean;
}) {
  const color = isError ? '#f87171' : isSuccess ? '#86efac' : colors.lightPurple;
  return (
    <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center' }}>
      {Array.from({ length }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 14, height: 14, borderRadius: 7,
            backgroundColor: i < filled ? color : 'rgba(255,255,255,0.15)',
            borderWidth: 1.5,
            borderColor: i < filled ? color : 'rgba(255,255,255,0.2)',
          }}
        />
      ))}
    </View>
  );
}

// ─── PinInput ─────────────────────────────────────────────────────────────────
// Two-phase: enter PIN then confirm it.

type PinPhase = 'enter' | 'confirm' | 'success';

interface PinInputProps {
  onSaved: (pin: string) => void;
  resetKey: number;
}

function PinInput({ onSaved, resetKey }: PinInputProps) {
  const [phase, setPhase]       = useState<PinPhase>('enter');
  const [digits, setDigits]     = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [isError, setIsError]   = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [msg, setMsg]           = useState('Enter a PIN (4–6 digits)');
  const [msgColor, setMsgColor] = useState(colors.textMuted);
  const shakeAnim               = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setPhase('enter');
    setDigits('');
    setFirstPin('');
    setIsError(false);
    setIsSuccess(false);
    setMsg('Enter a PIN (4–6 digits)');
    setMsgColor(colors.textMuted);
  }, [resetKey]);

  const shake = (message: string, afterCb: () => void) => {
    setIsError(true);
    setMsg(message);
    setMsgColor('#f87171');
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  -8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   0, duration: 55, useNativeDriver: true }),
    ]).start(() => {
      setIsError(false);
      afterCb();
    });
  };

  const handleKey = (key: string) => {
    if (isError || isSuccess) return;
    if (key === '⌫') {
      setDigits(d => d.slice(0, -1));
      return;
    }
    if (digits.length >= 6) return;
    setDigits(d => d + key);
  };

  const handleConfirmPress = () => {
    if (isError || isSuccess) return;
    if (phase === 'enter') {
      if (digits.length < 4) {
        shake('Enter at least 4 digits', () => {
          setDigits('');
          setMsg('Enter a PIN (4–6 digits)');
          setMsgColor(colors.textMuted);
        });
        return;
      }
      setFirstPin(digits);
      setDigits('');
      setPhase('confirm');
      setMsg('Confirm your PIN');
      setMsgColor(colors.textMuted);
    } else if (phase === 'confirm') {
      if (digits !== firstPin) {
        shake("PINs don't match, try again", () => {
          setDigits('');
          setFirstPin('');
          setPhase('enter');
          setMsg('Enter a PIN (4–6 digits)');
          setMsgColor(colors.textMuted);
        });
        return;
      }
      setIsSuccess(true);
      setMsg('PIN saved');
      setMsgColor('#86efac');
      setTimeout(() => onSaved(digits), 500);
    }
  };

  const pinLength = phase === 'confirm' ? firstPin.length : 6;
  const displayLength = phase === 'enter'
    ? Math.max(4, digits.length)  // grows from 4 to 6
    : firstPin.length;

  return (
    <View style={{ alignItems: 'center', gap: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {isSuccess && <SavedCheck size={16} />}
        <Text style={[pinStyles.msg, { color: msgColor }]}>{msg}</Text>
      </View>

      <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
        <PinDots
          length={displayLength}
          filled={digits.length}
          isError={isError}
          isSuccess={isSuccess}
        />
      </Animated.View>

      <Dialpad onKey={handleKey} />

      <TouchableOpacity
        style={[pinStyles.confirmBtn, digits.length < 4 && pinStyles.confirmBtnDim]}
        onPress={handleConfirmPress}
        activeOpacity={0.7}
      >
        <Text style={pinStyles.confirmText}>
          {phase === 'enter' ? 'Continue' : 'Confirm PIN'}
        </Text>
      </TouchableOpacity>

      {/* Step indicator */}
      <View style={pinStyles.stepRow}>
        <View style={[pinStyles.stepDot, pinStyles.stepDotDone]} />
        <View style={[pinStyles.stepDot, phase === 'confirm' && pinStyles.stepDotDone, phase === 'success' && pinStyles.stepDotDone]} />
      </View>
    </View>
  );
}

const pinStyles = StyleSheet.create({
  msg: { fontSize: 14, fontFamily: 'Nunito_600SemiBold', textAlign: 'center' },
  confirmBtn: {
    backgroundColor: colors.primaryPurple,
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40,
  },
  confirmBtnDim: { opacity: 0.4 },
  confirmText: { fontSize: 16, fontFamily: 'Nunito_600SemiBold', color: colors.textPrimary },
  stepRow:     { flexDirection: 'row', gap: 8 },
  stepDot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)' },
  stepDotDone: { backgroundColor: colors.lightPurple },
});

// ─── PinSetup card ─────────────────────────────────────────────────────────────
interface PinSetupProps {
  initialSaved: boolean;
  onSaved: () => void;
  onRemoved: () => void;
}

function PinSetup({ initialSaved, onSaved, onRemoved }: PinSetupProps) {
  const [saved, setSaved]     = useState(initialSaved);
  const [resetKey, setResetKey] = useState(0);

  const handleSaved = async (pin: string) => {
    await savePin(pin);
    setSaved(true);
    onSaved();
  };

  const handleRemove = async () => {
    await savePin(null);
    setSaved(false);
    setResetKey(k => k + 1);
    onRemoved();
  };

  if (saved) {
    return (
      <View style={[styles.infoCard, { marginTop: 0 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.lightPurple} />
          <Text style={styles.infoTitle}>PIN is set</Text>
        </View>
        <Text style={styles.infoBody}>
          You'll be asked to enter your PIN each time the app opens.
        </Text>
        <TouchableOpacity style={styles.removePinBtn} onPress={handleRemove}>
          <Text style={styles.removePinText}>Remove PIN lock</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.pinCard}>
      <PinInput onSaved={handleSaved} resetKey={resetKey} />
    </View>
  );
}

// ─── Main Settings screen ────────────────────────────────────────────────────────
export default function Settings({ onDataDeleted, onDreamsChange, onChecksChange, onReplayOnboarding }: { onDataDeleted?: () => void; onDreamsChange?: (dreams: Dream[]) => void; onChecksChange?: (checks: any[]) => void; onReplayOnboarding?: () => void }) {
  const [settings, setSettings] = useState<NotifSettings>(DEFAULT_NOTIF_SETTINGS);
  const insets = useSafeAreaInsets();
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  const [deleteInput, setDeleteInput] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinSaved, setPinSaved]     = useState(false);
  const [pinLoaded, setPinLoaded]   = useState(false);

  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [timePickerField, setTimePickerField] = useState<'start' | 'end' | 'morning' | 'evening' | null>(null);

  const [numberPickerVisible, setNumberPickerVisible] = useState(false);
  const [numberPickerField, setNumberPickerField] = useState<'buffer' | 'sleep' | 'duration' | null>(null);

  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [faqVisible, setFaqVisible] = useState(false);
  const [aboutVisible, setAboutVisible] = useState(false);
  const [whatsNewVisible, setWhatsNewVisible] = useState(false);
  const [debugGenerating, setDebugGenerating] = useState(false);
  const [alarmPermGranted, setAlarmPermGranted] = useState<boolean | null>(null);
  const [exactAlarmGranted, setExactAlarmGranted] = useState<boolean | null>(null);
  const [batteryOptGranted, setBatteryOptGranted] = useState<boolean | null>(null);

  // ── Permission checks ─────────────────────────────────────────────────────
  const checkPermissions = async () => {
    // 1. Notification permission (works on all platforms)
    const { status } = await Notifications.getPermissionsAsync();
    setAlarmPermGranted(status === 'granted');

    if (Platform.OS !== 'android') {
      setExactAlarmGranted(true);
      setBatteryOptGranted(true);
      return;
    }

    // 2. Exact alarm — try scheduling a test; if it throws CANNOT_SCHEDULE_EXACT the permission is missing
    try {
      const testId = await Notifications.scheduleNotificationAsync({
        content: { title: '_perm_probe_' },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(Date.now() + 60 * 60 * 1000), // 1hr from now
        },
      });
      // Succeeded — cancel immediately and mark granted
      await Notifications.cancelScheduledNotificationAsync(testId);
      setExactAlarmGranted(true);
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (msg.includes('CANNOT_SCHEDULE_EXACT') || msg.includes('exact')) {
        setExactAlarmGranted(false);
      } else {
        setExactAlarmGranted(true); // different error, not a permission issue
      }
    }

    // 3. Battery optimization — WBTBSettings native module if available
    const { WBTBSettings } = NativeModules;
    if (WBTBSettings?.isIgnoringBatteryOptimizations) {
      try {
        const ignoring: boolean = await WBTBSettings.isIgnoringBatteryOptimizations();
        setBatteryOptGranted(ignoring);
      } catch {
        setBatteryOptGranted(null);
      }
    } else {
      setBatteryOptGranted(null); // module not available — don't show false banner
    }
  };

  useEffect(() => {
    loadNotifSettings().then(setSettings);
    loadPin().then(p => {
      if (p) { setPinEnabled(true); setPinSaved(true); }
      setPinLoaded(true);
    });
    checkPermissions();

    // Re-check whenever user returns from system settings screen
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') checkPermissions();
    });
    return () => sub.remove();
  }, []);

  const update = (patch: Partial<NotifSettings>) => {
    setSaved(false);
    setSettings(prev => ({ ...prev, ...patch }));
  };

  const openTimePicker = (field: 'start' | 'end' | 'morning' | 'evening') => {
    setTimePickerField(field);
    setTimePickerVisible(true);
  };

  const openNumberPicker = (field: 'buffer' | 'sleep' | 'duration') => {
    setNumberPickerField(field);
    setNumberPickerVisible(true);
  };

  const handleTimePickerSave = (minutes: number) => {
    if (timePickerField === 'start') {
      update({ startMinutes: minutes });
    } else if (timePickerField === 'end') {
      update({ endMinutes: minutes });
    } else if (timePickerField === 'morning') {
      update({ streakReminderMorningMinutes: minutes });
    } else if (timePickerField === 'evening') {
      update({ streakReminderMinutes: minutes });
    }
    setTimePickerVisible(false);
    setTimePickerField(null);
  };

  const handleNumberPickerSave = (value: number) => {
    if (numberPickerField === 'buffer') {
      update({ wbtbBufferMinutes: value });
    } else if (numberPickerField === 'sleep') {
      update({ wbtbSleepHours: value });
    } else if (numberPickerField === 'duration') {
      update({ wbtbAlarmDuration: value });
    }
    setNumberPickerVisible(false);
    setNumberPickerField(null);
  };

  // Copy audio file to permanent storage and return path.
  const persistSoundFile = async (file: { uri: string; name: string }): Promise<string> => {
    const dest = FileSystem.documentDirectory + 'sounds/' + file.name;
    // Ensure sounds directory exists
    await FileSystem.makeDirectoryAsync(FileSystem.documentDirectory + 'sounds/', { intermediates: true });
    // file.uri is local cache copy, safe to copy from
    await FileSystem.copyAsync({ from: file.uri, to: dest });
    return dest;
  };

  const handlePickAlarmSound = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyTo: 'cachesDirectory',
      });
      if (result.canceled) {
        // Stay on default if no file yet
        if (!settings.wbtbAlarmSoundFile) {
          update({ wbtbAlarmSound: 'default' });
        }
        return;
      }
      const file = result.assets[0];
      const localPath = await persistSoundFile({ uri: file.uri, name: file.name });
      update({ wbtbAlarmSoundFile: localPath, wbtbAlarmSound: 'custom' });
    } catch (error) {
      Alert.alert('Error', 'Failed to pick sound file');
      if (!settings.wbtbAlarmSoundFile) {
        update({ wbtbAlarmSound: 'default' });
      }
    }
  };

  const handleSave = async () => {
    if (settings.endMinutes <= settings.startMinutes) {
      Alert.alert('Invalid window', 'End time must be after start time.');
      return;
    }
    setSaving(true);
    try {
      await setupNotificationChannel(settings);
      await saveNotifSettings(settings);
      // Persist WBTB alarm settings to native module
      await saveWBTBSettingsNative(
        settings.wbtbBufferMinutes,
        settings.wbtbSleepHours,
        settings.wbtbAlarmSound,
        settings.wbtbAlarmSoundFile,
        settings.wbtbAlarmSoundLoop,
        settings.wbtbAlarmDuration ?? 30
      );
      const granted = await requestNotifPermission();
      if (!granted) {
        setSaved(true);
        Alert.alert('Settings saved', 'Notification permission was denied. Enable notifications for Lucid in your device settings.');
        return;
      }
      try {
        await scheduleNotifications(settings);
        if (settings.streakReminderEnabled) {
          await scheduleStreakReminders(settings.streakReminderMorningMinutes, settings.streakReminderMinutes, settings.notificationSound);
        }
        setSaved(true);
      } catch {
        setSaved(true);
        Alert.alert('Settings saved', 'Scheduled notifications require a dev build, run "npx expo run:android" to activate them.');
      }
    } finally { setSaving(false); }
  };

  const handleAlarmSave = async () => {
    setSaving(true);
    try {
      await saveNotifSettings(settings);
      await saveWBTBSettingsNative(
        settings.wbtbBufferMinutes,
        settings.wbtbSleepHours,
        settings.wbtbAlarmSound,
        settings.wbtbAlarmSoundFile,
        settings.wbtbAlarmSoundLoop,
        settings.wbtbAlarmDuration ?? 30
      );
      setSaved(true);
    } catch {
      Alert.alert('Error', 'Failed to save alarm settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = async () => {
    const next = { ...settings, enabled: false };
    setSettings(next);
    await saveNotifSettings(next);
    await scheduleNotifications(next);
    setSaved(false);
  };

  const handlePinToggle = async (val: boolean) => {
    if (!val) {
      await savePin(null);
      setPinEnabled(false);
      setPinSaved(false);
    } else {
      setPinEnabled(true);
    }
  };

  const handleDeleteData = async () => {
    if (deleteInput !== 'DeleteInfo') {
      setDeleteError('Type exactly "DeleteInfo" to confirm.');
      return;
    }
    try {
      await AsyncStorage.clear();
      // Save default settings after clearing
      await saveNotifSettings(DEFAULT_NOTIF_SETTINGS);
      // Reset onboarding status
      await AsyncStorage.setItem('lucid_onboarding_done', 'false');
      // Reset local state to defaults
      setSettings(DEFAULT_NOTIF_SETTINGS);
      setSaved(false);
      setDeleteInput('');
      setDeleteError('');
      setPinEnabled(false);
      setPinSaved(false);
      // Notify parent to clear data
      onDataDeleted?.();
      onDreamsChange?.([]);
      onChecksChange?.([]);
      Alert.alert('Done', 'All data has been deleted.');
    } catch {
      Alert.alert('Error', 'Could not delete data. Please try again.');
    }
  };

  const [widgetModalVisible, setWidgetModalVisible] = useState(false);

  const handleAddWidget = () => {
    setWidgetModalVisible(true);
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <View style={styles.pageTitleRow}>
          <Text style={styles.pageTitle}>Settings</Text>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnLoading]}
            onPress={handleSave}
            disabled={saving}
          >
            {saved && !saving ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <SavedCheck size={14} />
                <Text style={styles.saveBtnText}>Saved</Text>
              </View>
            ) : (
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Reality Check Notifications ───────────────────────── */}
        <Text style={styles.sectionLabel}>REALITY CHECK NOTIFICATIONS</Text>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Enabled</Text>
            <Text style={styles.rowSub}>Receive random reality check reminders</Text>
          </View>
          <Switch
            value={settings.enabled}
            onValueChange={val => { update({ enabled: val }); if (!val) handleDisable(); }}
            trackColor={{ false: 'rgba(255,255,255,0.1)', true: colors.primaryPurple }}
            thumbColor={settings.enabled ? colors.lightPurple : 'rgba(255,255,255,0.4)'}
          />
        </View>

        {settings.enabled && (
          <>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Times per day</Text>
                <Text style={styles.rowSub}>How many checks throughout your active window</Text>
              </View>
              <Stepper value={settings.timesPerDay} min={3} max={15} onChange={val => update({ timesPerDay: val })} />
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Window start</Text>
                <Text style={styles.rowSub}>Earliest time a notification can fire</Text>
              </View>
              <TouchableOpacity onPress={() => openTimePicker('start')} style={styles.timeButton}>
                <Text style={styles.timeButtonText}>{formatTime(settings.startMinutes)}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Window end</Text>
                <Text style={styles.rowSub}>Latest time a notification can fire</Text>
              </View>
              <TouchableOpacity onPress={() => openTimePicker('end')} style={styles.timeButton}>
                <Text style={styles.timeButtonText}>{formatTime(settings.endMinutes)}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.summaryCard}>
              <Ionicons name="information-circle-outline" size={16} color={colors.lightPurple} />
              <Text style={styles.summaryText}>
                {settings.timesPerDay} check{settings.timesPerDay !== 1 ? 's' : ''} per day, randomly between{' '}
                {formatTime(settings.startMinutes)} and {formatTime(settings.endMinutes)}.
              </Text>
            </View>

          </>
        )}

        {/* ── Notification Sound ────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { marginTop: 8 }]}>NOTIFICATION SOUND</Text>
        {(
          [
            { value: 'app',     label: "App's sound",       sub: 'Custom sound included with Lucid' },
            { value: 'default', label: 'Phone default',     sub: "Your device's default notification sound" },
          ] as { value: 'default' | 'app'; label: string; sub: string }[]
        ).map(option => (
          <TouchableOpacity
            key={option.value}
            style={[styles.soundOption, settings.notificationSound === option.value && styles.soundOptionActive]}
            onPress={() => update({ notificationSound: option.value })}
            activeOpacity={0.7}
          >
            <View style={styles.soundOptionDot}>
              {settings.notificationSound === option.value && <View style={styles.soundOptionDotFill} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.soundOptionLabel}>{option.label}</Text>
              <Text style={styles.soundOptionSub}>{option.sub}</Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* ── Streak Reminders ──────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { marginTop: 36 }]}>STREAK REMINDERS</Text>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Daily log reminder</Text>
            <Text style={styles.rowSub}>Reminds you to log if you haven't yet</Text>
          </View>
          <Switch
            value={settings.streakReminderEnabled}
            onValueChange={val => update({ streakReminderEnabled: val })}
            trackColor={{ false: 'rgba(255,255,255,0.1)', true: colors.primaryPurple }}
            thumbColor={settings.streakReminderEnabled ? colors.lightPurple : 'rgba(255,255,255,0.4)'}
          />
        </View>

        {settings.streakReminderEnabled && (
          <>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Morning reminder</Text>
                <Text style={styles.rowSub}>Nudge to recall before the dream fades</Text>
              </View>
              <TouchableOpacity onPress={() => openTimePicker('morning')} style={styles.timeButton}>
                <Text style={styles.timeButtonText}>{formatTime(settings.streakReminderMorningMinutes)}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Evening reminder</Text>
                <Text style={styles.rowSub}>Nudge to log if you haven't yet</Text>
              </View>
              <TouchableOpacity onPress={() => openTimePicker('evening')} style={styles.timeButton}>
                <Text style={styles.timeButtonText}>{formatTime(settings.streakReminderMinutes)}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

          </>
        )}

        {/* ── Wake Back To Bed Alarm ──────────────────────────────────── */}
        <View style={styles.sectionLabelRow}>
          <Text style={[styles.sectionLabel, { marginTop: 36 }]}>WAKE BACK TO BED ALARM</Text>
          <TouchableOpacity
            style={[styles.saveBtnSmall, saving && styles.saveBtnLoading]}
            onPress={handleAlarmSave}
            disabled={saving}
          >
            {saved && !saving ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <SavedCheck size={13} />
                <Text style={styles.saveBtnText}>Saved</Text>
              </View>
            ) : (
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
            )}
          </TouchableOpacity>
        </View>

        {alarmPermGranted === false && (
          <View style={styles.permBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.permBannerTitle}>Notifications blocked</Text>
              <Text style={styles.permBannerSub}>Required for WBTB alarm and reality check reminders.</Text>
            </View>
            <TouchableOpacity
              style={styles.permGrantBtn}
              onPress={async () => {
                const { status } = await Notifications.requestPermissionsAsync();
                if (status === 'granted') {
                  setAlarmPermGranted(true);
                } else {
                  // Already denied once — send to system settings
                  Linking.openSettings();
                }
              }}
            >
              <Text style={styles.permGrantText}>Grant</Text>
            </TouchableOpacity>
          </View>
        )}

        {exactAlarmGranted === false && (
          <View style={styles.permBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.permBannerTitle}>Exact alarm permission needed</Text>
              <Text style={styles.permBannerSub}>Android 12+ requires permission to schedule precise alarms. Tap to open settings.</Text>
            </View>
            <TouchableOpacity
              style={styles.permGrantBtn}
              onPress={() => {
                Linking.sendIntent('android.settings.REQUEST_SCHEDULE_EXACT_ALARM').catch(() =>
                  Linking.openSettings()
                );
              }}
            >
              <Text style={styles.permGrantText}>Open</Text>
            </TouchableOpacity>
          </View>
        )}

        {batteryOptGranted === false && (
          <View style={styles.permBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.permBannerTitle}>Battery optimisation active</Text>
              <Text style={styles.permBannerSub}>Android may kill the alarm. Tap to exempt Lucid from battery restrictions.</Text>
            </View>
            <TouchableOpacity
              style={styles.permGrantBtn}
              onPress={() => {
                Linking.sendIntent(
                  'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
                  [{ key: 'package', value: 'com.yourname.lucid' }]
                ).catch(() =>
                  Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS').catch(() =>
                    Linking.openSettings()
                  )
                );
              }}
            >
              <Text style={styles.permGrantText}>Fix</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={(alarmPermGranted === false || exactAlarmGranted === false || batteryOptGranted === false) ? { opacity: 0.38, pointerEvents: 'none' } : undefined}>

        <View style={styles.infoCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Ionicons name="moon-outline" size={16} color={colors.lightPurple} />
            <Text style={styles.infoTitle}>Home screen widget</Text>
          </View>
          <Text style={styles.infoBody}>
            Add the Lucid widget to your Android home screen. Tap Arm before sleep, the alarm fires after your buffer time plus sleep timer.
          </Text>
          <TouchableOpacity
            style={styles.widgetButton}
            onPress={handleAddWidget}
          >
            <Text style={styles.widgetButtonText}>How to add widget</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Buffer time</Text>
            <Text style={styles.rowSub}>Minutes to fall asleep before timer starts</Text>
          </View>
          <TouchableOpacity onPress={() => openNumberPicker('buffer')} style={styles.timeButton}>
            <Text style={styles.timeButtonText}>{settings.wbtbBufferMinutes}m</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Sleep timer</Text>
            <Text style={styles.rowSub}>Hours of sleep before alarm fires</Text>
          </View>
          <TouchableOpacity onPress={() => openNumberPicker('sleep')} style={styles.timeButton}>
            <Text style={styles.timeButtonText}>{settings.wbtbSleepHours}h</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Alarm duration</Text>
            <Text style={styles.rowSub}>How long the alarm rings before stopping</Text>
          </View>
          <TouchableOpacity onPress={() => openNumberPicker('duration')} style={styles.timeButton}>
            <Text style={styles.timeButtonText}>{settings.wbtbAlarmDuration ?? 45}s</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.summaryCard}>
          <Ionicons name="alarm-outline" size={16} color={colors.lightPurple} />
          <Text style={styles.summaryText}>
            Alarm fires {settings.wbtbBufferMinutes} minutes + {settings.wbtbSleepHours} hours after arming ({settings.wbtbBufferMinutes + settings.wbtbSleepHours * 60} minutes total).
          </Text>
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 8 }]}>ALARM SOUND</Text>
        {(
          [
            { value: 'default',    label: 'Default alarm',   sub: 'Your device\'s default alarm sound' },
            { value: 'custom',     label: 'Custom file',     sub: settings.wbtbAlarmSoundFile ? settings.wbtbAlarmSoundFile.split('/').pop() || 'Import from device storage' : 'Import from device storage' },
          ] as { value: 'custom' | 'default'; label: string; sub: string }[]
        ).map(option => (
          <TouchableOpacity
            key={option.value}
            style={[styles.soundOption, settings.wbtbAlarmSound === option.value && styles.soundOptionActive]}
            onPress={async () => {
              if (option.value === 'custom' && !settings.wbtbAlarmSoundFile) {
                // Jump straight to file picker; only switch to custom if a file is actually chosen
                await handlePickAlarmSound();
              } else {
                update({ wbtbAlarmSound: option.value });
              }
            }}
            activeOpacity={0.7}
          >
            <View style={styles.soundOptionDot}>
              {settings.wbtbAlarmSound === option.value && <View style={styles.soundOptionDotFill} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.soundOptionLabel}>{option.label}</Text>
              <Text style={styles.soundOptionSub}>{option.sub}</Text>
            </View>
          </TouchableOpacity>
        ))}

        {settings.wbtbAlarmSound === 'custom' && (
          <TouchableOpacity
            style={styles.importButton}
            onPress={handlePickAlarmSound}
          >
            <Ionicons name="folder-open-outline" size={18} color={colors.lightPurple} />
            <Text style={styles.importButtonText} numberOfLines={1} ellipsizeMode="middle">
              {settings.wbtbAlarmSoundFile ? settings.wbtbAlarmSoundFile.split('/').pop() || 'Change file' : 'Import sound file'}
            </Text>
          </TouchableOpacity>
        )}

        </View>{/* end WBTB gray-out wrapper */}

        {/* ── App lock ──────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { marginTop: 36 }]}>APP LOCK</Text>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Require PIN on open</Text>
            <Text style={styles.rowSub}>Enter a PIN to unlock the app</Text>
          </View>
          <Switch
            value={pinEnabled}
            onValueChange={handlePinToggle}
            trackColor={{ false: 'rgba(255,255,255,0.1)', true: colors.primaryPurple }}
            thumbColor={pinEnabled ? colors.lightPurple : 'rgba(255,255,255,0.4)'}
          />
        </View>

        {pinEnabled && pinLoaded && (
          <PinSetup
            initialSaved={pinSaved}
            onSaved={() => setPinSaved(true)}
            onRemoved={() => { setPinEnabled(false); setPinSaved(false); }}
          />
        )}

        {/* ── About / FAQ / Privacy ─────────────────────────────── */}
        <Text style={[styles.sectionLabel, { marginTop: 36 }]}>ABOUT</Text>

        {([
          { label: 'About Lucid', sub: 'Version, credits, and info', icon: 'information-circle-outline', onPress: () => setAboutVisible(true) },
          { label: "What's New", sub: 'Changelog and release notes', icon: 'sparkles-outline', onPress: () => setWhatsNewVisible(true) },
          { label: 'FAQ', sub: 'Common questions answered', icon: 'help-circle-outline', onPress: () => setFaqVisible(true) },
          { label: 'Privacy', sub: 'How your data is handled', icon: 'shield-checkmark-outline', onPress: () => setPrivacyVisible(true) },
          { label: 'Replay introduction', sub: 'See the intro screens again', icon: 'play-circle-outline', onPress: () => onReplayOnboarding?.() },
        ] as { label: string; sub: string; icon: string; onPress: () => void }[]).map((item, i) => (
          <TouchableOpacity key={i} style={styles.row} onPress={item.onPress} activeOpacity={0.7}>
            <Ionicons name={item.icon as any} size={20} color={colors.lightPurple} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item.label}</Text>
              <Text style={styles.rowSub}>{item.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ))}

        {/* ── Delete all data ───────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { marginTop: 36 }]}>DATA</Text>

        <View style={styles.infoCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Ionicons name="download-outline" size={16} color={colors.lightPurple} />
            <Text style={styles.infoTitle}>Export data</Text>
          </View>
          <Text style={styles.infoBody}>
            Exports your journal and notification settings. Does not include your PIN or custom sound files.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, { marginTop: 10 }]}
          onPress={async () => {
            try {
              await exportData();
            } catch (e) {
              Alert.alert('Export failed', 'Failed to export data. Please try again.');
            }
          }}
        >
          <Text style={styles.saveBtnText}>Export data</Text>
        </TouchableOpacity>

        <View style={[styles.infoCard, { marginTop: 20 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Ionicons name="cloud-upload-outline" size={16} color={colors.lightPurple} />
            <Text style={styles.infoTitle}>Import data</Text>
          </View>
          <Text style={styles.infoBody}>
            Replaces your journal and notification settings from an export file. Does not affect your PIN or custom sound files.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, { marginTop: 10 }]}
          onPress={async () => {
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
              });
              if (result.canceled) return;
              const file = result.assets[0];
              const content = await FileSystem.readAsStringAsync(file.uri);
              const data = JSON.parse(content);

              // Import dreams
              if (data.dreams && Array.isArray(data.dreams)) {
                await saveDreams(data.dreams);
              }

              // Import reality checks, always overwrite, even if absent in the file (treat missing as empty)
              const incomingChecks = Array.isArray(data.realityChecks) ? data.realityChecks : [];
              await saveChecks(incomingChecks);
              onChecksChange?.(incomingChecks);

              // Import notification settings (excluding sound files)
              if (data.notificationSettings) {
                const currentSettings = await loadNotifSettings();
                const mergedSettings = {
                  ...currentSettings,
                  ...data.notificationSettings,
                  // Preserve current sound files
                  wbtbAlarmSoundFile: currentSettings.wbtbAlarmSoundFile,
                  notificationSoundFile: (currentSettings as any).notificationSoundFile,
                };
                await saveNotifSettings(mergedSettings);
              }

              const updatedDreams = await loadDreams();
              onDreamsChange?.(updatedDreams);
              Alert.alert('Import successful', 'Your data has been imported.');
              await loadNotifSettings().then(setSettings);
            } catch (e) {
              Alert.alert('Import failed', 'Failed to import data. Please check the file format.');
            }
          }}
        >
          <Text style={styles.saveBtnText}>Import data</Text>
        </TouchableOpacity>

        {/* ── Debug: generate sample data ──────────────────────── */}
        {__DEV__ && (
          <View style={[styles.deleteCard, { marginTop: 20, borderColor: 'rgba(251,191,36,0.25)', backgroundColor: 'rgba(251,191,36,0.05)' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Ionicons name="flask-outline" size={16} color="#fbbf24" />
              <Text style={[styles.deleteTitle, { color: '#fbbf24' }]}>Debug: generate sample data</Text>
            </View>
            <Text style={styles.deleteBody}>
              Fills 60 days of realistic dreams, reality checks, and a 14-day streak. Replaces all existing data. For screenshots and testing only.
            </Text>
            <TouchableOpacity
              style={[styles.deleteBtn, { backgroundColor: 'rgba(251,191,36,0.15)', borderColor: 'rgba(251,191,36,0.4)', marginTop: 12 }, debugGenerating && styles.deleteBtnDisabled]}
              disabled={debugGenerating}
              onPress={async () => {
                Alert.alert(
                  'Generate debug data?',
                  'This replaces all existing dreams and reality checks with sample data.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Generate',
                      style: 'destructive',
                      onPress: async () => {
                        setDebugGenerating(true);
                        try {
                          const { dreams, checks } = await generateDebugData({ days: 60, loggingRate: 0.8, includeLucid: true, includeWbtb: true });
                          onDreamsChange?.(dreams);
                          onChecksChange?.(checks);
                          Alert.alert('Done', `Generated ${dreams.length} dreams and ${checks.length} reality checks.`);
                        } catch (e) {
                          Alert.alert('Error', 'Failed to generate debug data.');
                        } finally {
                          setDebugGenerating(false);
                        }
                      },
                    },
                  ]
                );
              }}
            >
              <Text style={[styles.deleteBtnText, { color: '#fbbf24' }]}>
                {debugGenerating ? 'Generating...' : 'Generate sample data'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.deleteCard, { marginTop: 20 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Ionicons name="warning-outline" size={16} color="#f87171" />
            <Text style={styles.deleteTitle}>Delete all data</Text>
          </View>
          <Text style={styles.deleteBody}>
            Permanently removes all dreams, settings, and your PIN. Type{' '}
            <Text style={styles.deleteCode}>DeleteInfo</Text> to confirm.
          </Text>
          <TextInput
            style={[styles.deleteInput, deleteError ? styles.deleteInputError : null]}
            value={deleteInput}
            onChangeText={t => { setDeleteInput(t); setDeleteError(''); }}
            placeholder="Type DeleteInfo"
            placeholderTextColor="rgba(255,255,255,0.2)"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {deleteError ? <Text style={styles.deleteErrorText}>{deleteError}</Text> : null}
          <TouchableOpacity
            style={[styles.deleteBtn, deleteInput !== 'DeleteInfo' && styles.deleteBtnDisabled]}
            onPress={handleDeleteData}
            disabled={deleteInput !== 'DeleteInfo'}
          >
            <Text style={styles.deleteBtnText}>Delete everything</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* ── Privacy Modal ── */}
      <Modal visible={privacyVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPrivacyVisible(false)}>
        <View style={styles.infoModalRoot}>
          <View style={[styles.infoModalHeader, { paddingTop: Math.max(insets.top, 20) }]}>
            <Text style={styles.infoModalTitle}>Privacy</Text>
            <TouchableOpacity onPress={() => setPrivacyVisible(false)} style={styles.infoModalClose}>
              <Text style={styles.infoModalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.infoModalContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.infoModalHeading}>Your data stays on your device</Text>
            <Text style={styles.infoModalBody}>Lucid stores everything locally using your device's secure storage. Your dream journal, settings, and PIN never leave your device unless you explicitly export them.</Text>
            <Text style={styles.infoModalHeading}>No accounts required</Text>
            <Text style={styles.infoModalBody}>There are no user accounts, no sign-ins, and no servers. Lucid works entirely offline.</Text>
            <Text style={styles.infoModalHeading}>Exports are opt-in</Text>
            <Text style={styles.infoModalBody}>When you use Export Data, a JSON file is generated locally and shared only through your device's share sheet. Lucid never uploads anything automatically.</Text>
            <Text style={styles.infoModalHeading}>Notifications</Text>
            <Text style={styles.infoModalBody}>Reality check and streak reminder notifications are scheduled locally on your device. No notification content is sent to or stored on any server.</Text>
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* ── FAQ Modal ── */}
      <Modal visible={faqVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFaqVisible(false)}>
        <View style={styles.infoModalRoot}>
          <View style={[styles.infoModalHeader, { paddingTop: Math.max(insets.top, 20) }]}>
            <Text style={styles.infoModalTitle}>FAQ</Text>
            <TouchableOpacity onPress={() => setFaqVisible(false)} style={styles.infoModalClose}>
              <Text style={styles.infoModalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.infoModalContent} showsVerticalScrollIndicator={false}>
            {([
              { q: 'What is a reality check?', a: 'A reality check is a habit you practice while awake to question whether you\'re dreaming. Over time, this habit carries into your dreams, and when you perform a check in a dream, you can become aware that you\'re dreaming.' },
              { q: 'How many reality checks should I do per day?', a: 'Most people see good results with 5–10 per day. The key is to do them with genuine attention, really ask yourself if you could be dreaming, rather than going through the motions.' },
              { q: 'What is WBTB?', a: 'Wake Back To Bed is a technique where you set an alarm to wake yourself after 4–6 hours of sleep, stay awake briefly, then go back to sleep. This takes advantage of your REM-rich late sleep cycles and dramatically increases the chance of lucid dreaming.' },
              { q: 'Why should I log dreams I don\'t remember?', a: 'Logging a "no memory" entry still counts toward your streak and tells you something about your sleep patterns. Consistency matters more than content.' },
              { q: 'How does the streak work?', a: 'Your streak counts how many consecutive days you\'ve opened the app and logged something, whether that\'s a full dream or a "no memory" entry. Missing a day resets it to zero.' },
              { q: 'Why do my notifications stop after a week?', a: 'Lucid schedules 7 days of notifications at a time. They refresh automatically when you save your settings. If they stop, just open Settings and tap Save.' },
              { q: 'Can I use Lucid without notifications?', a: 'Yes. Notifications are optional. The journal, analytics, and reality check tracker all work without them.' },
              { q: 'Is my journal backed up?', a: 'Not automatically. Use Export Data to save a backup to your device or share it elsewhere. Deleting the app will delete all local data.' },
              { q: 'What counts as a lucid dream?', a: 'A lucid dream is any dream where you become aware that you\'re dreaming while it\'s happening. You don\'t need to be in control, awareness alone is what defines lucidity. Even a brief moment of realising "this is a dream" counts.' },
              { q: 'Why don\'t I see any analytics yet?', a: 'Analytics appear once you have at least a few days of logged entries. The more you log, the more patterns Lucid can surface. Keep going, the data builds quickly.' },
              { q: 'Where do I find the WBTB feature?', a: 'WBTB is accessed through the home screen widget. Add the Lucid widget to your home screen from Settings, then tap ARM to set a wake-back-to-bed alarm. The alarm fires after your buffer time plus sleep timer.' },
              { q: 'How much data do insights need before they appear?', a: 'Most insights require at least 7 entries to be meaningful. Correlation-based insights (like WBTB effectiveness) need more, around 14 days, so there\'s enough data to detect a real pattern rather than noise.' },
              { q: 'Can reality checks guarantee lucid dreams?', a: 'No technique can guarantee lucid dreams. Reality checks are a tool that trains your mind to question reality, the more consistent and mindful your practice, the more likely that habit will carry into your dreams. Results vary between people.' },
              { q: 'What does vividness mean?', a: 'Vividness is a 1–5 self-rating of how clear, detailed, and sensory-rich a dream felt. A 1 is a hazy impression; a 5 is fully immersive. It\'s subjective, rate based on how the dream felt to you.' },
              { q: 'What happens if I miss a day?', a: 'Your streak resets to zero. That\'s okay, streaks are a motivational tool, not a measure of your progress as a dreamer. Your logged entries and insights remain intact. Just start again.' },
              { q: 'Why are some insights marked as correlations?', a: 'A correlation means two things tend to happen together in your data, for example, WBTB nights and higher vividness scores. It doesn\'t mean one causes the other. Lucid labels these clearly so you can draw your own conclusions.' },
              { q: 'Does Lucid collect any data?', a: 'No. Lucid has no internet connection, no analytics, and no servers. Everything, your dreams, settings, and PIN, stays on your device. Nothing is collected, transmitted, or stored anywhere else.' },
              { q: 'Why won\'t my settings stick after closing the app?', a: 'Settings are saved when you tap the Save button, changes you make to the sliders and toggles are held in memory until then. If the app is closed before saving, unsaved changes are lost. Make sure to tap Save before leaving the Settings screen.' },
            ] as { q: string; a: string }[]).map((item, i) => (
              <View key={i} style={styles.faqItem}>
                <Text style={styles.faqQ}>{item.q}</Text>
                <Text style={styles.faqA}>{item.a}</Text>
              </View>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* ── About Modal ── */}
      <Modal visible={aboutVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAboutVisible(false)}>
        <View style={styles.infoModalRoot}>
          <View style={[styles.infoModalHeader, { paddingTop: Math.max(insets.top, 20) }]}>
            <Text style={styles.infoModalTitle}>About Lucid</Text>
            <TouchableOpacity onPress={() => setAboutVisible(false)} style={styles.infoModalClose}>
              <Text style={styles.infoModalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.infoModalContent} showsVerticalScrollIndicator={false}>
            <Text style={[styles.infoModalHeading, { fontSize: 28, marginBottom: 4 }]}>Lucid</Text>
            <Text style={[styles.infoModalBody, { marginBottom: 24 }]}>Version 1.0.0</Text>
            <Text style={styles.infoModalBody}>Lucid is a dream journal and lucid dreaming practice app. It helps you build the habits, consistent logging, daily reality checks, and WBTB, that make lucid dreams more likely.</Text>
            <Text style={styles.infoModalHeading}>What it does</Text>
            <Text style={styles.infoModalBody}>Tracks your dreams, streak, and reality checks. Sends randomised reality check reminders. Analyses your patterns to show what actually helps your recall. Arms a WBTB alarm from your home screen widget.</Text>
            <Text style={styles.infoModalHeading}>Built with</Text>
            <Text style={styles.infoModalBody}>React Native · Expo · Skia · AsyncStorage</Text>

            <Text style={styles.infoModalHeading}>Links</Text>
            {([
              { icon: 'logo-github',         label: 'GitHub',         sub: 'Source code and releases',      url: 'https://github.com/oneironautdev/Lucid' },
              { icon: 'globe-outline',        label: 'Website',        sub: 'Project homepage',              url: 'https://oneironautdev.github.io/Lucid/' },
              { icon: 'cafe-outline',         label: 'Buy Me a Coffee', sub: 'Support development',          url: 'https://buymeacoffee.com/oneironautdev' },
              { icon: 'mail-outline',         label: 'Contact',        sub: 'Get in touch',                  url: 'mailto:lucidapp.contact@gmail.com' },
            ] as { icon: string; label: string; sub: string; url: string }[]).map((link, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.row, { marginBottom: 8 }]}
                onPress={() => { if (link.url) Linking.openURL(link.url); }}
                activeOpacity={link.url ? 0.7 : 1}
              >
                <Ionicons name={link.icon as any} size={20} color={colors.lightPurple} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{link.label}</Text>
                  <Text style={styles.rowSub}>{link.sub}</Text>
                </View>
                {link.url ? <Ionicons name="open-outline" size={16} color={colors.textMuted} /> : <Ionicons name="link-outline" size={16} color="rgba(255,255,255,0.12)" />}
              </TouchableOpacity>
            ))}

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* ── What's New Modal ── */}
      <Modal visible={whatsNewVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setWhatsNewVisible(false)}>
        <View style={styles.infoModalRoot}>
          <View style={[styles.infoModalHeader, { paddingTop: Math.max(insets.top, 20) }]}>
            <Text style={styles.infoModalTitle}>What's New</Text>
            <TouchableOpacity onPress={() => setWhatsNewVisible(false)} style={styles.infoModalClose}>
              <Text style={styles.infoModalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.infoModalContent} showsVerticalScrollIndicator={false}>
            {([
              {
                version: '1.0.0',
                label: 'The first public release. Dream journal, reality checks, WBTB widget, analytics, and everything in between.',
                date: 'June 2026',
                patches: [],
              },
            ] as { version: string; label: string; date: string; patches: string[] }[]).map((release, i) => (
              <View key={i} style={{ marginBottom: 24 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <View style={{
                    backgroundColor: 'rgba(167,139,250,0.15)',
                    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
                  }}>
                    <Text style={{ fontSize: 12, fontFamily: 'Nunito_700Bold', color: colors.lightPurple }}>
                      v{release.version}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, fontFamily: 'Nunito_400Regular', color: colors.textMuted }}>
                    {release.date}
                  </Text>
                </View>
                <Text style={[styles.infoModalBody, { marginBottom: release.patches.length > 0 ? 8 : 0 }]}>
                  {release.label}
                </Text>
                {release.patches.map((patch, j) => (
                  <View key={j} style={{ flexDirection: 'row', gap: 8, marginBottom: 4, paddingLeft: 4 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 13, fontFamily: 'Nunito_400Regular' }}>•</Text>
                    <Text style={{ flex: 1, fontSize: 13, fontFamily: 'Nunito_400Regular', color: 'rgba(255,255,255,0.65)', lineHeight: 20 }}>{patch}</Text>
                  </View>
                ))}
              </View>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      <TimePickerModal
        visible={timePickerVisible}
        initialMinutes={
          timePickerField === 'start' ? settings.startMinutes :
          timePickerField === 'end' ? settings.endMinutes :
          timePickerField === 'morning' ? settings.streakReminderMorningMinutes :
          timePickerField === 'evening' ? settings.streakReminderMinutes :
          0
        }
        onSave={handleTimePickerSave}
        onClose={() => { setTimePickerVisible(false); setTimePickerField(null); }}
      />

      <Modal visible={widgetModalVisible} transparent animationType="fade">
        <View style={widgetStyles.overlay}>
          <View style={widgetStyles.card}>
            <Text style={widgetStyles.title}>Add Widget</Text>
            <Text style={widgetStyles.step}>
              <Text style={widgetStyles.stepNumber}>1.</Text> Long-press on an empty space on your home screen
            </Text>
            <Text style={widgetStyles.step}>
              <Text style={widgetStyles.stepNumber}>2.</Text> Tap "Widgets"
            </Text>
            <Text style={widgetStyles.step}>
              <Text style={widgetStyles.stepNumber}>3.</Text> Find and tap and hold "Lucid"
            </Text>
            <Text style={widgetStyles.step}>
              <Text style={widgetStyles.stepNumber}>4.</Text> Place it anywhere convenient on your screen
            </Text>
            <TouchableOpacity style={widgetStyles.saveBtn} onPress={() => setWidgetModalVisible(false)}>
              <Text style={widgetStyles.saveText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <NumberPickerModal
        visible={numberPickerVisible}
        initialValue={
          numberPickerField === 'buffer' ? settings.wbtbBufferMinutes :
          numberPickerField === 'sleep' ? settings.wbtbSleepHours :
          numberPickerField === 'duration' ? (settings.wbtbAlarmDuration ?? 45) :
          0
        }
        min={numberPickerField === 'buffer' ? 1 : numberPickerField === 'duration' ? 15 : 0}
        max={numberPickerField === 'buffer' ? 60 : numberPickerField === 'duration' ? 45 : 8}
        unit={numberPickerField === 'buffer' ? 'm' : numberPickerField === 'duration' ? 's' : 'h'}
        onSave={handleNumberPickerSave}
        onClose={() => { setNumberPickerVisible(false); setNumberPickerField(null); }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:          { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 120 },

  pageTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
  pageTitle:    { fontSize: 28, fontWeight: '700', fontFamily: 'Nunito_800ExtraBold', color: colors.textPrimary },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 36 },
  saveBtnSmall: { backgroundColor: colors.primaryPurple, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  sectionLabel: { fontSize: 11, color: colors.textMuted, letterSpacing: 1, fontFamily: 'Nunito_600SemiBold', marginBottom: 16 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, padding: 16, marginBottom: 10, gap: 12,
  },
  rowTitle: { fontSize: 15, fontFamily: 'Nunito_600SemiBold', color: colors.textPrimary, marginBottom: 2 },
  rowSub:   { fontSize: 12, fontFamily: 'Nunito_300Light', color: colors.textMuted },
  timeButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
  },
  timeButtonText: { fontSize: 15, fontFamily: 'Nunito_600SemiBold', color: colors.lightPurple },

  summaryCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(167,139,250,0.08)',
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.2)',
    borderRadius: 10, padding: 14, marginBottom: 20,
  },
  summaryText: { flex: 1, fontSize: 13, fontFamily: 'Nunito_300Light', color: colors.lightPurple, lineHeight: 18 },

  saveBtn:        { backgroundColor: colors.primaryPurple, borderRadius: 12, padding: 16, alignItems: 'center' },
  saveBtnLoading: { backgroundColor: 'rgba(91,79,212,0.4)' },
  saveBtnText:    { fontSize: 16, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', color: colors.textPrimary },

  infoCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, padding: 18, gap: 10, marginBottom: 10,
  },
  infoTitle: { fontSize: 15, fontFamily: 'Nunito_600SemiBold', color: colors.textPrimary },
  infoBody:  { fontSize: 13, fontFamily: 'Nunito_300Light', color: colors.textMuted, lineHeight: 18 },
  pathBox: {
    backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 8,
    padding: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  pathText: { fontSize: 12, fontFamily: 'Nunito_300Light', color: colors.lightPurple },
  infoCode: { fontFamily: 'Nunito_600SemiBold', color: colors.lightPurple },

  pinCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, padding: 24, alignItems: 'center',
    marginBottom: 10,
  },

  removePinBtn:  { marginTop: 4, paddingVertical: 8 },
  removePinText: { fontSize: 13, fontFamily: 'Nunito_600SemiBold', color: '#f87171' },

  soundOption: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, padding: 16, marginBottom: 8,
  },
  soundOptionActive: {
    borderColor: 'rgba(167,139,250,0.5)',
    backgroundColor: 'rgba(167,139,250,0.08)',
  },
  soundOptionDot: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },
  soundOptionDotFill: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.lightPurple,
  },
  soundOptionLabel: { fontSize: 15, fontFamily: 'Nunito_600SemiBold', color: colors.textPrimary, marginBottom: 2 },
  soundOptionSub: { fontSize: 12, fontFamily: 'Nunito_300Light', color: colors.textMuted },

  importButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(167,139,250,0.08)',
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.3)',
    borderRadius: 10, padding: 12, marginTop: 8,
  },
  importButtonText: { fontSize: 14, fontFamily: 'Nunito_600SemiBold', color: colors.lightPurple },

  widgetButton: {
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.4)',
    borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 12,
  },
  widgetButtonText: { fontSize: 14, fontFamily: 'Nunito_600SemiBold', color: colors.lightPurple },

  deleteCard: {
    backgroundColor: 'rgba(248,113,113,0.06)',
    borderWidth: 0.5, borderColor: 'rgba(248,113,113,0.2)',
    borderRadius: 14, padding: 18, gap: 12,
  },
  deleteTitle: { fontSize: 15, fontFamily: 'Nunito_600SemiBold', color: '#f87171' },
  deleteBody:  { fontSize: 13, fontFamily: 'Nunito_300Light', color: colors.textMuted, lineHeight: 18 },
  deleteCode:  { fontFamily: 'Nunito_600SemiBold', color: '#f87171' },
  deleteInput: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 0.5, borderColor: 'rgba(248,113,113,0.3)',
    borderRadius: 10, padding: 12,
    fontSize: 15, fontFamily: 'Nunito_600SemiBold', color: colors.textPrimary,
  },
  deleteInputError: { borderColor: '#f87171' },
  deleteErrorText:  { fontSize: 12, fontFamily: 'Nunito_300Light', color: '#f87171', marginTop: -4 },
  deleteBtn: {
    backgroundColor: 'rgba(248,113,113,0.2)',
    borderWidth: 0.5, borderColor: '#f87171',
    borderRadius: 10, padding: 14, alignItems: 'center',
  },
  deleteBtnDisabled: { opacity: 0.35 },
  deleteBtnText: { fontSize: 15, fontFamily: 'Nunito_600SemiBold', color: '#f87171' },

  // Info modals (Privacy / FAQ / About)
  permBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderWidth: 0.5, borderColor: 'rgba(251,191,36,0.35)',
    borderRadius: 12, padding: 14, marginBottom: 12, marginTop: 8,
  },
  permBannerTitle: { fontSize: 13, fontFamily: 'Nunito_600SemiBold', color: '#fbbf24', marginBottom: 2 },
  permBannerSub:   { fontSize: 11, fontFamily: 'Nunito_300Light', color: 'rgba(255,255,255,0.5)', lineHeight: 16 },
  permGrantBtn: {
    backgroundColor: 'rgba(251,191,36,0.15)', borderWidth: 0.5, borderColor: 'rgba(251,191,36,0.5)',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7,
  },
  permGrantText: { fontSize: 13, fontFamily: 'Nunito_600SemiBold', color: '#fbbf24' },
  infoModalRoot:      { flex: 1, backgroundColor: '#0d0b1e' },
  infoModalHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.08)' },
  infoModalTitle:     { fontSize: 20, fontFamily: 'Nunito_800ExtraBold', color: colors.textPrimary },
  infoModalClose:     { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: 'rgba(167,139,250,0.12)', borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.25)' },
  infoModalCloseText: { fontSize: 13, fontFamily: 'Nunito_600SemiBold', color: colors.lightPurple },
  infoModalContent:   { paddingHorizontal: 20, paddingTop: 20 },
  infoModalHeading:   { fontSize: 16, fontFamily: 'Nunito_800ExtraBold', color: colors.textPrimary, marginTop: 20, marginBottom: 6 },
  infoModalBody:      { fontSize: 14, fontFamily: 'Nunito_300Light', color: colors.textMuted, lineHeight: 22 },
  faqItem:            { paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.07)' },
  faqQ:               { fontSize: 15, fontFamily: 'Nunito_600SemiBold', color: colors.textPrimary, marginBottom: 4 },
  faqA:               { fontSize: 14, fontFamily: 'Nunito_300Light', color: colors.textMuted, lineHeight: 20 },
});

const widgetStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#1a1730', borderRadius: 20,
    padding: 24, width: '100%', maxWidth: 320,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)',
  },
  title: {
    fontSize: 28, fontFamily: 'Nunito_800ExtraBold',
    color: colors.lightPurple, textAlign: 'center', marginBottom: 20,
  },
  step: {
    fontSize: 15, fontFamily: 'Nunito_600SemiBold',
    color: colors.textPrimary, lineHeight: 22, marginBottom: 12,
  },
  stepNumber: {
    fontFamily: 'Nunito_700Bold', color: colors.lightPurple,
  },
  saveBtn: {
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.4)',
    borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8,
  },
  saveText: { fontSize: 16, fontFamily: 'Nunito_600SemiBold', color: colors.lightPurple },
});