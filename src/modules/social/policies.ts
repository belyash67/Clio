import { sql, type SQL } from "drizzle-orm";

export function visibleTo(owner: SQL, level: SQL, viewer: string) {
  return sql`(${owner} = ${viewer} or ${level} = 'public' or (${level} = 'friends' and exists (select 1 from friendships f where f.low_id = least(${owner}, ${viewer}) and f.high_id = greatest(${owner}, ${viewer}) and f.status = 'accepted')))`;
}
export function profileAudience(owner: SQL, level: SQL, viewer: string) {
  // Confirmed friends can always open a profile, including legacy private settings.
  return visibleTo(owner, sql`case when ${level} = 'public' then 'public' else 'friends' end`, viewer);
}
export function profileVisible(viewer: string) {
  return sql`(u.blocked_at is null and ${profileAudience(sql`u.id`, sql`s.profile_visibility`, viewer)})`;
}
export function contentVisible(viewer: string, level: SQL) {
  return sql`(${profileVisible(viewer)} and ${visibleTo(sql`u.id`, level, viewer)})`;
}
