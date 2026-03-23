#!/usr/bin/env node
/**
 * Push demo video URL to the Synthesis project.
 *
 *   VIDEO_URL='https://www.youtube.com/watch?v=...' node scripts/synthesis-set-video.mjs
 *
 * Loads `SYNTHESIS_API_KEY` from repo-root `.env` (simple KEY=value lines; no export keyword).
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
const videoURL = process.env.VIDEO_URL;

if (!key) {
  console.error("Missing SYNTHESIS_API_KEY in .env");
  process.exit(1);
}
if (!videoURL) {
  console.error(
    "Set VIDEO_URL to your public demo link (e.g. unlisted YouTube).\n" +
      "Example: VIDEO_URL='https://youtu.be/...' node scripts/synthesis-set-video.mjs",
  );
  process.exit(1);
}

const res = await fetch(`${base}/projects/${projectUuid}`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ videoURL }),
});

const text = await res.text();
if (!res.ok) {
  console.error(res.status, text);
  process.exit(1);
}
const out = JSON.parse(text);
console.log("OK — videoURL:", out.videoURL);
