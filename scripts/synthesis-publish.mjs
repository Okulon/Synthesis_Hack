#!/usr/bin/env node
/**
 * POST publish on the Synthesis / Devfolio project.
 *
 *   node scripts/synthesis-publish.mjs
 *
 * Loads `SYNTHESIS_API_KEY` from repo-root `.env` (simple KEY=value lines).
 */
import fs from "fs";
import path from "path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const envPath = path.join(root, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

const base = process.env.SYNTHESIS_BASE_URL || "https://synthesis.devfolio.co";
const key = process.env.SYNTHESIS_API_KEY;
const projectUuid =
  process.env.SYNTHESIS_PROJECT_UUID || "038081098f4a4a758268ad23834672bd";

if (!key) {
  console.error("Missing SYNTHESIS_API_KEY in .env");
  process.exit(1);
}

const res = await fetch(`${base}/projects/${projectUuid}/publish`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: "{}",
});

const text = await res.text();
if (res.status === 409) {
  try {
    const j = JSON.parse(text);
    if (String(j.error || "").toLowerCase().includes("already published")) {
      console.log("OK — project is already published (409).");
      process.exit(0);
    }
  } catch {
    /* fall through */
  }
}
if (!res.ok) {
  console.error(res.status, text);
  process.exit(1);
}
let out;
try {
  out = JSON.parse(text);
} catch {
  console.log("OK — raw:", text);
  process.exit(0);
}
console.log("OK — status:", out.status ?? out.publishStatus ?? JSON.stringify(out).slice(0, 200));
