/**
 * Tiny stale-while-revalidate cache for on-chain reads (Horizon + Soroban RPC).
 * - Fresh (< ttlMs): served from memory, no network.
 * - Stale (past ttl): previous value is returned instantly while the loader
 *   refreshes in the background, so screens paint immediately on every visit.
 * - Miss: loader runs, result stored, concurrent callers share one request.
 */
const store = new Map<string, { value: unknown; at: number }>();
const inflight = new Map<string, Promise<unknown>>();

export function cachedRead<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit) {
    if (Date.now() - hit.at < ttlMs) {
      return Promise.resolve(hit.value as T);
    }
    const existing = inflight.get(key);
    if (!existing) {
      inflight.set(
        key,
        loader()
          .then((v) => {
            store.set(key, { value: v, at: Date.now() });
            return v;
          })
          .finally(() => inflight.delete(key)),
      );
    }
    return Promise.resolve(hit.value as T);
  }
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = loader()
    .then((v) => {
      store.set(key, { value: v, at: Date.now() });
      return v;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
