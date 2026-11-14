import { createHash } from "node:crypto";
import { createPosterCache, PosterBusyError } from "@/modules/catalog/poster-cache";
import { isPosterFilename, requestTmdbPoster } from "@/server/integrations/tmdb-http.mjs";

export const runtime = "nodejs";
const getPoster = createPosterCache(async (filename) => {
  const mode = process.env.TMDB_DNS_MODE || "system";
  if (mode !== "system" && mode !== "https") throw new Error("INVALID_DNS_MODE");
  return requestTmdbPoster(filename, mode);
});

export async function GET(request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  if (!isPosterFilename(filename) || new URL(request.url).search) return new Response(null, { status: 400, headers: { "Cache-Control": "no-store" } });
  try {
    const image = await getPoster(filename);
    const etag = `"${createHash("sha256").update(image.body).digest("hex")}"`;
    const headers = { "Content-Type": image.contentType, "Cache-Control": "public, max-age=86400", ETag: etag, "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin" };
    if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
    return new Response(new Uint8Array(image.body), { headers });
  } catch (error) {
    const status = error instanceof PosterBusyError ? 429 : error instanceof Error && error.message === "POSTER_NOT_FOUND" ? 404 : 502;
    return new Response(null, { status, headers: { "Cache-Control": "no-store", ...(status === 429 ? { "Retry-After": "2" } : {}) } });
  }
}
