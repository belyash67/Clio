import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { contentVisible, profileVisible } from "./policies";

export type MediaRow = { mediaId: string; type: string; tmdbId: number; title: string; posterPath: string | null; status?: string | null; favorite?: boolean; score?: number | null };
export type ReviewRow = MediaRow & { id: string; userId: string; username: string; badge?:boolean; name: string; body: string; spoiler: boolean; visibility: string; createdAt: Date; likes: number; liked: boolean };
export const mediaColumns = sql`m.id as "mediaId", m.tmdb_media_type as type, m.tmdb_id as "tmdbId", coalesce(nullif(m.title_override,''),nullif(m.title,''),m.original_title) as title, m.poster_path as "posterPath"`;
export function pageNumber(raw: unknown) { const n = Number(raw); return Number.isInteger(n) && n > 0 && n <= 10000 ? n : 1; }

export async function libraryRows(owner: string, viewer: string, page = 1, q = "", status = "", favorites = false, sort = "recent") {
  const order=sort==="title"?sql`lower(coalesce(nullif(m.title_override,''),nullif(m.title,''),m.original_title)),l.media_id`:sort==="rating"?sql`r.score desc nulls last,l.updated_at desc,l.media_id`:sort==="status"?sql`l.status nulls last,l.updated_at desc,l.media_id`:sql`l.updated_at desc,l.media_id`;
  return (await getDb().execute<MediaRow>(sql`select ${mediaColumns}, l.status, l.favorite, r.score from user_library l join media m on m.id=l.media_id join users u on u.id=l.user_id left join user_settings s on s.user_id=u.id left join ratings r on r.user_id=l.user_id and r.media_id=l.media_id where l.user_id=${owner} and ${contentVisible(viewer, sql`coalesce(s.library_visibility,'private')`)} and (${q}='' or concat(m.title,' ',m.original_title) ilike ${`%${q.slice(0,120)}%`}) and (${status}='' or l.status=${status}) and (${!favorites} or l.favorite) order by ${order} limit 24 offset ${(page-1)*24}`)).rows;
}
export async function visibleReviews(viewer: string, filter: { mediaId?: string; userId?: string; id?: string } = {}, page = 1) {
  return (await getDb().execute<ReviewRow>(sql`select r.id, r.user_id as "userId", u.username,u.personal_badge as badge, u.name, r.body, r.spoiler, r.visibility, r.created_at as "createdAt", ${mediaColumns}, (select count(*)::int from review_likes k where k.review_id=r.id) as likes, exists(select 1 from review_likes k where k.review_id=r.id and k.user_id=${viewer}) as liked from reviews r join media m on m.id=r.media_id join users u on u.id=r.user_id left join user_settings s on s.user_id=u.id where not r.hidden and ${contentVisible(viewer, sql`r.visibility`)} ${filter.mediaId ? sql`and r.media_id=${filter.mediaId}` : sql``} ${filter.userId ? sql`and r.user_id=${filter.userId}` : sql``} ${filter.id ? sql`and r.id=${filter.id}` : sql``} order by r.created_at desc,r.id limit 12 offset ${(page-1)*12}`)).rows;
}
export type CollectionRow = { id: string; userId: string; username: string; badge?:boolean; title: string; description: string; public: boolean; count: number };
export async function collectionRows(owner: string, viewer: string, page = 1) {
  return (await getDb().execute<CollectionRow>(sql`select c.id,c.user_id as "userId",u.username,u.personal_badge as badge,c.title,c.description,c.public,(select count(*)::int from collection_media cm where cm.collection_id=c.id) as count from collections c join users u on u.id=c.user_id left join user_settings s on s.user_id=u.id where c.user_id=${owner} and ${profileVisible(viewer)} and (c.user_id=${viewer} or c.public) order by c.updated_at desc,c.id limit 24 offset ${(page-1)*24}`)).rows;
}

export async function feedRows(viewer: string, page: number) {
  const activity = contentVisible(viewer, sql`coalesce(s.activity_visibility,'private')`);
  return (await getDb().execute<MediaRow & { userId: string; username: string; badge?:boolean; kind: string; createdAt: Date; id: string }>(sql`
    select * from (
      select r.id::text as id,r.user_id as "userId",u.username,u.personal_badge as badge,'review' as kind,r.updated_at as "createdAt",${mediaColumns} from reviews r join media m on m.id=r.media_id join users u on u.id=r.user_id left join user_settings s on s.user_id=u.id where not r.hidden and ${activity} and ${contentVisible(viewer, sql`r.visibility`)}
      union all
      select r.media_id::text||r.user_id,r.user_id,u.username,u.personal_badge as badge,'rating',r.updated_at,${mediaColumns} from ratings r join media m on m.id=r.media_id join users u on u.id=r.user_id left join user_settings s on s.user_id=u.id where ${activity} and ${contentVisible(viewer, sql`coalesce(s.library_visibility,'private')`)}
      union all
      select w.id::text,w.user_id,u.username,u.personal_badge as badge,'watch',w.created_at,${mediaColumns} from watch_history w join media m on m.id=w.media_id join users u on u.id=w.user_id left join user_settings s on s.user_id=u.id where ${activity} and ${contentVisible(viewer, sql`coalesce(s.library_visibility,'private')`)}
      union all
      select c.id::text,c.user_id,u.username,u.personal_badge as badge,'collection',c.updated_at,null::uuid,null::text,null::integer,c.title,null::text from collections c join users u on u.id=c.user_id left join user_settings s on s.user_id=u.id where ${activity} and (c.user_id=${viewer} or c.public)
    ) entries where "userId"=${viewer} or exists(select 1 from friendships f where f.low_id=least(entries."userId",${viewer}) and f.high_id=greatest(entries."userId",${viewer}) and f.status='accepted') order by "createdAt" desc,id limit 24 offset ${(page-1)*24}`)).rows;
}
