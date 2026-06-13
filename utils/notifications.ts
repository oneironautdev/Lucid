import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

export type WBTBAlarmSound = 'custom' | 'default' | 'lifes_good';

export interface NotifSettings {
  enabled: boolean;
  timesPerDay: number;
  startMinutes: number;
  endMinutes: number;
  streakReminderEnabled: boolean;
  streakReminderMinutes: number;
  streakReminderMorningMinutes: number;
  wbtbBufferMinutes: number;
  wbtbSleepHours: number;
  wbtbAlarmSound: 'custom' | 'default';
  wbtbAlarmSoundFile: string;
  wbtbAlarmSoundLoop: boolean;
  wbtbAlarmDuration: number; // seconds, 15-45
  notificationSound: 'default' | 'app';
}

export const DEFAULT_NOTIF_SETTINGS: NotifSettings = {
  enabled: true,
  timesPerDay: 10,
  startMinutes: 6 * 60,
  endMinutes: 21 * 60,
  streakReminderEnabled: true,
  streakReminderMinutes: 21 * 60,
  streakReminderMorningMinutes: 6 * 60,
  wbtbBufferMinutes: 15,
  wbtbSleepHours: 5,
  wbtbAlarmSound: 'default',
  wbtbAlarmSoundFile: '',
  wbtbAlarmSoundLoop: false,
  wbtbAlarmDuration: 30,
  notificationSound: 'app',
};

const SETTINGS_KEY = 'lucid_notif_settings_v1';

export async function loadNotifSettings(): Promise<NotifSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_NOTIF_SETTINGS;
    return { ...DEFAULT_NOTIF_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_NOTIF_SETTINGS;
  }
}

export async function saveNotifSettings(settings: NotifSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

export const NOTIFICATION_MESSAGES: { title: string; body: string }[] = [
  { title: 'Reality Check', body: 'Look at your hands. Really look. Count your fingers.' },
  { title: 'Reality Check', body: 'Stop. Are you dreaming right now? Check your surroundings.' },
  { title: 'Reality Check', body: 'Pinch your nose. Can you still breathe?' },
  { title: 'Reality Check', body: 'Read something nearby. Look away. Read it again. Did it change?' },
  { title: 'Reality Check', body: 'Look at a clock. Look away. Look back. What time is it now?' },
  { title: 'Reality Check', body: 'Try to push your finger through your palm. Does it go through?' },
  { title: 'Reality Check', body: 'Jump. Did gravity feel normal?' },
  { title: 'Reality Check', body: 'Count your fingers. Are there exactly five on each hand?' },
  { title: 'Reality Check', body: 'Look at a light switch. Flip it. Did the light change?' },
  { title: 'Reality Check', body: 'Find some text. Can you read it clearly?' },
  { title: 'Are you sure?', body: 'The clock has no hands.' },
  { title: 'Are you sure?', body: 'Something in this room doesn\'t quite fit.' },
  { title: 'Are you sure?', body: 'You\'ve been here before. Or have you?' },
  { title: 'Are you sure?', body: 'The edges of things look slightly wrong.' },
  { title: 'Are you sure?', body: 'How did you get to where you are right now?' },
  { title: 'Are you sure?', body: 'Try to remember what you did an hour ago. Can you?' },
  { title: 'Are you sure?', body: 'Look at your reflection. Does it move when it should?' },
  { title: 'Are you sure?', body: 'The light in here is slightly off. Or is it?' },
  { title: 'Are you sure?', body: 'Someone just walked past you. Do you know them?' },
  { title: 'Are you sure?', body: 'Where were you before this moment?' },
  { title: 'Are you sure?', body: 'Everything feels real. But it always does.' },
  { title: 'Are you sure?', body: 'The last thing you remember, does it make sense?' },
  { title: 'This moment.', body: 'Are you conscious of being conscious right now?' },
  { title: 'This moment.', body: 'What does reality feel like? Does this feel like that?' },
  { title: 'This moment.', body: 'How do you know you\'re not dreaming? Prove it.' },
  { title: 'This moment.', body: 'The dreaming mind never knows it\'s dreaming. Does yours?' },
  { title: 'This moment.', body: 'Take a breath. Feel it. Is anything else this real?' },
  { title: 'This moment.', body: 'Pay attention to one thing around you. Really notice it.' },
  { title: 'This moment.', body: 'If this were a dream, what would give it away?' },
  { title: 'This moment.', body: 'Presence is the gateway. Are you present right now?' },
  { title: 'Hey.', body: 'Just checking in. Are you dreaming?' },
  { title: 'Hey.', body: 'Quick one, look at your hands.' },
  { title: 'Hey.', body: 'Something feels slightly off. Or maybe not.' },
  { title: 'Hey.', body: 'Don\'t ignore this one. Actually do the check.' },
  { title: 'Hey.', body: 'This could be a dream. Humor the idea for a second.' },
  { title: 'Hey.', body: 'You skipped the last one. Do this one properly.' },
  { title: '...', body: 'Look at your hands.' },
  { title: '...', body: 'Are you awake?' },
  { title: '...', body: 'Check.' },
  { title: 'WAKE UP', body: 'Just kidding. Or are we?' },
  { title: 'WAKE UP', body: 'The floor is the right distance away. Or is it?' },
  { title: 'WAKE UP', body: 'You can\'t read this in a dream. Can you read this?' },
  { title: 'WAKE UP', body: 'Your hands have exactly the right number of fingers.' },
  { title: 'WAKE UP', body: 'Gravity is working. Probably.' },
  { title: 'Lucid', body: 'A dreamer who knows they\'re dreaming can do anything. Are you one?' },
  { title: 'Lucid', body: 'The mind builds entire worlds at night. Is it building one now?' },
  { title: 'Lucid', body: 'You\'re either awake, or you\'re about to realize something incredible.' },
  { title: 'Lucid', body: 'Every reality check you do while awake is a seed planted for tonight.' },
  { title: 'Lucid', body: 'Your dreaming self is watching. Train it well.' },
  { title: 'Lucid', body: 'The habit you build now is the awareness you\'ll have then.' },
];

export function getRandomMessage() {
  return NOTIFICATION_MESSAGES[Math.floor(Math.random() * NOTIFICATION_MESSAGES.length)];
}

export async function requestNotifPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function setupNotificationChannel(settings?: NotifSettings) {
  // 'app' = bundled sound, 'default' = system sound
  const useAppSound = settings?.notificationSound !== 'default';
  const sound = useAppSound ? 'reality_check' : undefined;
  const channelId = useAppSound ? 'reality-checks-app-2' : 'reality-checks-default';

  // Clean up old channels with different IDs
  try {
    const existing = await Notifications.getNotificationChannelsAsync();
    for (const ch of existing ?? []) {
      if (ch.id.startsWith('reality-checks') && ch.id !== channelId) {
        await Notifications.deleteNotificationChannelAsync(ch.id);
      }
    }
  } catch {}

  await Notifications.setNotificationChannelAsync(channelId, {
    name: 'Reality Checks',
    importance: Notifications.AndroidImportance.HIGH,
    sound,
    vibrationPattern: [0, 250, 150, 250],
    lightColor: '#a78bfa',
  });

  return channelId;
}

export async function scheduleNotifications(settings: NotifSettings): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (!settings.enabled) return;

  const { timesPerDay, startMinutes, endMinutes } = settings;
  const windowMinutes = endMinutes - startMinutes;
  if (windowMinutes <= 0) return;

  // Ensure channel exists with right sound
  const channelId = await setupNotificationChannel(settings);

  const now = new Date();
  const startHour = Math.floor(startMinutes / 60);
  const startMinOffset = startMinutes % 60;

  for (let day = 0; day < 7; day++) {
    const offsets: number[] = [];
    for (let i = 0; i < timesPerDay; i++) {
      offsets.push(Math.floor(Math.random() * windowMinutes));
    }
    offsets.sort((a, b) => a - b);

    for (const offsetMin of offsets) {
      const trigger = new Date(now);
      trigger.setDate(now.getDate() + day);
      trigger.setHours(startHour, startMinOffset, 0, 0);
      trigger.setMinutes(trigger.getMinutes() + offsetMin);

      if (trigger <= now) continue;

      const msg = getRandomMessage();

      await Notifications.scheduleNotificationAsync({
        content: {
          title: msg.title,
          body: msg.body,
          data: { type: 'reality-check' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: trigger,
          channelId,
        },
      });
    }
  }
}

const STREAK_MESSAGES = [
  { title: "Don't break the chain.", body: "You haven't logged a dream today. Keep your streak alive." },
  { title: 'Log before you forget.', body: "Dreams fade fast. Take 2 minutes to log last night's." },
  { title: 'Your streak is waiting.', body: "One entry a day is all it takes. Don't let it slip." },
  { title: 'Still awake?', body: "Good time to log. Dreams you write down are dreams you remember." },
  { title: "The night is coming.", body: "Log today's before tonight's replaces it." },
  { title: 'Keep building.', body: "Every day you log is a day your dreaming mind gets sharper." },
  { title: 'Quick reminder.', body: "Have you logged today? It takes less than a minute." },
];

export function getRandomStreakMessage() {
  return STREAK_MESSAGES[Math.floor(Math.random() * STREAK_MESSAGES.length)];
}

// morningMinutes and eveningMinutes are minutes-since-midnight (e.g. 6*60=360, 21*60=1260)
export async function scheduleStreakReminders(morningMinutes = 8 * 60, eveningMinutes = 21 * 60, notificationSound: 'default' | 'app' = 'app'): Promise<void> {
  const useAppSound = notificationSound !== 'default';

  await Notifications.setNotificationChannelAsync('streak-reminders-morning', {
    name: 'Morning Dream Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: useAppSound ? 'morning_push' : undefined,
  });

  await Notifications.setNotificationChannelAsync('streak-reminders-evening', {
    name: 'Evening Streak Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: useAppSound ? 'evening_push' : undefined,
  });

  const MORNING_MESSAGES = [
    { title: 'What did you dream?', body: 'Take 60 seconds now, dreams fade within minutes of waking.' },
    { title: 'Before it slips away.', body: 'Lie still and try to recall. Even one image is worth logging.' },
    { title: 'Dream recall window.', body: "The next 10 minutes are your best chance to remember last night's dreams." },
    { title: 'Good morning.', body: 'What was the last thing you experienced before waking up?' },
    { title: 'Morning check-in.', body: "Don't move yet. Stay still and let last night's dream come back to you." },
    { title: 'The dream is still there.', body: 'Close your eyes for a moment. What fragments can you hold onto?' },
    { title: 'Log it now.', body: "Every dream you write down trains your memory for the next one." },
  ];

  const morningHour = Math.floor(morningMinutes / 60);
  const morningMin  = morningMinutes % 60;
  const eveningHour = Math.floor(eveningMinutes / 60);
  const eveningMin  = eveningMinutes % 60;

  const now = new Date();

  for (let day = 0; day < 7; day++) {
    const morning = new Date(now);
    morning.setDate(now.getDate() + day);
    morning.setHours(morningHour, morningMin, 0, 0);
    if (morning > now) {
      const mMsg = MORNING_MESSAGES[Math.floor(Math.random() * MORNING_MESSAGES.length)];
      await Notifications.scheduleNotificationAsync({
        content: {
          title: mMsg.title,
          body: mMsg.body,
          data: { type: 'streak-reminder-morning' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: morning,
          channelId: 'streak-reminders-morning',
        },
      });
    }

    const evening = new Date(now);
    evening.setDate(now.getDate() + day);
    evening.setHours(eveningHour, eveningMin, 0, 0);
    if (evening > now) {
      const eMsg = STREAK_MESSAGES[Math.floor(Math.random() * STREAK_MESSAGES.length)];
      await Notifications.scheduleNotificationAsync({
        content: {
          title: eMsg.title,
          body: eMsg.body,
          data: { type: 'streak-reminder-evening' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: evening,
          channelId: 'streak-reminders-evening',
        },
      });
    }
  }
}
// ─── Update checker ───────────────────────────────────────────────────────────

const UPDATE_CHECK_URL = 'https://raw.githubusercontent.com/oneironautdev/Lucid/main/version.json';
const UPDATE_DISMISSED_KEY = 'lucid_update_dismissed_v1';
const CURRENT_VERSION = '1.1.0';

export interface UpdateInfo {
  version: string;
  changelog: string;
  apkUrl: string;
  playStore: boolean;
  playStoreUrl: string;
  note?: string; // optional important note shown in a confirmation before the user updates
}

/** Returns update info if a newer version is available and not yet dismissed, otherwise null. */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${UPDATE_CHECK_URL}?t=${Date.now()}`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data: UpdateInfo = await res.json();

    if (!data.version || data.version === CURRENT_VERSION) return null;

    // Don't show if user already dismissed this version
    const dismissed = await AsyncStorage.getItem(UPDATE_DISMISSED_KEY);
    if (dismissed === data.version) return null;

    return data;
  } catch {
    return null;
  }
}

/** Call when user dismisses the update banner for this version. */
export async function dismissUpdate(version: string): Promise<void> {
  try {
    await AsyncStorage.setItem(UPDATE_DISMISSED_KEY, version);
  } catch {}
}