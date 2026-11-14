import { cp, mkdir, readFile, readdir, lstat, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const workspace = await realpath(process.cwd());
const destination = path.resolve(workspace, ".runtime/hosted-release");
if (path.dirname(destination) !== path.join(workspace, ".runtime")) throw new Error("Invalid release directory");
try {
  const info = await lstat(destination);
  if (info.isSymbolicLink() || await realpath(destination) !== destination) throw new Error("Release directory must not be a link");
  if (await readFile(path.join(destination, ".clio-generated"), "utf8") !== "Clio generated release\n") throw new Error("Existing directory is not a generated release");
  await rm(destination, { recursive: true });
} catch (error) { if (error.code !== "ENOENT") throw error; }
await mkdir(destination, { recursive: true });
await writeFile(path.join(destination, ".clio-generated"), "Clio generated release\n");
await cp(".next/standalone", destination, {
  recursive: true, dereference: true,
  filter: source => !path.basename(source).startsWith(".env"),
});
await cp(".next/static", path.join(destination, ".next/static"), { recursive: true });
await cp("public", path.join(destination, "public"), { recursive: true });

// Windows builds contain Windows image binaries; install matching Linux binaries separately.
for (const name of ["sharp-linux-x64", "sharp-libvips-linux-x64"]) {
  const source = path.join(".runtime/native-linux/node_modules/@img", name);
  const sourceInfo = JSON.parse(await readFile(path.join(source, "package.json"), "utf8"));
  const sharp = JSON.parse(await readFile("node_modules/sharp/package.json", "utf8"));
  if (sourceInfo.version !== sharp.optionalDependencies["@img/" + name]) throw new Error("Linux image module version mismatch");
  await cp(source, path.join(destination, "node_modules/@img", name), { recursive: true, dereference: true });
}
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".env")) throw new Error("Environment files must not be packaged");
    if (entry.isSymbolicLink()) throw new Error("Release must not contain nonportable links");
    if (entry.isDirectory()) await check(path.join(directory, entry.name));
  }
}
await check(destination);
console.log("Linux server package prepared without environment files: .runtime/hosted-release");
