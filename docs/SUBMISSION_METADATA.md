# Synthesis / Devfolio — submission metadata (copy-paste)

**Purpose:** Honest **`submissionMetadata`** / project description fields for **The Synthesis** hackathon. **Edit** placeholders (`YOUR_*`) and paste into Devfolio — **never** commit API keys or private keys in this file.

**Related:** [`checklist.md`](../checklist.md) **§A**, [`docs/PROOF.md`](PROOF.md) §7, [`docs/BUILD_LOG.md`](BUILD_LOG.md). After pasting metadata, complete **[`HUMAN_ONLY.md`](HUMAN_ONLY.md)**.

---

## Tools & stack (short)

- **Contracts:** Foundry, Solidity, OpenZeppelin (see [`contracts/README.md`](../contracts/README.md))
- **Agent:** Node 20+, [`apps/agent`](../apps/agent/README.md) — `plan`, `aggregate`, `trust`, `rebalance`, `npm run agent`
- **Frontend:** Vite, React, TypeScript, wagmi/viem ([`frontend/README.md`](../frontend/README.md))
- **DEX:** Uniswap v3 **SwapRouter02** + **QuoterV2** on Base (see root [**README**](../README.md#judge-facing-synthesis))

---

## Agent / AI assistance

- **IDE:** Cursor (or your editor)
- **Model routing:** Cursor **Auto** (or note what you used for judged collaboration)
- **In-repo guidance:** [`apps/agent/skills/`](../apps/agent/skills/) (rebalancing, execution), [`docs/BUILD_LOG.md`](BUILD_LOG.md) as **conversation / handoff log**

---

## Conversation log (judged field)

- Primary: [`docs/BUILD_LOG.md`](BUILD_LOG.md) — chronological sessions + **Current state** at bottom
- Optional: link this repo’s **commit history** for code changes

---

## Public repository

- **`repoURL`:** `YOUR_PUBLIC_GITHUB_URL` (e.g. `https://github.com/<org>/<repo>`)

---

## Tracks (refresh UUIDs before submit)

From repo root (needs network):

```bash
npm run synthesis:catalog
```

Same as `curl -sS https://synthesis.devfolio.co/catalog`. Align **Open**, **Uniswap**, **Base** with what you demo; **omit** MetaMask / Locus UUIDs unless you claim those paths ([`checklist.md`](../checklist.md) **C4**, **C5**). Track names in [`TRACKS.md`](../TRACKS.md).

---

## One-paragraph pitch (optional paste)

Pooled **DAOVault** on **Base**: holders vote on target allocations; **trust** updates from performance; an **executor** **rebalances** via Uniswap only when **band policy** says drift is large enough. **Tier A** profit splits are transparent **off-chain JSON**; see [`vault/spec.md`](../vault/spec.md) §6.6. Full story: root [**README**](../README.md#judge-facing-synthesis).
