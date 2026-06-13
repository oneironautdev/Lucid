/**
 * Debug data generator for screenshots and bug reproduction.
 * Generates realistic-looking dreams, reality checks, and streaks.
 * ONLY import this in dev/debug builds — strip before production.
 */

import { Dream, RealityCheck, saveChecks, saveDreams } from './storage';

const DREAM_TITLES = [
  'The glass tower', 'Running through fog', 'Old house revisited',
  'Flying over the city', 'The endless corridor', 'Strange market',
  'Being late again', 'Underwater cave', 'The forest at night',
  'Talking to a stranger', 'The train with no destination', 'Falling upward',
  'My childhood bedroom', 'The chase', 'Bright empty room',
  'Storm on the water', 'Maze with no exit', 'The clock with no hands',
  'Someone I used to know', 'Light through the trees',
];

const DREAM_DESCRIPTIONS = [
  `I was standing at the base of a glass tower that seemed to go on forever. The sky around it was that particular shade of purple you only see just before dawn. I knew I had to get to the top but the elevator kept taking me sideways instead of up. At some point I realised the people inside were all facing away from me.`,

  `Running but not going anywhere, the classic. Except this time the ground was soft like wet sand and every step left no footprint. There was something behind me but I never looked back. I woke up with my heart pounding.`,

  `Back in the house I grew up in, but the layout was wrong. The hallway was longer. There was a room at the end I don't remember existing. I opened the door and it was just full of light, warm and quiet. Stayed there for what felt like hours.`,

  `Flying came easily, like remembering a skill I'd always had. I could see the whole city below, the grid of lights. I kept thinking I should tell someone but there was no one nearby. The air was warmer than it should have been.`,

  `A corridor that kept extending the further I walked. The walls were lined with doors, all slightly different. I tried one and it opened into another corridor. Eventually I sat down and it all felt very peaceful.`,

  `Some kind of outdoor market but the goods were strange. Jars of light. Folded sounds. Someone tried to sell me a memory but I couldn't afford it. The seller was someone I recognised but couldn't name.`,

  `I was supposed to be somewhere important. I couldn't remember where. Everyone around me seemed to know exactly where they were going. My phone showed the wrong time and the map app just showed a blank screen.`,

  `Deep underwater but breathing fine. The cave walls were covered in something bioluminescent. There were shapes moving just beyond the edge of visibility. I wasn't afraid. I followed one of the shapes for a while.`,
];

const TAGS_POOL = [
  ['flying', 'city', 'calm'],
  ['chased', 'fear', 'running'],
  ['childhood home', 'family', 'nostalgia'],
  ['water', 'underwater', 'peace'],
  ['maze', 'doors', 'confusion'],
  ['work', 'anxiety', 'late for something'],
  ['strangers', 'city', 'market'],
  ['forest', 'darkness', 'animals'],
  ['recurring', 'school', 'anxiety'],
  ['flying', 'space', 'wonder'],
  [],
  ['transformation', 'mirrors'],
  ['vehicles', 'lost', 'confusion'],
];

function randomBetween(a: number, b: number) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isoForDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function displayDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function timestampForDay(daysAgo: number, hourOffset = 7): number {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hourOffset, randomBetween(0, 59), 0, 0);
  return d.getTime();
}

export interface DebugGeneratorOptions {
  /** How many days back to generate data for (default 60) */
  days?: number;
  /** Target logging rate 0–1 (default 0.75 so streak looks realistic) */
  loggingRate?: number;
  /** Include some lucid dreams (default true) */
  includeLucid?: boolean;
  /** Include WBTB nights (default true) */
  includeWbtb?: boolean;
}

export async function generateDebugData(opts: DebugGeneratorOptions = {}): Promise<{
  dreams: Dream[];
  checks: RealityCheck[];
}> {
  const {
    days = 60,
    loggingRate = 0.8,
    includeLucid = true,
    includeWbtb = true,
  } = opts;

  const dreams: Dream[] = [];
  const checks: RealityCheck[] = [];

  const techniqueIds = ['hands', 'nose', 'text', 'clock', 'finger', 'mirror', 'light', 'jump'];

  // Build a streak: last 14 days logged every day, before that random
  for (let daysAgo = days; daysAgo >= 0; daysAgo--) {
    const alwaysLog = daysAgo <= 14; // force streak for last 2 weeks
    const shouldLog = alwaysLog || Math.random() < loggingRate;

    if (shouldLog) {
      const dreamsThisNight = Math.random() < 0.3 ? 2 : 1; // 30% chance of 2 dreams
      const isWbtb = includeWbtb && Math.random() < 0.2;
      const isNoMemory = !alwaysLog && Math.random() < 0.1;

      if (isNoMemory) {
        dreams.push({
          id: `debug-${daysAgo}-nomem`,
          title: 'No memory',
          description: '',
          date: displayDate(daysAgo),
          dateISO: isoForDaysAgo(daysAgo),
          vividness: 1,
          tags: [],
          noMemory: true,
          loggedAt: new Date(timestampForDay(daysAgo, 7)).toISOString(),
        });
      } else {
        for (let d = 0; d < dreamsThisNight; d++) {
          const isLucid = includeLucid && Math.random() < 0.15;
          const vividness = isLucid
            ? randomBetween(4, 5)
            : randomBetween(2, 5);
          const mood = randomBetween(2, 5);
          const tags = randomPick(TAGS_POOL);
          if (isLucid && !tags.includes('lucid')) {
            // lucid flag handled separately, don't add tag
          }

          dreams.push({
            id: `debug-${daysAgo}-${d}`,
            title: randomPick(DREAM_TITLES),
            description: randomPick(DREAM_DESCRIPTIONS),
            date: displayDate(daysAgo),
            dateISO: isoForDaysAgo(daysAgo),
            vividness,
            tags: [...tags],
            noMemory: false,
            mood,
            lucid: isLucid || undefined,
            wbtbNight: isWbtb || undefined,
            loggedAt: new Date(timestampForDay(daysAgo, randomBetween(6, 10))).toISOString(),
          });
        }
      }
    }

    // Reality checks: 3–12 per day for recent days, fewer for older days
    const checksPerDay = daysAgo <= 14
      ? randomBetween(3, 12)
      : daysAgo <= 30
        ? randomBetween(0, 6)
        : randomBetween(0, 3);

    for (let c = 0; c < checksPerDay; c++) {
      const hour = randomBetween(8, 22);
      checks.push({
        id: `debug-rc-${daysAgo}-${c}`,
        timestamp: timestampForDay(daysAgo, hour),
        techniqueId: randomPick(techniqueIds),
        result: Math.random() < 0.03 ? 'lucid_suspected' : 'awake',
        presence: randomBetween(2, 5),
      });
    }
  }

  // Sort dreams newest first, checks oldest first
  dreams.sort((a, b) => b.dateISO.localeCompare(a.dateISO));
  checks.sort((a, b) => a.timestamp - b.timestamp);

  await saveDreams(dreams);
  await saveChecks(checks);

  return { dreams, checks };
}