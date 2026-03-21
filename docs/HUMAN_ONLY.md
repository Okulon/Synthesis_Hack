# After automation stops — what *you* still do

The repo can’t use your wallet, Devfolio account, or screen recorder. **“My turn”** only means: **those steps need a human** — not that you failed anything.

## The **17 open** checklist rows ≠ 17 separate projects

Many lines are the **same work** described in different sections (e.g. **PROOF** shows up under **B**, **C2**, and **C3**). Rough grouping:

| Bundle | Checklist rows (approx.) | What it is |
|--------|--------------------------|------------|
| **A — Devfolio / publish** | 8 | API access, catalog, self-custody, repo URL, publish, Moltbook, metadata paste, BUILD_LOG final pass |
| **B + C — Evidence** | 6 | Explorer links in **PROOF**, production URL, **video**, proof-pack txs, live outcomes — **mostly one PROOF.md + one Vercel URL + one video** |
| **D — Verify** | 1 | Run **`forge verify`** / Basescan UI, tick **PROOF** §1 |
| **D — Product backlog** | 3 | **Not** required for a minimal hackathon submit: **Tier B**, on-chain **`maxSlippageBps`**, **ENS/MCP** |

So: **~8–10 real actions** if you do everything **except** the optional backlog. **~5–6** if you only do **minimum** + proof + publish.

---

## Minimum (many teams stop here)

1. **Fill [`docs/PROOF.md`](PROOF.md)** — txs + deployed app URL + video link (covers **B**, **C2**, **C3** checklist lines at once).
2. **Devfolio** — publish + **`submissionMetadata`** ([`docs/SUBMISSION_METADATA.md`](SUBMISSION_METADATA.md)) + track UUIDs (`npm run synthesis:catalog` / [`TRACKS.md`](../TRACKS.md)).
3. **Self-custody** + **Moltbook** if the rules require them.
4. **Verify** contracts on Basescan ([`docs/DEPLOY.md`](DEPLOY.md) §10) — **strongly recommended** for judges.

**Skip for time:** Tier B P&L, new on-chain `maxSlippageBps`, ENS/MCP — those lines can stay **unchecked** unless you want them.

---

## Optional backlog (large / not blocking demo)

- **Profits Tier B** — deposit-adjusted accounting / Merkle.
- **On-chain risk knobs** — new Solidity + governance.
- **ENS / MCP** — polish.

---

## Quick commands

- `npm run synthesis:catalog` — track JSON
- `npm run proof:hints -- <path/to/run-latest.json>` — hints for **PROOF** §1 (local broadcast)
- Set **`VITE_SOURCE_REPO_URL`** in **`frontend/.env.local`** — judge doc links in the footer
