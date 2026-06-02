import { NativeModules, Platform } from 'react-native';

const { WBTBSettings } = NativeModules;

export async function saveWBTBSettingsNative(
  bufferMinutes: number,
  sleepHours: number,
  alarmSound: string,
  alarmSoundFile: string,
  alarmSoundLoop: boolean
): Promise<void> {
  if (Platform.OS === 'android' && WBTBSettings) {
    try {
      await WBTBSettings.save(bufferMinutes, sleepHours, alarmSound, alarmSoundFile, alarmSoundLoop);
    } catch (e) {
      console.warn('WBTBSettings.save failed:', e);
    }
  }
}

export interface WBTBRecord {
  armedAt: string;  // ISO UTC
  alarmAt: string;  // ISO UTC
  firedAt: string;  // ISO UTC
}

export async function getWBTBHistory(): Promise<WBTBRecord[]> {
  if (Platform.OS === 'android' && WBTBSettings) {
    try {
      const json: string = await WBTBSettings.getHistory();
      return JSON.parse(json) as WBTBRecord[];
    } catch (e) {
      console.warn('WBTBSettings.getHistory failed:', e);
    }
  }
  return [];
}