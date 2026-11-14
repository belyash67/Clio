import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { publicAccessPaused } from "../src/lib/public-access";
import { proxy } from "../src/proxy";
import { maintenanceHtml } from "../src/lib/maintenance-html";
import { readFile } from "node:fs/promises";

describe("пауза публичного сбора данных", () => {
  it("закрывает production по умолчанию и допускает локальную разработку", () => {
    expect(publicAccessPaused({ NODE_ENV: "production" })).toBe(true);
    expect(publicAccessPaused({ NODE_ENV: "production", CLIO_PUBLIC_ACCOUNTS_ENABLED: "false" })).toBe(true);
    expect(publicAccessPaused({ NODE_ENV: "production", CLIO_PUBLIC_ACCOUNTS_ENABLED: "TRUE" })).toBe(true);
    expect(publicAccessPaused({ NODE_ENV: "production", CLIO_PUBLIC_ACCOUNTS_ENABLED: "true" })).toBe(true);
    expect(publicAccessPaused({ NODE_ENV: "development" })).toBe(false);
  });
  it("открывает только согласованное окно до 31 дня и закрывает доступ точно в срок", () => {
    const env = { NODE_ENV: "production", CLIO_PUBLIC_ACCOUNTS_ENABLED: "true", CLIO_ACCESS_STARTS_AT: "2026-11-20T12:00:00.000Z", CLIO_ACCESS_ENDS_AT: "2026-12-20T12:00:00.000Z" };
    const start = Date.parse(env.CLIO_ACCESS_STARTS_AT), end = Date.parse(env.CLIO_ACCESS_ENDS_AT);
    expect(publicAccessPaused(env, start - 1)).toBe(true);
    expect(publicAccessPaused(env, start)).toBe(false);
    expect(publicAccessPaused(env, end - 1)).toBe(false);
    expect(publicAccessPaused(env, end)).toBe(true);
    for (const invalid of ["", "invalid", "2026-12-22T12:00:00.000Z", "2026-11-19T12:00:00.000Z", "2026-11-31T12:00:00.000Z"]) {
      expect(publicAccessPaused({ ...env, CLIO_ACCESS_ENDS_AT: invalid }, start)).toBe(true);
    }
    expect(publicAccessPaused(env, NaN)).toBe(true);
  });
  it("отсекает прямой auth API и Server Actions без разбора данных формы", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("CLIO_PUBLIC_ACCOUNTS_ENABLED", "false");
    try {
      for (const pathname of ["/api/auth/sign-up/email", "/api/auth/sign-in/email", "/settings", "/catalog/movie/1", "/icons/icon-192.png", "/maintenance/index.html"]) {
        const response = proxy(new NextRequest("https://clio.example" + pathname, { method: "POST", body: "not-json", headers: { "next-action": "old-action" } }));
        expect(response.status).toBe(503); expect(response.headers.get("Cache-Control")).toBe("no-store");
        expect(response.headers.get("x-middleware-next")).toBeNull();
      }
      const page = proxy(new NextRequest("https://clio.example/users/friend?secret=do-not-forward"));
      expect(page.status).toBe(503); expect(page.headers.get("x-middleware-rewrite")).toBeNull();
      expect(await page.text()).toBe(maintenanceHtml);
      expect(maintenanceHtml).not.toContain("do-not-forward");
    } finally { vi.unstubAllEnvs(); }
  });
  it("показывает одинаковый текст паузы в статической и серверной версиях", async () => {
    expect((await readFile("public/maintenance/index.html", "utf8")).replaceAll("\r\n", "\n")).toBe(maintenanceHtml);
  });
});
