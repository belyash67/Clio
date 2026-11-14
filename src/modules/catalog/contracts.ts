import { z } from "zod";

export const mediaTypeSchema = z.enum(["movie", "tv"]);
export type MediaType = z.infer<typeof mediaTypeSchema>;
export const catalogQuerySchema = z.object({
  q: z.string().trim().max(120).default(""),
  type: mediaTypeSchema.default("movie"),
  page: z.coerce.number().int().min(1).max(500).default(1),
  year: z.string().regex(/^$|^\d{4}$/).default(""),
  genre: z.string().regex(/^$|^\d{1,8}$/).default(""),
  country: z.string().regex(/^$|^[A-Z]{2}$/).default(""),
  minRating: z.string().regex(/^$|^[0-9](?:\.5)?$|^10$/).default(""),
  sort: z.enum(["popularity.desc","vote_average.desc","primary_release_date.desc","title.asc"]).default("popularity.desc"),
  mode: z.enum(["title","person"]).default("title"),
  animation: z.enum(["","animation","anime"]).default(""),
});
const posterPath = z.string().regex(/^\/[a-zA-Z0-9._-]+$/).nullable().catch(null);
export const tmdbItemSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().optional(), name: z.string().optional(),
  original_title: z.string().optional(), original_name: z.string().optional(),
  overview: z.string().default(""), poster_path: posterPath,
  release_date: z.string().optional(), first_air_date: z.string().optional(),
  vote_average: z.number().min(0).max(10).default(0),
  vote_count: z.number().int().nonnegative().default(0),
  adult: z.boolean().default(false),
  genre_ids: z.array(z.number()).default([]),
}).refine((value) => Boolean(value.title || value.name), "Missing title");
export const tmdbListSchema = z.object({
  page: z.number().int().positive(),
  total_pages: z.number().int().nonnegative(),
  results: z.array(tmdbItemSchema),
});
const personSchema = z.object({ id: z.number().int().positive(), name: z.string(), character: z.string().optional(), job: z.string().optional() });
export const tmdbDetailsSchema = tmdbItemSchema.safeExtend({
  genres: z.array(z.object({ id: z.number().int(), name: z.string() })).default([]),
  production_countries: z.array(z.object({ name: z.string() })).default([]),
  runtime: z.number().nullable().optional(),
  episode_run_time: z.array(z.number()).default([]),
  number_of_seasons: z.number().optional(),
  number_of_episodes: z.number().optional(),
  credits: z.object({ cast: z.array(personSchema), crew: z.array(personSchema) }).optional(),
  created_by: z.array(personSchema).default([]),
  keywords: z.object({ keywords:z.array(z.object({id:z.number(),name:z.string()})).optional(), results:z.array(z.object({id:z.number(),name:z.string()})).optional() }).optional(),
});
export type TmdbItem = z.infer<typeof tmdbItemSchema>;
export function mediaTitle(value: TmdbItem) { return value.title || value.name || value.original_title || value.original_name || "Без названия"; }
export function mediaYear(value: TmdbItem) { return (value.release_date || value.first_air_date || "").slice(0, 4); }
export function posterUrl(path: string | null) { return path && /^\/[a-zA-Z0-9_-]{1,128}\.(?:jpg|jpeg|png|webp)$/.test(path) ? `/api/posters${path}` : null; }

export class CatalogError extends Error {
  constructor(public readonly reason: "configuration" | "credentials" | "not-found" | "unavailable" | "busy") { super(reason); }
}
export function catalogErrorMessage(error: unknown) {
  if (error instanceof CatalogError) {
    if (error.reason === "configuration") return "Каталог ещё подключается. Поиск станет доступен после настройки источника данных.";
    if (error.reason === "credentials") return "Источник каталога отклонил ключ доступа. Поиск временно недоступен.";
    if (error.reason === "busy") return "Каталог занят. Подожди немного и повтори поиск.";
  }
  return "Не удалось загрузить каталог. Попробуй ещё раз немного позже.";
}
