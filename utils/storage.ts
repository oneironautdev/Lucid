import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

export interface Dream {
  id: string;
  title: string;
  description: string;
  date: string;
  dateISO: string;
  vividness: number;
  tags: string[];
  noMemory: boolean;
  mood?: number; // 1-5 mood at logging time
  wbtbNight?: boolean; // WBTB alarm used this night?
  loggedAt?: string; // ISO timestamp when saved
  lucid?: boolean; // was this a lucid dream?
}

const KEY = 'lucid_dreams_v1';

export async function loadDreams(): Promise<Dream[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const dreams = JSON.parse(raw) as Dream[];
    // Migration: promote 'lucid' tag to boolean, strip 'vivid' tag
    let migrated = false;
    const result = dreams.map(d => {
      const hasLucidTag = d.tags?.includes('lucid') && !d.lucid;
      const hasVividTag = d.tags?.includes('vivid');
      if (hasLucidTag || hasVividTag) {
        migrated = true;
        return {
          ...d,
          lucid: hasLucidTag ? true : d.lucid,
          tags: d.tags.filter(t => t !== 'lucid' && t !== 'vivid'),
        };
      }
      return d;
    });
    if (migrated) saveDreams(result);
    return result;
  } catch {
    return [];
  }
}
export async function saveDreams(dreams: Dream[]): Promise<boolean> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(dreams));
    return true;
  } catch (e: any) {
    const isStorageFull =
      e?.message?.includes('storage') ||
      e?.message?.includes('quota') ||
      e?.code === 'E_STORAGE_FULL';
    Alert.alert(
      isStorageFull ? "Storage full" : "Couldn't save",
      isStorageFull
        ? "Your device is running low on storage. Free up some space and try again."
        : "Your dream couldn't be saved. Please try again.",
      [{ text: "OK" }]
    );
    return false;
  }
}

export function countWords(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}

export const WORD_LIMIT = 1000;

export function calculateStreak(dreams: Dream[]): number {
  if (dreams.length === 0) return 0;

  const logged = new Set(dreams.map(d => d.dateISO));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let streak = 0;
  const cursor = new Date(today);

  if (!logged.has(toISO(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (logged.has(toISO(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── Reality checks ───────────────────────────────────────────────────────────

export interface RealityCheck {
  id: string; // Date.now().toString()
  timestamp: number; // ms since epoch
  techniqueId: string; // e.g. 'hands', 'nose', 'text'
  result: 'awake' | 'lucid_suspected';
  presence: number; // 1-5
}

const RC_KEY = 'lucid_reality_checks_v1';

export async function loadChecks(): Promise<RealityCheck[]> {
  try {
    const raw = await AsyncStorage.getItem(RC_KEY);
    return raw ? (JSON.parse(raw) as RealityCheck[]) : [];
  } catch {
    return [];
  }
}

export async function saveChecks(checks: RealityCheck[]): Promise<boolean> {
  try {
    await AsyncStorage.setItem(RC_KEY, JSON.stringify(checks));
    return true;
  } catch (e: any) {
    const isStorageFull =
      e?.message?.includes('storage') ||
      e?.message?.includes('quota') ||
      e?.code === 'E_STORAGE_FULL';
    Alert.alert(
      isStorageFull ? "Storage full" : "Couldn't save",
      isStorageFull
        ? "Your device is running low on storage. Free up some space and try again."
        : "Your reality check couldn't be saved. Please try again.",
      [{ text: "OK" }]
    );
    return false;
  }
}

// Returns checks grouped by ISO date ('YYYY-MM-DD')
export function groupChecksByDay(checks: RealityCheck[]): Record<string, RealityCheck[]> {
  const out: Record<string, RealityCheck[]> = {};
  for (const c of checks) {
    const d = new Date(c.timestamp);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!out[iso]) out[iso] = [];
    out[iso].push(c);
  }
  return out;
}

export async function exportData(): Promise<void> {
  try {
    // Load dreams
    const dreams = await loadDreams();

    // Load reality checks
    const checks = await loadChecks();

    // Load notification settings (excluding alarm sounds)
    const notifRaw = await AsyncStorage.getItem('lucid_notif_settings_v1');
    let notifSettings = {};
    if (notifRaw) {
      const parsed = JSON.parse(notifRaw);
      notifSettings = {
        enabled: parsed.enabled,
        timesPerDay: parsed.timesPerDay,
        startMinutes: parsed.startMinutes,
        endMinutes: parsed.endMinutes,
        streakReminderEnabled: parsed.streakReminderEnabled,
        streakReminderMinutes: parsed.streakReminderMinutes,
        streakReminderMorningMinutes: parsed.streakReminderMorningMinutes,
        wbtbBufferMinutes: parsed.wbtbBufferMinutes,
        wbtbSleepHours: parsed.wbtbSleepHours,
        wbtbAlarmSound: parsed.wbtbAlarmSound,
        wbtbAlarmSoundLoop: parsed.wbtbAlarmSoundLoop,
        notificationSound: parsed.notificationSound,
      };
    }

    // Create export object
    const exportObj = {
      version: '1.1',
      exportDate: new Date().toISOString(),
      dreams,
      realityChecks: checks,
      notificationSettings: notifSettings,
    };

    // Write to file
    const fileUri = FileSystem.documentDirectory + 'lucid_export.json';
    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(exportObj, null, 2));

    // Share the file
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Export Lucid Data',
      });
    }
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
}