import { expect, it, vi } from "vitest";
import { detectPosterType, isPosterFilename, requestTmdbPoster } from "../src/server/integrations/tmdb-http.mjs";
import { posterUrl } from "../src/modules/catalog/contracts";
import { createPosterCache } from "../src/modules/catalog/poster-cache";

it("постеры используют только фиксированный маршрут и не принимают URL, обход путей или SVG", async () => {
  expect(posterUrl("/poster_123.jpg")).toBe("/api/posters/poster_123.jpg");
  for (const name of ["https://external.invalid/a.jpg", "../a.jpg", "a.svg", "a.jpg?url=evil", "a.jpg/../b.jpg", "a".repeat(129) + ".jpg"]) {
    expect(isPosterFilename(name)).toBe(false);
    await expect(requestTmdbPoster(name, "https")).rejects.toThrow("INVALID_POSTER_PATH");
  }
});

it("проверяет сигнатуру содержимого, отвергая HTML и SVG под видом картинки", () => {
  expect(detectPosterType(Buffer.from("<html>error</html>"))).toBeNull();
  expect(detectPosterType(Buffer.from("<svg></svg>"))).toBeNull();
  expect(detectPosterType(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toBe("image/jpeg");
  expect(detectPosterType(Buffer.from([137,80,78,71,13,10,26,10]))).toBe("image/png");
});

it("объединяет загрузки, ограничивает память и обновляет просроченный постер", async () => {
  let now = 0;
  const load = vi.fn(async () => ({ body: Buffer.alloc(4), contentType: "image/jpeg" }));
  const cache = createPosterCache(load, 4, () => now);
  await Promise.all([cache("first.jpg"), cache("first.jpg")]);
  expect(load).toHaveBeenCalledTimes(1);
  await cache("second.jpg"); // Evicts first: total memory limit is four bytes.
  await cache("first.jpg");
  expect(load).toHaveBeenCalledTimes(3);
  now = 7 * 3600000;
  await cache("first.jpg");
  expect(load).toHaveBeenCalledTimes(4);
});

it("не кэширует сбой источника и позволяет повторить запрос", async () => {
  const load = vi.fn().mockRejectedValueOnce(new Error("upstream failed")).mockResolvedValue({ body: Buffer.alloc(2), contentType: "image/png" });
  const cache = createPosterCache(load, 4);
  await expect(cache("retry.png")).rejects.toThrow("upstream failed");
  expect((await cache("retry.png")).body.length).toBe(2);
  expect(load).toHaveBeenCalledTimes(2);
});
