import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, lstatSync, existsSync } from "node:fs";
import { parse } from "dotenv";

// Never print file contents, matches, credentials or raw subprocess errors.
function git(args, input) {
  return execFileSync("git", args, { input, windowsHide: true, maxBuffer: 64 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] });
}
const secrets = new Set();
function remember(value) {
  if (typeof value !== "string" || value.length < 8) return;
  secrets.add(value);
  secrets.add(encodeURIComponent(value));
  try {
    const url = new URL(value);
    if (url.password.length >= 8) {
      secrets.add(url.password);
      secrets.add(decodeURIComponent(url.password));
    }
  } catch { /* Most secrets are not URLs. */ }
}
const patterns = [
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ["github-token", /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/],
  ["google-api-key", /\bAIza[0-9A-Za-z_-]{30,}/],
  ["jwt", /\beyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/],
  ["aws-access-key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
];
function privatePath(path) {
  return /(^|\/)\.env(?!\.example$)[^/]*$/.test(path)
    || /(^|\/)(?:\.runtime|\.next|\.next-e2e|\.e2e-output|test-results|playwright-report|backups|dumps)\//.test(path)
    || /^docs\/(?:legal\/|month-launch\.md$)/.test(path)
    || /(?:\.(?:pem|key|p12|pfx|dump|backup|sqlite3?|db|enc|dpapi|zip|tgz|tar|log)|\.tar\.gz|\.sql\.gz)$/.test(path)
    || /(^|\/)(?:\.npmrc|\.pgpass|\.netrc|id_rsa|id_ed25519)$/.test(path);
}
let findings = 0;
function report(location, kind) {
  console.error(JSON.stringify({ location, kind }));
  findings++;
}
function scan(location, buffer) {
  const content = buffer.toString("utf8");
  if ([...secrets].some(value => content.includes(value))) report(location, "known-local-secret");
  for (const [kind, pattern] of patterns) if (pattern.test(content)) report(location, kind);
}

try {
  for (const name of readdirSync(".").filter(name => name.startsWith(".env") && name !== ".env.example")) {
    if (!lstatSync(name).isFile()) continue;
    for (const [key, value] of Object.entries(parse(readFileSync(name)))) {
      if (/PASSWORD|SECRET|TOKEN|API_KEY|DATABASE_URL/i.test(key)) remember(value);
    }
  }
  if (existsSync(".runtime/hosting-state.json")) {
    const state = JSON.parse(readFileSync(".runtime/hosting-state.json", "utf8"));
    for (const [key, value] of Object.entries(state)) if (/password|secret|token|key/i.test(key)) remember(value);
  }
  const files = [...new Set(git(["ls-files", "--cached", "--others", "--exclude-standard", "-z"]).toString("utf8").split("\0").filter(Boolean))];
  for (const file of files) {
    if (privatePath(file)) report(file, "private-file-in-publication");
    if (!existsSync(file)) continue; // A staged version is still scanned below.
    const stat = lstatSync(file);
    if (!stat.isFile()) { report(file, "non-regular-file-needs-review"); continue; }
    if (stat.size > 16 * 1024 * 1024) { report(file, "large-file-needs-review"); continue; }
    scan(file, readFileSync(file));
  }
  const staged = git(["ls-files", "--stage", "-z"]).toString("utf8").split("\0").filter(Boolean);
  const ids = new Set(staged.map(entry => entry.split(" ")[1]));
  for (const line of git(["rev-list", "--objects", "--all"]).toString("utf8").trim().split("\n")) {
    if (line) ids.add(line.split(" ")[0]);
  }
  const info = git(["cat-file", "--batch-check"], [...ids].join("\n") + "\n").toString("utf8");
  const blobs = info.trim().split("\n").filter(line => line.split(" ")[1] === "blob").map(line => line.split(" ")[0]);
  const data = git(["cat-file", "--batch"], blobs.join("\n") + "\n");
  let cursor = 0;
  for (const id of blobs) {
    const newline = data.indexOf(10, cursor);
    if (newline < 0) throw new Error("Incomplete Git stream");
    const [actual, type, sizeText] = data.subarray(cursor, newline).toString("utf8").split(" ");
    const size = Number(sizeText);
    if (actual !== id || type !== "blob" || !Number.isSafeInteger(size) || size < 0 || newline + 1 + size >= data.length) throw new Error("Invalid Git stream");
    scan("index-or-history:" + id.slice(0, 12), data.subarray(newline + 1, newline + 1 + size));
    cursor = newline + 1 + size + 1;
  }
  console.log(JSON.stringify({ publicationFiles: files.length, indexAndHistoryBlobs: blobs.length, findings, localCredentialsAvailable: secrets.size > 0 }));
  console.log("Only known local secrets and selected credential formats are checked. Review filenames and personal information before publishing; ignored files must not be uploaded as a folder or archive.");
  if (findings) process.exitCode = 1;
} catch {
  console.error("Secret check could not complete. No credential values were printed. Check local file permissions and Git availability.");
  process.exitCode = 1;
}
