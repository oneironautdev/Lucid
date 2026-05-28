import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Dream {
  id: string;
  title: string;
  description: string;
  date: string;
  dateISO: string;
  vividness: number;
  tags: string[];
  noMemory: boolean;
}

const KEY = 'lucid_dreams_v1';

export async function loadDreams(): Promise<Dream[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Dream[];
  } catch {
    return [];
  }
}
export async function saveDreams(dreams: Dream[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(dreams));
  } catch {}
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

export async function exportData(): Promise<void> {
  try {
    // Load dreams
    const dreams = await loadDreams();

    // Load notification settings (excluding alarm sound files)
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
        // Exclude: wbtbAlarmSoundFile, notificationSoundFile
      };
    }

    // Create export object
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      dreams,
      notificationSettings: notifSettings,
    };

    // Write to file
    const fileUri = FileSystem.documentDirectory + 'lucid_export.json';
    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(exportData, null, 2));

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