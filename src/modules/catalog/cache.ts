import { CatalogError } from "./contracts";

export type CacheEntry = { payload: unknown; fetchedAt: Date; expiresAt: Date };
export type CacheResult<T> = { data: T; stale: boolean; fetchedAt: Date };
export interface CatalogCacheStore {
  read(key: string): Promise<CacheEntry | undefined>;
  write(key: string, entry: CacheEntry): Promise<void>;
}

export function createCatalogCache(store: CatalogCacheStore, now = () => Date.now()) {
  const inFlight = new Map<string, Promise<CacheResult<unknown>>>();
  return async function cached<T>(key: string, ttl: number, parse: (value: unknown) => T, load: () => Promise<unknown>, canUseStale: (error: unknown) => boolean): Promise<CacheResult<T>> {
    const existing = inFlight.get(key);
    if (existing) return existing as Promise<CacheResult<T>>;
    if (inFlight.size >= 20) throw new CatalogError("busy");
    const task = (async () => {
      const entry = await store.read(key);
      let saved: T | undefined;
      if (entry) { try { saved = parse(entry.payload); } catch {} }
      if (saved !== undefined && entry && entry.expiresAt.getTime() > now()) return { data: saved, stale: false, fetchedAt: entry.fetchedAt };
      let data: T;
      try { data = parse(await load()); }
      catch (error) {
        if (saved !== undefined && entry && now() - entry.fetchedAt.getTime() < 7 * 86400000 && canUseStale(error)) {
          return { data: saved, stale: true, fetchedAt: entry.fetchedAt };
        }
        throw error;
      }
      const fetchedAt = new Date(now());
      await store.write(key, { payload: data, fetchedAt, expiresAt: new Date(now() + ttl) });
      return { data, stale: false, fetchedAt };
    })();
    inFlight.set(key, task);
    try { return await task; } finally { inFlight.delete(key); }
  };
}
