"use server";
import { ZodError } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { memberContext } from "@/server/session";
import { libraryMutation } from "@/modules/library/mutations";
import { collectionMutation } from "@/modules/collections/mutations";
import { socialMutation } from "./mutations";
import { moderate } from "@/modules/moderation/mutations";
import { ActionError, limitAction, value, type AppDb } from "./common";
import {must,id,text} from "./common";
import {media,moderationActions,user,userRoles} from "@/server/db/schema";
import {eq} from "drizzle-orm";
import {z} from "zod";

export type ActionResult = { ok: boolean; message: string; href?: string };
export async function performAction(_previous: ActionResult, data: FormData): Promise<ActionResult> {
  const ctx = await memberContext();
  let href: string | undefined;
  try {
    await limitAction(ctx);
    href = await ctx.db.transaction(async (tx) => {
      const context = { ...ctx, db: tx as unknown as AppDb }; const op = value(data, "op");
      if (["library-save", "library-delete", "rating-save", "watch-add", "watch-edit", "watch-delete", "review-save", "review-delete"].includes(op)) return libraryMutation(context, op, data);
      else if (op.startsWith("collection-")) return collectionMutation(context, op, data);
      else if (op === "moderate") await moderate(context, data);
      else if(op==="admin-role") {
        must(context.admin);const target=value(data,"targetId");must(target!==context.uid,"Нельзя менять собственную роль.");
        const role=z.enum(["user","admin"]).parse(value(data,"role"));
        must((await context.db.select({id:user.id}).from(user).where(eq(user.id,target))).length);
        await context.db.insert(userRoles).values({userId:target,role}).onConflictDoUpdate({target:userRoles.userId,set:{role}});
        await context.db.insert(moderationActions).values({userId:context.uid,action:`role:${role}:${target}`});
      }
      else if (op === "catalog-edit") {
        must(context.admin);
        const override=z.enum(["","none","animation","anime"]).parse(value(data,"animationOverride"))||null;
        await context.db.update(media).set({titleOverride:text(data,"titleOverride",200,0)||null,animationOverride:override}).where(eq(media.id,id(data,"mediaId")));
        await context.db.insert(moderationActions).values({userId:context.uid,action:"catalog-edit"});
      }
      else await socialMutation(context, op, data);
    });
  } catch (error) {
    return { ok: false, message: error instanceof ActionError ? error.message : error instanceof ZodError ? "Проверь поля формы." : "Не удалось сохранить. Проверь данные и попробуй позже." };
  }
  revalidatePath("/", "layout");
  // Navigate on the server before revalidation can unmount the deleted page's form.
  if(href) redirect(href);
  return { ok: true, message: "Сохранено." };
}
