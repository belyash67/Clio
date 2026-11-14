type ImageData = { body: Buffer; contentType: string };
export class PosterBusyError extends Error {}

export function createPosterCache(load: (filename: string) => Promise<ImageData>, maxBytes = 16 * 1024 * 1024, now = () => Date.now()) {
  const saved = new Map<string, ImageData & { expiresAt: number }>();
  const pending = new Map<string, Promise<ImageData>>();
  let bytes = 0;
  function remove(key: string) {
    const entry = saved.get(key);
    if (entry) bytes -= entry.body.byteLength;
    saved.delete(key);
  }
  return async (filename: string): Promise<ImageData> => {
    const cached = saved.get(filename);
    if (cached && cached.expiresAt > now()) {
      saved.delete(filename); saved.set(filename, cached);
      return cached;
    }
    if (cached) remove(filename);
    const existing = pending.get(filename);
    if (existing) return existing;
    if (pending.size >= 8) throw new PosterBusyError();
    const task = (async () => {
      const image = await load(filename);
      if (image.body.byteLength > maxBytes) throw new Error("POSTER_TOO_LARGE");
      for (const [key, entry] of saved) if (entry.expiresAt <= now()) remove(key);
      while (bytes + image.body.byteLength > maxBytes && saved.size) remove(saved.keys().next().value!);
      saved.set(filename, { ...image, expiresAt: now() + 6 * 3600000 });
      bytes += image.body.byteLength;
      return image;
    })();
    pending.set(filename, task);
    try { return await task; } finally { pending.delete(filename); }
  };
}
