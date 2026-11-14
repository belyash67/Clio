import { AuthForm } from "@/modules/auth/auth-form";
import { isConfigured } from "@/server/config";
export const dynamic = "force-dynamic";
export default function Page() { return <AuthForm mode="register" ready={isConfigured()} />; }
