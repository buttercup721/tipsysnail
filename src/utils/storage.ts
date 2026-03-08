import type { StoredGameState } from '../types/game';

const STORAGE_KEY = 'snail-terrarium-shell';

export function loadStoredGameState(): Partial<StoredGameState> | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<StoredGameState>) : null;
  } catch {
    return null;
  }
}

export function saveStoredGameState(state: StoredGameState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can fail in private or restricted contexts; the prototype should keep running.
  }
}
