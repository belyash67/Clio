
import { I18nText } from "@/components/i18n";
import { AuthForm } from "@/modules/auth/auth-form";
import { isConfigured } from "@/server/config";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return <>{params.verified === "1" && <p className="notice" style={{ margin: "24px auto 0" }}><I18nText text={"Ссылка подтверждения обработана. Попробуй войти."}/></p>}{params.reset === "1" && <p className="notice" style={{ margin: "24px auto 0" }}><I18nText text={"Пароль изменён. Войди с новым паролем."}/></p>}<AuthForm mode="login" ready={isConfigured()} /></>;
}
