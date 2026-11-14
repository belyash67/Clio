import { expect, it } from "vitest";
import { isPublicIpv4, requestTmdbJson } from "../src/server/integrations/tmdb-http.mjs";

it("не разрешает локальные и частные адреса из ответа DNS", () => {
  for (const ip of ["127.0.0.1", "0.0.0.0", "10.1.2.3", "192.168.1.1", "172.16.0.1", "169.254.169.254", "100.64.0.1", "224.0.0.1", "::1", "example.com"]) expect(isPublicIpv4(ip)).toBe(false);
  expect(isPublicIpv4("3.170.19.97")).toBe(true);
});

it("отклоняет посторонние адреса до отправки токена и до DNS-запроса", async () => {
  for (const target of ["http://api.themoviedb.org/3/movie/1", "https://external.invalid/3/movie/1", "https://api.themoviedb.org:444/3/movie/1", "https://user:password@api.themoviedb.org/3/movie/1", "https://api.themoviedb.org/other"]) {
    await expect(requestTmdbJson(new URL(target), "test-only-token", "https")).rejects.toThrow("INVALID_TMDB_TARGET");
  }
});
