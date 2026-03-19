import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Repo root (…/apps/agent/src/lib -> ../../../../) */
export const repoRoot = path.resolve(__dirname, "../../../..");

dotenv.config({ path: path.join(repoRoot, ".env") });

export function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name} (set in repo root .env)`);
  return v;
}
