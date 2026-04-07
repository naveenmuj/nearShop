import AsyncStorage from '@react-native-async-storage/async-storage';

const TELEMETRY_KEY = 'nearshop_local_telemetry_v1';
const MAX_EVENTS = 40;

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function readEvents() {
  try {
    const raw = await AsyncStorage.getItem(TELEMETRY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function recordLocalTelemetry(event) {
  try {
    const nextEvent = {
      id: makeId(),
      created_at: new Date().toISOString(),
      ...event,
    };
    const events = await readEvents();
    const nextEvents = [nextEvent, ...events].slice(0, MAX_EVENTS);
    await AsyncStorage.setItem(TELEMETRY_KEY, JSON.stringify(nextEvents));
    return nextEvent;
  } catch {
    return null;
  }
}

export async function getLocalTelemetry(limit = 10, type = null) {
  const events = await readEvents();
  const filtered = type ? events.filter((event) => event.type === type) : events;
  return filtered.slice(0, limit);
}