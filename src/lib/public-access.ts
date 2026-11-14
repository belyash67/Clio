type Environment = Record<string, string | undefined>;

// Public accounts stay closed unless an operator explicitly approves reopening.
// This flag is an operational lock, not evidence of legal compliance.
export function publicAccessPaused(env: Environment = process.env, now = Date.now()) {
  if (env.NODE_ENV !== "production") return false;
  if (env.CLIO_PUBLIC_ACCOUNTS_ENABLED !== "true") return true;
  const parse = (value: string | undefined) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/.test(value)) return NaN;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value ? timestamp : NaN;
  };
  const start = parse(env.CLIO_ACCESS_STARTS_AT);
  const end = parse(env.CLIO_ACCESS_ENDS_AT);
  const maxDuration = 31 * 24 * 60 * 60 * 1000;
  return !Number.isFinite(now) || !Number.isFinite(start) || !Number.isFinite(end)
    || end <= start || end - start > maxDuration || now < start || now >= end;
}
