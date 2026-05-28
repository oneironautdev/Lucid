import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { colors } from '../constants/colors';
import {
  DEFAULT_NOTIF_SETTINGS,
  loadNotifSettings,
  NotifSettings,
  requestNotifPermission,
  saveNotifSettings,
  scheduleNotifications, scheduleStreakReminders,
  setupNotificationChannel,
} from '../utils/notifications';
import { Dream, exportData, loadDreams, saveDreams } from '../utils/storage';
import { saveWBTBSettingsNative } from '../utils/wbtbBridge';

// ─── PIN storage ──────────────────────────────────────────────────────────────
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

// ─── Hour formatter ───────────────────────────────────────────────────────────
function formatHour(h: number): string {
  if (h === 0)  return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

// ─── Time formatter (minutes from midnight to "3:46 PM") ────────────────────
function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h < 12 ? 'AM' : 'PM';
  const minStr = m.toString().padStart(2, '0');
  return `${hour}:${minStr} ${ampm}`;
}

// ─── Number Picker Modal ─────────────────────────────────────────────────────
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
const DRUM_VISIBLE = 5; // odd so selected is centred

function NumberPickerModal({ visible, initialValue, min, max, unit, onSave, onClose }: NumberPickerModalProps) {
  const [value, setValue] = useState(initialValue);
  const scrollRef = useRef<ScrollView>(null);
  const didLayoutRef = useRef(false);
  const items = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  // Reset value and layout flag whenever the modal opens
  useEffect(() => {
    if (visible) {
      setValue(initialValue);
      didLayoutRef.current = false;
    }
  }, [visible, initialValue]);

  // Scroll to the right position once the ScrollView has laid out
  const handleLayout = () => {
    if (didLayoutRef.current) return;
    didLayoutRef.current = true;
    const idx = initialValue - min;
    scrollRef.current?.scrollTo({ y: idx * DRUM_ITEM_H, animated: false });
  };

  const handleScroll = (e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    const snapped = Math.round(y / DRUM_ITEM_H);
    const clamped = Math.max(0, Math.min(items.length - 1, snapped));
    setValue(items[clamped]);
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
              snapToInterval={DRUM_ITEM_H}
              decelerationRate="fast"
              onLayout={handleLayout}
              onMomentumScrollEnd={handleScroll}
              onScrollEndDrag={handleScroll}
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

// ─── Time Picker Modal ───────────────────────────────────────────────────────
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
  };
  const handleMinScroll = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    const m = Math.max(0, Math.min(59, idx));
    setMinute(m);
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
                snapToInterval={ITEM_H}
                decelerationRate="fast"
                onLayout={() => {
                  if (hourDidLayout.current) return;
                  hourDidLayout.current = true;
                  hourRef.current?.scrollTo({ y: (initH12 - 1) * ITEM_H, animated: false });
                }}
                onMomentumScrollEnd={handleHourScroll}
                onScrollEndDrag={handleHourScroll}
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
                snapToInterval={ITEM_H}
                decelerationRate="fast"
                onLayout={() => {
                  if (minDidLayout.current) return;
                  minDidLayout.current = true;
                  minRef.current?.scrollTo({ y: initMin * ITEM_H, animated: false });
                }}
                onMomentumScrollEnd={handleMinScroll}
                onScrollEndDrag={handleMinScroll}
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

// ─── Stepper ──────────────────────────────────────────────────────────────────
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

// ─── Dialpad ──────────────────────────────────────────────────────────────────
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

// ─── PIN dots ─────────────────────────────────────────────────────────────────
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
// Two-phase: enter PIN (4-6 digits) then confirm it.
// Auto-advances to confirm once first entry is 4-6 digits and user taps confirm.

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
        shake("PINs don't match — try again", () => {
          setDigits('');
          setFirstPin('');
          setPhase('enter');
          setMsg('Enter a PIN (4–6 digits)');
          setMsgColor(colors.textMuted);
        });
        return;
      }
      setIsSuccess(true);
      setMsg('PIN saved ✓');
      setMsgColor('#86efac');
      setTimeout(() => onSaved(digits), 500);
    }
  };

  const pinLength = phase === 'confirm' ? firstPin.length : 6;
  const displayLength = phase === 'enter'
    ? Math.max(4, digits.length)  // grows from 4 up to 6 as you type
    : firstPin.length;

  return (
    <View style={{ alignItems: 'center', gap: 20 }}>
      <Text style={[pinStyles.msg, { color: msgColor }]}>{msg}</Text>

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

// ─── PinSetup card ────────────────────────────────────────────────────────────
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

// ─── Main Settings screen ─────────────────────────────────────────────────────
export default function Settings({ onDataDeleted, onDreamsChange }: { onDataDeleted?: () => void; onDreamsChange?: (dreams: Dream[]) => void }) {
  const [settings, setSettings] = useState<NotifSettings>(DEFAULT_NOTIF_SETTINGS);
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
  const [numberPickerField, setNumberPickerField] = useState<'buffer' | 'sleep' | null>(null);

  useEffect(() => {
    loadNotifSettings().then(setSettings);
    loadPin().then(p => {
      if (p) { setPinEnabled(true); setPinSaved(true); }
      setPinLoaded(true);
    });
  }, []);

  const update = (patch: Partial<NotifSettings>) => {
    setSaved(false);
    setSettings(prev => ({ ...prev, ...patch }));
  };

  const openTimePicker = (field: 'start' | 'end' | 'morning' | 'evening') => {
    setTimePickerField(field);
    setTimePickerVisible(true);
  };

  const openNumberPicker = (field: 'buffer' | 'sleep') => {
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
    }
    setNumberPickerVisible(false);
    setNumberPickerField(null);
  };

  // Copy a picked audio file into permanent app storage and return the local path.
  // DocumentPicker's copyTo:'cachesDirectory' gives us a readable URI but it can
  // be purged by the OS. We copy it to documentDirectory which persists forever.
  const persistSoundFile = async (file: { uri: string; name: string }): Promise<string> => {
    const dest = FileSystem.documentDirectory + 'sounds/' + file.name;
    // Ensure the sounds directory exists
    await FileSystem.makeDirectoryAsync(FileSystem.documentDirectory + 'sounds/', { intermediates: true });
    // file.uri on Android after copyTo is the local cache copy — safe to copy from
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
        // If they had no file yet, make sure we stay on default
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

  const handlePickNotificationSound = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyTo: 'cachesDirectory',
      });
      if (result.canceled) return;
      const file = result.assets[0];
      const localPath = await persistSoundFile({ uri: file.uri, name: file.name });
      update({ notificationSoundFile: localPath });
    } catch (error) {
      Alert.alert('Error', 'Failed to pick sound file');
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
      const granted = await requestNotifPermission();
      if (!granted) {
        setSaved(true);
        Alert.alert('Settings saved', 'Notification permission was denied. Enable notifications for Lucid in your device settings.');
        return;
      }
      try {
        await scheduleNotifications(settings);
        if (settings.streakReminderEnabled) {
          await scheduleStreakReminders(settings.streakReminderMinutes, settings.streakReminderMorningMinutes);
        }
        setSaved(true);
      } catch {
        setSaved(true);
        Alert.alert('Settings saved', 'Scheduled notifications require a dev build — run "npx expo run:android" to activate them.');
      }
    } finally { setSaving(false); }
  };

  const handleAlarmSave = async () => {
    setSaving(true);
    try {
      await saveWBTBSettingsNative(
        settings.wbtbBufferMinutes,
        settings.wbtbSleepHours,
        settings.wbtbAlarmSound,
        settings.wbtbAlarmSoundFile,
        settings.wbtbAlarmSoundLoop
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
      setDeleteInput('');
      setDeleteError('');
      setPinEnabled(false);
      setPinSaved(false);
      onDataDeleted?.();
      Alert.alert('Done', 'All data has been deleted.');
    } catch {
      Alert.alert('Error', 'Could not delete data. Please try again.');
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <Text style={styles.pageTitle}>Settings</Text>

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

            <Text style={[styles.sectionLabel, { marginTop: 8 }]}>NOTIFICATION SOUND</Text>
            {(
              [
                { value: 'default',    label: 'Default',        sub: 'Your device\'s default notification sound' },
                { value: 'custom',     label: 'Custom file',     sub: settings.notificationSoundFile ? settings.notificationSoundFile.split('/').pop() || 'Import from device storage' : 'Import from device storage' },
              ] as { value: 'default' | 'custom'; label: string; sub: string }[]
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

            {settings.notificationSound === 'custom' && (
              <TouchableOpacity
                style={styles.importButton}
                onPress={handlePickNotificationSound}
              >
                <Ionicons name="folder-open-outline" size={18} color={colors.lightPurple} />
                <Text style={styles.importButtonText}>
                  {settings.notificationSoundFile ? 'Change file' : 'Import sound file'}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}

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

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnLoading]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>
                {saving ? 'Scheduling...' : saved ? '✓ Saved & scheduled' : 'Save & schedule notifications'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Wake Back To Bed Alarm ──────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { marginTop: 36 }]}>WAKE BACK TO BED ALARM</Text>

        <View style={styles.infoCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Ionicons name="moon-outline" size={16} color={colors.lightPurple} />
            <Text style={styles.infoTitle}>Home screen widget</Text>
          </View>
          <Text style={styles.infoBody}>
            Add the Lucid widget to your Android home screen. Tap Arm before sleep — the alarm fires after your buffer time plus sleep timer.
          </Text>
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
          <>
            <TouchableOpacity
              style={styles.importButton}
              onPress={handlePickAlarmSound}
            >
              <Ionicons name="folder-open-outline" size={18} color={colors.lightPurple} />
              <Text style={styles.importButtonText}>
                {settings.wbtbAlarmSoundFile ? 'Change file' : 'Import sound file'}
              </Text>
            </TouchableOpacity>

            {settings.wbtbAlarmSoundFile && (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>Loop sound</Text>
                  <Text style={styles.rowSub}>Play the sound repeatedly</Text>
                </View>
                <Switch
                  value={settings.wbtbAlarmSoundLoop}
                  onValueChange={val => update({ wbtbAlarmSoundLoop: val })}
                  trackColor={{ false: 'rgba(255,255,255,0.1)', true: colors.primaryPurple }}
                  thumbColor={settings.wbtbAlarmSoundLoop ? colors.lightPurple : 'rgba(255,255,255,0.4)'}
                />
              </View>
            )}
          </>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnLoading, { marginTop: 10 }]}
          onPress={handleAlarmSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save alarm settings'}
          </Text>
        </TouchableOpacity>


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

              // Import notification settings (excluding sound files)
              if (data.notificationSettings) {
                const currentSettings = await loadNotifSettings();
                const mergedSettings = {
                  ...currentSettings,
                  ...data.notificationSettings,
                  // Preserve current sound files
                  wbtbAlarmSoundFile: currentSettings.wbtbAlarmSoundFile,
                  notificationSoundFile: currentSettings.notificationSoundFile,
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

      <NumberPickerModal
        visible={numberPickerVisible}
        initialValue={
          numberPickerField === 'buffer' ? settings.wbtbBufferMinutes :
          numberPickerField === 'sleep' ? settings.wbtbSleepHours :
          0
        }
        min={numberPickerField === 'buffer' ? 1 : 0}
        max={numberPickerField === 'buffer' ? 60 : 8}
        unit={numberPickerField === 'buffer' ? 'm' : 'h'}
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

  pageTitle:    { fontSize: 28, fontWeight: '700', fontFamily: 'Nunito_800ExtraBold', color: colors.textPrimary, marginBottom: 32 },
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
});