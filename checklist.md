# Hackathon — next steps

Actionable list (merged from [`docs/BUILD_CHECKLIST.md`](docs/BUILD_CHECKLIST.md), [`docs/BUILD_LOG.md`](docs/BUILD_LOG.md) **Current state**, [`vault/checklist.md`](vault/checklist.md)). Check boxes as you go.

**Order:** finish **A + B** first (submission + demo proof), then **C** for tracks you claim, then **D** for whatever strengthens the one demo narrative.

---

## A — Submission (Synthesis / Devfolio)

- [ ] Confirm **`sk-synth-…`**, **team UUID**, and submission path if anything is still TBD
- [ ] Refresh catalog: `GET https://synthesis.devfolio.co/catalog` — align **track UUIDs** with what you demo
- [ ] **Self-custody** step for everyone on the team before **publish**
- [ ] **Public `repoURL`**
- [ ] Draft → **publish**; polish **`conversationLog`** / metadata from **`BUILD_LOG`**
- [ ] **Moltbook** post + `moltbookPostURL`
- [ ] Honest **`submissionMetadata`** (tools, model, skills / resources)
- [ ] Final pass on [`docs/BUILD_LOG.md`](docs/BUILD_LOG.md) **Current state** vs what you ship

---

## B — Demo proof (what judges see)

- [ ] **Explorer links** in README or short demo doc: **deposit**, ≥1 **`rebalance`**, optional **redeem**
- [ ] Stable **`VAULT_ADDRESS`** (and related) in **README** + [`config/chain/contracts.yaml`](config/chain/contracts.yaml)
- [ ] **Video** (2–5 min) and/or **deployed URL**: problem → vote/aggregate → rebalance → (nice) “below ε, no swap”
- [ ] **README disclosures**: pooled/prototype, oracle/manipulation caveats, contract risk/TVL; trust v0 benchmark + sources + gaps
- [ ] **One reproducible cycle**: votes → exported JSON/UI → `plan` / `rebalance` tied in README or script

---

## C — Track-specific (only if claimed)

- [ ] **Uniswap** — API key + proof on critical path if the track requires the **API** (not only router calldata)
- [ ] **MetaMask Delegations** — capped executor as a **load-bearing** demo, not README-only
- [ ] **Locus** — only if spend rails are genuinely on Locus; otherwise do not claim

---

## D — Product gaps (core loop backlog)

- [ ] **Executor path** — target-aware sizing, Quoter-grade `minOut`, minimal trade list (largest gaps first)
- [ ] **Band policy edge cases** — document rounding, 0% target asset, stale prices, withdrawals between vote and execution
- [ ] **Single-asset exit** — `redeemToSingleAsset` route + `SwapStep[]` builder in agent and/or frontend
- [ ] **Profits Tier B** — deposit/withdraw-adjusted P&L; optional on-chain accrual / Merkle claim
- [ ] **On-chain risk knobs** — e.g. `maxSlippageBps`, `maxSingleAssetWeightBps`; oracle/TWAP hardening as needed
- [ ] **Contract verify** — Basescan (see [`docs/DEPLOY.md`](docs/DEPLOY.md))
- [ ] **Trust (optional)** — sync on-chain ballots during **voting** phase for accurate vote-time marks (RPC-heavy)
- [ ] **Telegram** — bot, idempotent handlers, README judge path ([`docs/BUILD_CHECKLIST.md`](docs/BUILD_CHECKLIST.md) §7)

---

## E — Spec / docs cleanup

- [ ] Resolve [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md) **§7** in **BUILD_LOG**: trust benchmark, drift metric, ε semantics, executor shape
- [ ] Vault: P&L vs deposits/withdrawals; oracle/solvency/illiquid redeem notes ([`vault/checklist.md`](vault/checklist.md))

---

## F — Nice-to-have

- [ ] Profits UI: show **`testGainsRawSample1e18`** per cycle (already in JSON)
- [ ] ENS, MCP/tool surface, fork tests, Slither — if time
