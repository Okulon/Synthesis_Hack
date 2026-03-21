/**
 * Writes frontend/public/cycle-profits.json from cycle-close-log + vote-store + trust CSV.
 * Run: cd apps/agent && npm run profit:export
 */
import { repoRoot } from "./lib/env.mjs";
import { writeCycleProfitsArtifact } from "./lib/profitExportCore.mjs";
import path from "path";

const dest = writeCycleProfitsArtifact();
console.log(`Wrote ${path.relative(repoRoot, dest)}`);
