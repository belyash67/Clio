import { readFile } from "node:fs/promises";
import { lookup } from "node:dns/promises";
import { parse } from "dotenv";
import { requestTmdbJson, requestTmdbPoster } from "../src/server/integrations/tmdb-http.mjs";

async function check() {
  const env = parse(await readFile(".env.local", "utf8"));
  const token = env.TMDB_READ_ACCESS_TOKEN?.trim();
  if (!token) {
    console.error("В сохранённом .env.local нет TMDB_READ_ACCESS_TOKEN.");
    process.exitCode = 1;
    return;
  }
  const addresses = await lookup("api.themoviedb.org", { all: true });
  const dnsMode = env.TMDB_DNS_MODE || "system";
  if (!["system", "https"].includes(dnsMode)) throw new Error("INVALID_DNS_MODE");
  if (addresses.some(({ address }) => /^(127\.|0\.|::1$)/.test(address))) {
    if (dnsMode === "system") {
      console.error("DNS TMDB указывает на локальный компьютер. Запрос до TMDB не дойдёт; проверить токен пока невозможно.");
      process.exitCode = 1;
      return;
    }
    console.log("Системный DNS возвращает локальный адрес; для API выбран DNS по HTTPS.");
  } else {
    console.log("DNS TMDB: локального перенаправления нет.");
  }
  const url = new URL("https://api.themoviedb.org/3/search/movie");
  url.search = new URLSearchParams({ query: "Interstellar", language: "ru-RU", include_adult: "false" }).toString();
  const response = await requestTmdbJson(url, token, dnsMode);
  if (response.status < 200 || response.status >= 300) {
    console.error(response.status === 401 || response.status === 403
      ? `TMDB отклонил доступ (HTTP ${response.status}). Проверь токен и статус Developer Plan.`
      : `TMDB вернул HTTP ${response.status}.`);
    process.exitCode = 1;
    return;
  }
  const result = response.data;
  if (!Array.isArray(result.results)) throw new Error("UNEXPECTED_RESPONSE");
  console.log(`TMDB API работает, токен принят. Результатов поиска: ${result.results.length}.`);
  const path = result.results.find((item) => typeof item.poster_path === "string" && /^\/[a-zA-Z0-9._-]+$/.test(item.poster_path))?.poster_path;
  if (path) {
    try {
      const poster = await requestTmdbPoster(path.slice(1), dnsMode);
      console.log(`Сервер получил настоящий постер TMDB (${poster.contentType}, ${poster.body.length} байт).`);
    } catch {
      console.error("API работает, но серверное получение постера не удалось.");
      process.exitCode = 1;
    }
  }
}

check().catch((error) => {
  const code = error?.cause?.code ?? error?.code ?? error?.name;
  const known = new Set(["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "ECONNRESET", "TimeoutError", "AbortError", "ENOENT"]);
  console.error(`Проверка TMDB не завершена (${known.has(code) ? code : "NETWORK_OR_RESPONSE_ERROR"}). Токен не выводится.`);
  process.exitCode = 1;
});
