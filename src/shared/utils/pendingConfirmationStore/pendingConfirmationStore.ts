interface PendingEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, PendingEntry<unknown>>();

export function setPendingConfirmation<T>(key: string, data: T, ttlMs: number) {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function getPendingConfirmation<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }

  return entry.data as T;
}

export function clearPendingConfirmation(key: string) {
  store.delete(key);
}
