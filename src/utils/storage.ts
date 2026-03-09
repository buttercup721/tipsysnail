import type { ManualSaveSlot, StoredGameState } from '../types/game';

const LIVE_STORAGE_KEY = 'snail-terrarium-shell';
const MANUAL_SAVE_KEY = 'snail-terrarium-manual-save';

export function loadStoredGameState(): Partial<StoredGameState> | null {
  try {
    const raw = window.localStorage.getItem(LIVE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<StoredGameState>) : null;
  } catch {
    return null;
  }
}

export function saveStoredGameState(state: StoredGameState): void {
  try {
    window.localStorage.setItem(LIVE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can fail in private or restricted contexts; the prototype should keep running.
  }
}

export function loadManualSaveSlot(): ManualSaveSlot | null {
  try {
    const raw = window.localStorage.getItem(MANUAL_SAVE_KEY);
    return raw ? (JSON.parse(raw) as ManualSaveSlot) : null;
  } catch {
    return null;
  }
}

export function saveManualSaveSlot(slot: ManualSaveSlot): void {
  try {
    window.localStorage.setItem(MANUAL_SAVE_KEY, JSON.stringify(slot));
  } catch {
    // Ignore save failures so the game keeps running.
  }
}
