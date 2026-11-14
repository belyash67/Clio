// Verify an owned encrypted export in disposable schemas, never public or live data.
import { readFile, writeFile } from "node:fs/promises";
import { createDecipheriv, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { config } from "dotenv";
import pg from "pg";

const base = process.argv[2];
if (!base || !/^\.runtime\/legal-backup-\d{8}-[a-f0-9]{8}$/.test(base)) throw new Error("Expected an owned legal backup base path");
config({ path: ".env.local", quiet: true });
const database = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1', '[::1]'].includes(database.hostname) || database.pathname !== "/clio") throw new Error("Restore verification requires local Clio");
const unprotect = "Add-Type -AssemblyName System.Security; $clioBytes=[Convert]::FromBase64String([Console]::In.ReadToEnd().Trim()); [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Unprotect($clioBytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))";
const key = Buffer.from(execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", unprotect], { input: await readFile(base + ".dpapi", "utf8"), encoding: "utf8", windowsHide: true }).trim(), "base64");
const encrypted = await readFile(base + ".enc");
const magic = Buffer.from("CLIOBACKUP1\n");
if (!encrypted.subarray(0, magic.length).equals(magic)) throw new Error("Unknown backup format");
const decrypt = createDecipheriv("aes-256-gcm", key, encrypted.subarray(magic.length, magic.length + 12));
decrypt.setAuthTag(encrypted.subarray(magic.length + 12, magic.length + 28));
const dump = Buffer.concat([decrypt.update(encrypted.subarray(magic.length + 28)), decrypt.final()]);
const binary = "C:/Program Files/PostgreSQL/18/bin/";
const sql = execFileSync(binary + "pg_restore.exe", ["--no-owner", "--no-privileges", "--file=-"], { input: dump, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] });
const namespace = "clio_legal_verify_" + randomUUID().replaceAll("-", "");
const meta = namespace + "_meta";
if (!/^clio_legal_verify_[a-f0-9]{32}$/.test(namespace)) throw new Error("Invalid disposable schema");
let copying = false;
const mapped = sql.split("\n").map(line => {
  if (copying) { if (line === "\\.") copying = false; return line; }
  if (/^(DROP |CREATE DATABASE |ALTER DATABASE |\\connect)/i.test(line)) throw new Error("Unexpected restore command");
  const result = line.replace(/^CREATE SCHEMA public;/, `CREATE SCHEMA "${namespace}";`).replace(/^CREATE SCHEMA drizzle;/, `CREATE SCHEMA "${meta}";`).replace(/^COMMENT ON SCHEMA public /, `COMMENT ON SCHEMA "${namespace}" `).replace(/^COMMENT ON SCHEMA drizzle /, `COMMENT ON SCHEMA "${meta}" `).replace(/\bpublic\./g, `"${namespace}".`).replace(/\bdrizzle\./g, `"${meta}".`);
  if (/^COPY /.test(line) && / FROM stdin;$/.test(line)) copying = true;
  return result;
}).join("\n");
if (copying) throw new Error("Incomplete COPY data");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const env = { ...process.env, PGHOST: database.hostname, PGPORT: database.port || "5432", PGUSER: decodeURIComponent(database.username), PGPASSWORD: decodeURIComponent(database.password), PGDATABASE: "clio" };
  try { execFileSync(binary + "psql.exe", ["--no-psqlrc", "--quiet", "--single-transaction", "--set=ON_ERROR_STOP=1"], { input: mapped, env, stdio: ["pipe", "ignore", "pipe"], maxBuffer: 1024 * 1024 }); }
  catch { throw new Error("Disposable restore failed; transaction rolled back"); }
  await client.query("set time zone 'UTC'");
  const manifest = JSON.parse(await readFile(base + ".manifest.json", "utf8"));
  for (const entry of manifest) {
    if (!['public', 'drizzle'].includes(entry.schema) || !/^[a-z_]+$/.test(entry.table)) throw new Error("Invalid manifest");
    const schema = entry.schema === "public" ? namespace : meta;
    const { rows: [actual] } = await client.query(`select count(*)::int as count, md5(coalesce(string_agg(md5(row_to_json(t)::text),'' order by md5(row_to_json(t)::text)),'')) as digest from "${schema}"."${entry.table}" t`);
    if (actual.count !== entry.count || actual.digest !== entry.digest) throw new Error("Restored data mismatch");
  }
  const report = { restored: true, tables: manifest.length, users: manifest.find(table => table.table === "users")?.count, liveTablesModified: false };
  await writeFile(base + ".verification.json", JSON.stringify(report), { mode: 0o600 });
  console.log(JSON.stringify(report));
} finally {
  // Names are generated and validated above; neither statement can name public/drizzle.
  await client.query(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`);
  await client.query(`DROP SCHEMA IF EXISTS "${meta}" CASCADE`);
  await client.end(); key.fill(0); dump.fill(0);
}
