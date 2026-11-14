import { expect, it, vi } from "vitest";
import { createCatalogCache, type CacheEntry } from "../src/modules/catalog/cache";
import { CatalogError, catalogQuerySchema, posterUrl, tmdbDetailsSchema } from "../src/modules/catalog/contracts";

it("отклоняет опасные параметры, неверный тип и внешние URL изображений", () => {
  expect(catalogQuerySchema.safeParse({ type: "person" }).success).toBe(false);
  expect(catalogQuerySchema.safeParse({ page: 501 }).success).toBe(false);
  expect(catalogQuerySchema.safeParse({ q: "a".repeat(121) }).success).toBe(false);
  expect(posterUrl("//external.invalid/image.jpg")).toBeNull();
  expect(posterUrl("/../secret")).toBeNull();
  expect(tmdbDetailsSchema.safeParse({ id: 1, overview: "", poster_path: null }).success).toBe(false);
});

it("объединяет параллельные запросы и повторно читает свежий кэш без загрузки источника", async () => {
  const values = new Map<string, CacheEntry>();
  const read = vi.fn(async (key: string) => values.get(key));
  const write = vi.fn(async (key: string, entry: CacheEntry) => { values.set(key, entry); });
  const cache = createCatalogCache({ read, write }, () => 1000);
  const load = vi.fn(async () => ({ title: "isolated-test-value" }));
  const parse = (value: unknown) => value as { title: string };
  const [first, second] = await Promise.all([
    cache("movie:1:ru", 10000, parse, load, () => false),
    cache("movie:1:ru", 10000, parse, load, () => false),
  ]);
  expect(first).toEqual(second);
  expect(load).toHaveBeenCalledTimes(1);
  expect(write).toHaveBeenCalledTimes(1);
  await cache("movie:1:ru", 10000, parse, load, () => false);
  expect(load).toHaveBeenCalledTimes(1);
});

it("при сетевом сбое возвращает помеченный устаревший кэш, но не скрывает отказ ключа", async () => {
  const entry = { payload: "saved", fetchedAt: new Date(1000), expiresAt: new Date(2000) };
  const write = vi.fn();
  const cache = createCatalogCache({ read: async () => entry, write }, () => 3000);
  const allowed = (error: unknown) => error instanceof CatalogError && error.reason === "unavailable";
  const network = async () => { throw new CatalogError("unavailable"); };
  expect((await cache("key", 10, String, network, allowed)).stale).toBe(true);
  await expect(cache("key", 10, String, async () => { throw new CatalogError("credentials"); }, allowed)).rejects.toMatchObject({ reason: "credentials" });
  expect(write).not.toHaveBeenCalled();
  const oldCache = createCatalogCache({ read: async () => entry, write }, () => 9 * 86400000);
  await expect(oldCache("key", 10, String, network, allowed)).rejects.toMatchObject({ reason: "unavailable" });
});
