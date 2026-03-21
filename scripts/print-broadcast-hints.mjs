#!/usr/bin/env node
/**
 * Print PROOF.md §1–style lines from a Foundry broadcast JSON (local only).
 *
 * `contracts/broadcast/` is gitignored — run after deploy on your machine:
 *
 *   node scripts/print-broadcast-hints.mjs contracts/broadcast/DeployConfigureDAOVault.s.sol/84532/run-latest.json
 *
 * Does not read private keys; only parses public contract addresses from the artifact.
 */
import fs from "fs";
import path from "path";

const p = process.argv[2];
if (!p) {
  console.error(
    "Usage: node scripts/print-broadcast-hints.mjs <path/to/run-latest.json>\n" +
      "Example: node scripts/print-broadcast-hints.mjs contracts/broadcast/DeployConfigureDAOVault.s.sol/84532/run-latest.json",
  );
  process.exit(1);
}

const abs = path.resolve(p);
if (!fs.existsSync(abs)) {
  console.error("File not found:", abs);
  process.exit(1);
}

const j = JSON.parse(fs.readFileSync(abs, "utf8"));
const txs = j.transactions ?? [];
/** @type {Map<string, string>} contractName -> address */
const deployed = new Map();

for (const t of txs) {
  const c = t.contractName;
  const addr = t.contractAddress;
  if (c && addr && typeof addr === "string" && addr.startsWith("0x")) {
    deployed.set(c, addr);
  }
}

console.log("--- Paste into docs/PROOF.md §1 (verify names match your deploy) ---\n");
const want = ["DAOVault"];
for (const name of want) {
  const a = deployed.get(name);
  console.log(`**${name}** | ${a ?? "_not found in broadcast — check other contract names below_"} |`);
}
console.log("\n--- All contract names in this broadcast ---");
for (const [name, addr] of [...deployed.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`${name}: ${addr}`);
}
