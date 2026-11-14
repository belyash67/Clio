"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { memberContext } from "@/server/session";
import { userSettings } from "@/server/db/schema";

export async function savePreferences(input:unknown) {
  const ctx=await memberContext();
  const data=z.object({language:z.enum(["ru","en","de"]),notificationsEnabled:z.boolean()}).strict().safeParse(input);
  if(!data.success)return {ok:false,message:"Проверь настройки."};
  await ctx.db.insert(userSettings).values({userId:ctx.uid,...data.data}).onConflictDoUpdate({target:userSettings.userId,set:data.data});
  (await cookies()).set("clio-language",data.data.language,{sameSite:"lax",httpOnly:false,secure:process.env.NODE_ENV==="production",path:"/",maxAge:31536000});
  revalidatePath("/","layout");
  return {ok:true,message:"Настройки сохранены."};
}
