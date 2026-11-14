import https from "node:https";
import { isIPv4 } from "node:net";

const resolved = new Map();
const resolving = new Map();

export function isPublicIpv4(address) {
  if (!isIPv4(address)) return false;
  const [a, b] = address.split(".").map(Number);
  return a > 0 && a < 224 && a !== 10 && a !== 127
    && !(a === 100 && b >= 64 && b <= 127)
    && !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31)
    && !(a === 192 && [0, 168].includes(b)) && !(a === 198 && [18, 19].includes(b));
}

async function resolveTmdbHost(hostname) {
  if (!["api.themoviedb.org", "image.tmdb.org"].includes(hostname)) throw new Error("INVALID_TMDB_TARGET");
  const saved = resolved.get(hostname);
  if (saved && saved.expiresAt > Date.now()) return saved.address;
  if (resolving.has(hostname)) return resolving.get(hostname);
  const task = (async () => {
    // Only the fixed public hostname is sent to DNS. No token, titles or user data.
    const response = await fetch(`https://dns.google/resolve?name=${hostname}&type=A&edns_client_subnet=0.0.0.0%2F0`, {
      signal: AbortSignal.timeout(8000), cache: "no-store", redirect: "error",
    });
    if (!response.ok) throw new Error("DNS_UNAVAILABLE");
    const data = await response.json();
    const answer = data.Status === 0 && Array.isArray(data.Answer)
      ? data.Answer.find((item) => item.type === 1 && typeof item.data === "string" && isPublicIpv4(item.data)) : undefined;
    if (!answer) throw new Error("DNS_NO_PUBLIC_ADDRESS");
    const ttl = Number.isFinite(answer.TTL) ? Math.max(1, Math.min(60, answer.TTL)) : 30;
    resolved.set(hostname, { address: answer.data, expiresAt: Date.now() + ttl * 1000 });
    return answer.data;
  })();
  resolving.set(hostname, task);
  try { return await task; } finally { resolving.delete(hostname); }
}

async function readHttps(url, headers, dnsMode) {
  if (!["system", "https"].includes(dnsMode)) throw new Error("INVALID_DNS_MODE");
  const address = dnsMode === "https" ? await resolveTmdbHost(url.hostname) : undefined;
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers,
      signal: AbortSignal.timeout(10000),
      // Keep the original host and SNI. Certificate verification remains enabled.
      ...(address ? { lookup: (_hostname, options, callback) => options.all
        ? callback(null, [{ address, family: 4 }]) : callback(null, address, 4) } : {}),
    }, (response) => {
      const chunks = [];
      let bytes = 0;
      response.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > 2 * 1024 * 1024) { response.destroy(new Error("RESPONSE_TOO_LARGE")); return; }
        chunks.push(chunk);
      });
      response.on("error", reject);
      response.on("end", () => {
        const status = response.statusCode ?? 502;
        resolve({ status, body: Buffer.concat(chunks) });
      });
    });
    request.on("error", reject);
  });
}

export async function requestTmdbJson(url, token, dnsMode = "system") {
  if (!(url instanceof URL) || url.protocol !== "https:" || url.hostname !== "api.themoviedb.org"
      || (url.port && url.port !== "443") || url.username || url.password || !url.pathname.startsWith("/3/")) {
    throw new Error("INVALID_TMDB_TARGET");
  }
  const response = await readHttps(url, { Authorization: `Bearer ${token}`, Accept: "application/json" }, dnsMode);
  if (response.status < 200 || response.status >= 300) return { status: response.status, data: null };
  return { status: response.status, data: JSON.parse(response.body.toString("utf8")) };
}

export function isPosterFilename(filename) {
  return typeof filename === "string" && /^[a-zA-Z0-9_-]{1,128}\.(?:jpg|jpeg|png|webp)$/.test(filename);
}

export function detectPosterType(body) {
  if (body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) return "image/jpeg";
  if (body.length >= 8 && body.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (body.length >= 12 && body.subarray(0, 4).toString() === "RIFF" && body.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

export async function requestTmdbPoster(filename, dnsMode = "system") {
  if (!isPosterFilename(filename)) throw new Error("INVALID_POSTER_PATH");
  // This endpoint accepts a filename, never an arbitrary URL, and sends no API token.
  const response = await readHttps(new URL(`https://image.tmdb.org/t/p/w500/${filename}`), { Accept: "image/jpeg,image/png,image/webp" }, dnsMode);
  if (response.status !== 200) throw new Error(response.status === 404 ? "POSTER_NOT_FOUND" : "POSTER_UNAVAILABLE");
  const contentType = detectPosterType(response.body);
  if (!contentType) throw new Error("INVALID_POSTER_CONTENT");
  return { body: response.body, contentType };
}
