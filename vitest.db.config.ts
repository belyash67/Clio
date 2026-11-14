import { config } from "dotenv";
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

config({ path: ".env.local", quiet: true });
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["tests/**/*.integration.ts"], testTimeout: 30000 },
});
