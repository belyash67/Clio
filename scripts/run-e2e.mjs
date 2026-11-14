// Launch the real application against a disposable schema. Never seed public.users.
import { readFile, mkdir, open } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { spawn, execFile } from "node:child_process";
import { createServer } from "node:net";
import { parse } from "dotenv";
import { Client } from "pg";

const local = parse(await readFile(".env.local", "utf8"));
const namespace = `clio_e2e_${randomUUID().replaceAll("-", "")}`;
if (!/^clio_e2e_[a-f0-9]{32}$/.test(namespace)) throw new Error("Invalid test schema");
const client = new Client({ connectionString: local.DATABASE_URL, connectionTimeoutMillis: 5000 });
let created = false, server, log;
try {
  await client.connect();
  await client.query(`CREATE SCHEMA "${namespace}"`); created = true;
  await client.query(`SET search_path TO "${namespace}", public`);
  const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
  for (const { tag } of journal.entries) {
    await client.query((await readFile(`drizzle/${tag}.sql`, "utf8")).replaceAll('"public".', `"${namespace}".`));
  }
  const port = await new Promise((resolve, reject) => {
    const probe = createServer(); probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => { const port = probe.address().port; probe.close(() => resolve(port)); });
  });
  const baseURL = `http://127.0.0.1:${port}`;
  const dbURL = new URL(local.DATABASE_URL); dbURL.searchParams.set("options", `-c search_path=${namespace},public`);
  const env = { ...process.env, ...local, NODE_ENV: "development", CLIO_E2E: "1", CLIO_E2E_URL: baseURL,
    CLIO_E2E_SCHEMA: namespace, CLIO_E2E_PASSWORD: randomUUID(), DATABASE_URL: dbURL.href,
    CLIO_E2E_CHANNEL: process.env.CLIO_E2E_CHANNEL ?? (existsSync("C:/Program Files/Google/Chrome/Application/chrome.exe") ? "chrome" : ""),
    BETTER_AUTH_URL: baseURL, BETTER_AUTH_SECRET: randomUUID()+randomUUID(),
    SMTP_HOST: "127.0.0.1", SMTP_PORT: "587", SMTP_USER: "qa", SMTP_PASSWORD: randomUUID(), SMTP_FROM: "qa@example.invalid" };
  await mkdir(".e2e-output", { recursive: true }); log = await open(".e2e-output/server.log", "w");
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)], { env, windowsHide: true, stdio: ["ignore", log.fd, log.fd] });
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    if (server.exitCode !== null) throw new Error("Test application exited before startup");
    try { ready = (await fetch(baseURL+"/login", { signal: AbortSignal.timeout(2000) })).ok; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error("Test application did not start; inspect .e2e-output/server.log locally");
  console.log("Isolated Clio test application is ready; personal accounts are not used.");
  const runner = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)], { env, windowsHide: true, stdio: "inherit" });
  process.exitCode = await new Promise((resolve, reject) => { runner.once("error", reject); runner.once("exit", code => resolve(code ?? 1)); });
} catch (error) {
  console.error("E2E run failed:", error instanceof Error ? error.name : "Unknown error"); process.exitCode = 1;
} finally {
  if (server?.pid && server.exitCode === null) {
    if (process.platform === "win32") await new Promise(resolve => execFile("taskkill", ["/PID", String(server.pid), "/T", "/F"], { windowsHide: true }, () => resolve()));
    else server.kill("SIGTERM");
  }
  await log?.close();
  if (created) await client.query(`DROP SCHEMA "${namespace}" CASCADE`);
  await client.end();
}
