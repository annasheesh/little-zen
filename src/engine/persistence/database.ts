import { get, set } from 'idb-keyval';
import { GardenState, AirRakeSettings } from '../../types/garden';
import { GARDEN_PRESETS } from './presets';

const STORAGE_KEY = 'little_zen_garden_v1';
const AIR_RAKE_KEY = 'little_zen_air_rake_v1';

export const DEFAULT_AIR_RAKE_SETTINGS: AirRakeSettings = {
  enabled: false,
  cameraId: '',
  previewVisible: true,
  mirrored: true,
  cursorSensitivity: 1.25,
  cursorSmoothing: 0.65,
  pinchThreshold: 0.24,
  pinchReleaseThreshold: 0.36,
  showInstruction: true
};

export const DEFAULT_GARDEN_STATE: GardenState = {
  version: 1,
  elements: GARDEN_PRESETS[0].elements,
  stones: GARDEN_PRESETS[0].stones,
  settings: {
    paletteId: 'warm-ivory',
    reducedMotion: false,
    messagesEnabled: true,
    soundscape: 'none',
    soundVolume: 0.5,
    rakeSound: true
  }
};

let debounceTimer: number | null = null;

export async function loadGardenState(): Promise<GardenState> {
  try {
    const val = await get<GardenState>(STORAGE_KEY);
    if (val && val.version) {
      return val;
    }
  } catch (err) {
    console.warn('IndexedDB load failed, falling back to localStorage:', err);
  }

  try {
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) {
      return JSON.parse(local);
    }
  } catch {
    // ignore
  }

  return DEFAULT_GARDEN_STATE;
}

export function saveGardenStateDebounced(state: GardenState, delayMs = 600) {
  if (debounceTimer) {
    window.clearTimeout(debounceTimer);
  }

  debounceTimer = window.setTimeout(async () => {
    debounceTimer = null;
    try {
      await set(STORAGE_KEY, state);
    } catch {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // quota exceeded fallback
      }
    }
  }, delayMs);
}

export async function loadAirRakeSettings(): Promise<AirRakeSettings> {
  try {
    const val = await get<AirRakeSettings>(AIR_RAKE_KEY);
    if (val) return { ...DEFAULT_AIR_RAKE_SETTINGS, ...val, enabled: false }; // Never enable camera on initial launch
  } catch {
    // ignore
  }

  try {
    const local = localStorage.getItem(AIR_RAKE_KEY);
    if (local) return { ...DEFAULT_AIR_RAKE_SETTINGS, ...JSON.parse(local), enabled: false };
  } catch {
    // ignore
  }

  return DEFAULT_AIR_RAKE_SETTINGS;
}

export async function saveAirRakeSettings(settings: AirRakeSettings) {
  try {
    await set(AIR_RAKE_KEY, settings);
  } catch {
    try {
      localStorage.setItem(AIR_RAKE_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }
}
