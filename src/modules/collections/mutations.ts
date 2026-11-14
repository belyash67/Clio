import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { collectionMedia, collections } from "@/server/db/schema";
import { type Context, id, text, value, must } from "@/modules/social/common";

export async function collectionMutation(ctx: Context, op: string, data: FormData) {
  const { db, uid } = ctx;
  if (op === "collection-create") {
    const [row] = await db.insert(collections).values({ userId: uid, title: text(data, "title", 100), description: text(data, "description", 2000, 0), public: data.has("public") }).returning();
    return `/collections/${row.id}`;
  }
  const cid = id(data, "collectionId");
  await db.transaction(async (tx) => {
    const [owned] = await tx.select().from(collections).where(and(eq(collections.id, cid), eq(collections.userId, uid))).for("update");
    must(owned);
    if (op === "collection-save") {
      await tx.update(collections).set({ title: text(data, "title", 100), description: text(data, "description", 2000, 0), public: data.has("public"), updatedAt: new Date() }).where(eq(collections.id, cid));
    } else if (op === "collection-delete") {
      await tx.delete(collections).where(eq(collections.id, cid));
    } else {
      const mid = id(data, "mediaId");
      if (op === "collection-add") {
        const last = await tx.execute<{ position: number }>(sql`select coalesce(max(position), -1)::int + 1 as position from collection_media where collection_id = ${cid}`);
        await tx.insert(collectionMedia).values({ collectionId: cid, mediaId: mid, position: last.rows[0].position }).onConflictDoNothing();
      } else if (op === "collection-remove") {
        await tx.delete(collectionMedia).where(and(eq(collectionMedia.collectionId, cid), eq(collectionMedia.mediaId, mid)));
      } else if (op === "collection-move") {
        const direction = value(data, "direction"); must(direction === "up" || direction === "down");
        const items = await tx.select().from(collectionMedia).where(eq(collectionMedia.collectionId, cid)).orderBy(collectionMedia.position);
        const at = items.findIndex((item) => item.mediaId === mid); const next = at + (direction === "up" ? -1 : 1);
        must(at >= 0 && next >= 0 && next < items.length);
        await tx.update(collectionMedia).set({ position: -1 }).where(and(eq(collectionMedia.collectionId, cid), eq(collectionMedia.mediaId, mid)));
        await tx.update(collectionMedia).set({ position: items[at].position }).where(and(eq(collectionMedia.collectionId, cid), eq(collectionMedia.mediaId, items[next].mediaId)));
        await tx.update(collectionMedia).set({ position: items[next].position }).where(and(eq(collectionMedia.collectionId, cid), eq(collectionMedia.mediaId, mid)));
      } else throw new Error("UNKNOWN_COLLECTION_ACTION");
      await tx.update(collections).set({ updatedAt: new Date() }).where(eq(collections.id, cid));
    }
  });
  return op === "collection-delete" ? "/collections" : undefined;
}
