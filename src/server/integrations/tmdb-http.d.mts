export function isPublicIpv4(address: string): boolean;
export function requestTmdbJson(url: URL, token: string, dnsMode?: "system" | "https"): Promise<{ status: number; data: unknown }>;
export function isPosterFilename(filename: string): boolean;
export function detectPosterType(body: Buffer): string | null;
export function requestTmdbPoster(filename: string, dnsMode?: "system" | "https"): Promise<{ body: Buffer; contentType: string }>;
