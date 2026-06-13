const STORAGE_KEY = 'hermes_chat_sessions';

export function loadFromStorage<T>(fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function saveToStorage(data: unknown): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    console.warn('Failed to save to localStorage');
  }
}
