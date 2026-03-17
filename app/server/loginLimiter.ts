const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

const attempts = new Map<string, { count: number; lockedUntil: number }>();

function key(name: string): string {
  return name.trim().toLowerCase();
}

export function isLockedOut(name: string): boolean {
  const k = key(name);
  const entry = attempts.get(k);
  if (!entry) return false;
  if (Date.now() < entry.lockedUntil) return true;
  attempts.delete(k);
  return false;
}

export function recordFailedAttempt(name: string): void {
  const k = key(name);
  const entry = attempts.get(k);
  if (!entry) {
    attempts.set(k, { count: 1, lockedUntil: Date.now() + LOCKOUT_MS });
    return;
  }
  if (Date.now() >= entry.lockedUntil) {
    attempts.set(k, { count: 1, lockedUntil: Date.now() + LOCKOUT_MS });
    return;
  }
  const count = entry.count + 1;
  if (count >= MAX_ATTEMPTS) {
    attempts.set(k, { count, lockedUntil: Date.now() + LOCKOUT_MS });
  } else {
    attempts.set(k, { ...entry, count });
  }
}

export function clearAttempts(name: string): void {
  attempts.delete(key(name));
}

export function getRemainingLockoutMs(name: string): number {
  const k = key(name);
  const entry = attempts.get(k);
  if (!entry || Date.now() >= entry.lockedUntil) return 0;
  return entry.lockedUntil - Date.now();
}
