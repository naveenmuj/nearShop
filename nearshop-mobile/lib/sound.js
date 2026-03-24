/**
 * Sound system — stub implementation.
 * Uses AsyncStorage for preference; actual audio via expo-av when enabled.
 * Default: OFF (user must opt in).
 */
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'nearshop_sound_enabled';
let _enabled = false;

export async function initSound() {
  try {
    const val = await SecureStore.getItemAsync(STORAGE_KEY);
    _enabled = val === 'true';
  } catch {}
}

export function isSoundEnabled() {
  return _enabled;
}

export async function setSoundEnabled(val) {
  _enabled = Boolean(val);
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, _enabled ? 'true' : 'false');
  } catch {}
}

// Stub functions — extend with expo-av Audio when needed
export function playSuccess() { if (!_enabled) return; }
export function playError()   { if (!_enabled) return; }
export function playCoin()    { if (!_enabled) return; }
export function playAddCart() { if (!_enabled) return; }
export function playWishlist(){ if (!_enabled) return; }
export function playSpinTick(){ if (!_enabled) return; }
export function playSpinWin() { if (!_enabled) return; }
