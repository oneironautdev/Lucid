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