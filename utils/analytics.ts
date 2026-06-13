import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getWBTBHistory } from './wbtbBridge';

// Keep this in sync with package.json / app.json / CURRENT_VERSION in notifications.ts
const APP_VERSION = '1.1.0';

const ANALYTICS_URL = 'https://lucid-analytics.lucidapp-contact.workers.dev/event';

const ANON_ID_KEY = 'lucid_analytics_anon_id_v1';
const ENABLED_KEY = 'lucid_analytics_enabled_v1';
const WBTB_SEEN_KEY = 'lucid_analytics_wbtb_seen_count_v1';

// ─── Anonymous ID ───────────────────────────────────────────────────────────
// A random ID generated once per install and stored locally. Not derived from
// any device identifier, and never tied to dream content or personal info.

function generateAnonId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let cachedAnonId: string | null = null;

async function getAnonId(): Promise<string> {
  if (cachedAnonId) return cachedAnonId;
  try {
    let id = await AsyncStorage.getItem(ANON_ID_KEY);
    if (!id) {
      id = generateAnonId();
      await AsyncStorage.setItem(ANON_ID_KEY, id);
    }
    cachedAnonId = id;
    return id;
  } catch {
    cachedAnonId = cachedAnonId ?? generateAnonId();
    return cachedAnonId;
  }
}

// ─── Toggle ─────────────────────────────────────────────────────────────────
// Default ON. Can be flipped during onboarding or in Settings > Privacy.

let cachedEnabled: boolean | null = null;

export async function getAnalyticsEnabled(): Promise<boolean> {
  if (cachedEnabled !== null) return cachedEnabled;
  try {
    const raw = await AsyncStorage.getItem(ENABLED_KEY);
    cachedEnabled = raw === null ? true : raw === 'true';
  } catch {
    cachedEnabled = true;
  }
  return cachedEnabled;
}

export async function setAnalyticsEnabled(enabled: boolean): Promise<void> {
  cachedEnabled = enabled;
  try {
    await AsyncStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false');
  } catch {}
}

// ─── Event tracking ───────────────────────────────────────────────────────
// Fire-and-forget: never throws, never blocks the caller, never retries.
// If it fails (offline, worker down, etc.) the event is just dropped.

export type AnalyticsEvent =
  | 'app_open'
  | 'dream_logged'
  | 'lucid_dream_logged'
  | 'reality_check_logged'
  | 'wbtb_armed';

export async function trackEvent(eventName: AnalyticsEvent): Promise<void> {
  try {
    const enabled = await getAnalyticsEnabled();
    if (!enabled) return;

    const anon_id = await getAnonId();

    fetch(ANALYTICS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anon_id,
        event_name: eventName,
        app_version: APP_VERSION,
        platform: Platform.OS,
      }),
    }).catch(() => {});
  } catch {
    // Analytics must never affect the app - swallow everything.
  }
}

// ─── WBTB arm detection ─────────────────────────────────────────────────────
// WBTB alarms are armed from the native Android widget, outside the RN UI, so
// there's no direct save handler to hook into. Instead, on each app open we
// diff the widget's history against how many entries we've already counted
// and fire one `wbtb_armed` event per new entry. The "seen" count is updated
// regardless of the toggle, so flipping analytics off and back on later
// doesn't cause a backlog of events to fire all at once.

export async function trackNewWbtbAlarms(): Promise<void> {
  try {
    const history = await getWBTBHistory();
    if (history.length === 0) return;

    const raw = await AsyncStorage.getItem(WBTB_SEEN_KEY);
    const seen = raw ? parseInt(raw, 10) : 0;
    const newCount = history.length - seen;

    await AsyncStorage.setItem(WBTB_SEEN_KEY, String(history.length));

    if (newCount <= 0) return;
    for (let i = 0; i < newCount; i++) {
      trackEvent('wbtb_armed');
    }
  } catch {
    // ignore
  }
}