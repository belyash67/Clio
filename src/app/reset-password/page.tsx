import { AuthForm } from "@/modules/auth/auth-form";
import { isConfigured } from "@/server/config";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return <AuthForm mode="reset" ready={isConfigured()} token={typeof params.token === "string" ? params.token : undefined} />;
}
