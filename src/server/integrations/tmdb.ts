import "server-only";
import { createHash } from "node:crypto";
import { eq, lt, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { catalogCache, media } from "@/server/db/schema";
import { createCatalogCache } from "@/modules/catalog/cache";
import { CatalogError, type MediaType, tmdbDetailsSchema, tmdbListSchema, tmdbItemSchema } from "@/modules/catalog/contracts";
import { requestTmdbJson } from "./tmdb-http.mjs";
import { z } from "zod";

export function hasTmdbToken() { return Boolean(process.env.TMDB_READ_ACCESS_TOKEN?.trim()); }
const cached = createCatalogCache({
  async read(key) { return (await getDb().select().from(catalogCache).where(eq(catalogCache.key, key)).limit(1))[0]; },
  async write(key, entry) {
    const db = getDb();
    await db.insert(catalogCache).values({ key, ...entry }).onConflictDoUpdate({ target: catalogCache.key, set: entry });
    // Bound storage: discard old entries, then keep the 1000 most recently fetched.
    await db.delete(catalogCache).where(lt(catalogCache.fetchedAt, new Date(Date.now() - 7 * 86400000)));
    await db.execute(sql`delete from ${catalogCache} where ${catalogCache.key} in (select ${catalogCache.key} from ${catalogCache} order by ${catalogCache.fetchedAt} desc offset 1000)`);
  },
});

async function tmdbRequest(path: string, params: Record<string, string>) {
  const token = process.env.TMDB_READ_ACCESS_TOKEN?.trim();
  if (!token) throw new CatalogError("configuration");
  const url = new URL(`https://api.themoviedb.org/3/${path}`);
  url.search = new URLSearchParams({ language: "ru-RU", ...params }).toString();
  const dnsMode = process.env.TMDB_DNS_MODE || "system";
  if (dnsMode !== "system" && dnsMode !== "https") throw new CatalogError("configuration");
  let response;
  try { response = await requestTmdbJson(url, token, dnsMode); }
  catch { throw new CatalogError("unavailable"); }
  if (response.status === 401 || response.status === 403) throw new CatalogError("credentials");
  if (response.status === 404) throw new CatalogError("not-found");
  if (response.status < 200 || response.status >= 300) throw new CatalogError("unavailable");
  return response.data;
}
const fallbackAllowed = (error: unknown) => error instanceof CatalogError && error.reason === "unavailable";

export async function searchCatalog(type: MediaType, query: string, page: number, options: {year?:string;genre?:string;country?:string;minRating?:string;sort?:string;animation?:string}={}) {
  const path = query ? `search/${type}` : `discover/${type}`;
  const params:Record<string,string> = { page: String(page), include_adult: "false", ...(query ? { query } : {}) };
  if(options.year)params[query?(type==="movie"?"primary_release_year":"first_air_date_year"):(type==="movie"?"primary_release_year":"first_air_date_year")]=options.year;
  if(!query){
    if(options.genre||options.animation)params.with_genres=options.animation?"16":options.genre!;
    if(options.country)params.with_origin_country=options.country;
    if(options.minRating){params["vote_average.gte"]=options.minRating;params["vote_count.gte"]="20";}
    params.sort_by=type==="tv"?({"primary_release_date.desc":"first_air_date.desc","title.asc":"name.asc"}[options.sort??""]??options.sort??"popularity.desc"):options.sort??"popularity.desc";
    if(options.animation==="anime"){
      const keywords=await cached("tmdb:anime-keyword",86400000,value=>z.object({results:z.array(z.object({id:z.number(),name:z.string()}))}).parse(value),()=>tmdbRequest("search/keyword",{query:"anime"}),fallbackAllowed);
      const keyword=keywords.data.results.find(item=>item.name.toLowerCase()==="anime");
      if(!keyword)throw new CatalogError("unavailable");params.with_keywords=String(keyword.id);
    }
  }
  const key = createHash("sha256").update(JSON.stringify(["tmdb-v1", path, "ru-RU", params])).digest("hex");
  return cached(key, 15 * 60000, (value) => tmdbListSchema.parse(value), () => tmdbRequest(path, params), fallbackAllowed);
}

export async function getMediaDetails(type: MediaType, id: number) {
  const result = await cached(`tmdb-v2:${type}:${id}:ru-RU`, 86400000, (value) => tmdbDetailsSchema.parse(value), () => tmdbRequest(`${type}/${id}`, { append_to_response: "credits,keywords" }), fallbackAllowed);
  if (result.data.id !== id) throw new CatalogError("unavailable");
  if (result.data.adult) throw new CatalogError("not-found");
  const row = { tmdbMediaType: type, tmdbId: id, originalTitle: result.data.original_title || result.data.original_name || result.data.title || result.data.name || "", title: result.data.title || result.data.name || "", genreIds: result.data.genres.map((genre) => genre.id), posterPath: result.data.poster_path, updatedAt: result.fetchedAt };
  const [saved] = await getDb().insert(media).values(row).onConflictDoUpdate({ target: [media.tmdbMediaType, media.tmdbId], set: { originalTitle: row.originalTitle, title: row.title, genreIds: row.genreIds, posterPath: row.posterPath, updatedAt: row.updatedAt } }).returning({ id: media.id, titleOverride:media.titleOverride, animationOverride:media.animationOverride });
  return { ...result, mediaId: saved.id, titleOverride:saved.titleOverride, animationOverride:saved.animationOverride };
}

export async function catalogLookups(type:MediaType) {
  const schema=z.object({genres:z.array(z.object({id:z.number(),name:z.string()}))});
  return cached(`tmdb:genres:${type}:ru`,86400000,value=>schema.parse(value),()=>tmdbRequest(`genre/${type}/list`,{}),fallbackAllowed);
}
export async function searchPeople(query:string,page:number) {
  const schema=z.object({page:z.number(),total_pages:z.number(),results:z.array(z.object({id:z.number().int(),name:z.string(),known_for_department:z.string().optional()}))});
  return cached(createHash("sha256").update(`person:${query}:${page}:ru`).digest("hex"),900000,value=>schema.parse(value),()=>tmdbRequest("search/person",{query,page:String(page),include_adult:"false"}),fallbackAllowed);
}
export async function personCredits(personId:number,type:MediaType) {
  const schema=z.object({cast:z.array(tmdbItemSchema),crew:z.array(tmdbItemSchema.safeExtend({job:z.string().optional()}))});
  const result=await cached(`tmdb:person:${personId}:${type}:ru`,86400000,value=>schema.parse(value),()=>tmdbRequest(`person/${personId}/${type==="movie"?"movie_credits":"tv_credits"}`,{}),fallbackAllowed);
  const unique=new Map([...result.data.cast,...result.data.crew.filter(item=>item.job==="Director"||item.job==="Creator")].filter(item=>!item.adult).map(item=>[item.id,item]));
  return [...unique.values()].sort((a,b)=>(b.release_date||b.first_air_date||"").localeCompare(a.release_date||a.first_air_date||""));
}
