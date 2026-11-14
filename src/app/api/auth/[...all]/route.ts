import { getAuth } from "@/server/auth";
import { isConfigured } from "@/server/config";
import { publicAccessPaused } from "@/lib/public-access";

export const runtime = "nodejs";
async function handler(request: Request) {
  if (publicAccessPaused()) return Response.json({ message: "Работа с аккаунтами временно приостановлена." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  if (!isConfigured()) return Response.json({ message: "Регистрация и вход пока недоступны: сервер не настроен." }, { status: 503 });
  return getAuth().handler(request);
}
export { handler as GET, handler as POST };
