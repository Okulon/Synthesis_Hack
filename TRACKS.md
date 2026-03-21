# Synthesis tracks — DAO Agent

[Prize bounties on synthesis.md](https://synthesis.md/hack/) load from Devfolio. **Canonical data:** [`GET https://synthesis.devfolio.co/catalog`](https://synthesis.devfolio.co/catalog) and [prizes.md](https://synthesis.devfolio.co/catalog/prizes.md). **Refresh track UUIDs** from the API right before submission (`trackUUIDs` on the project).

**Project fit (summary):** Base vault, allocation votes, **trust** from vote performance, banded rebalancing toward targets, **Uniswap v3 router** execution, **scoped executor**, optional Telegram, per-cycle P&L + trust-weighted profit split ([`vault/spec.md`](vault/spec.md) §6).

---

## Tracks we’re applying to

Refresh names/UUIDs with **`npm run synthesis:catalog`** (repo root) or `GET https://synthesis.devfolio.co/catalog` before submit — align with [`checklist.md`](checklist.md).

| Track | Sponsor | Why |
|--------|---------|-----|
| **Synthesis Open Track** | Synthesis Community | Broad “agentic + Ethereum” story; no extra sponsor dependency. |
| **Uniswap (agentic finance / swaps)** | Uniswap | This repo ships **real on-chain swaps** via **Uniswap v3 SwapRouter02** + **QuoterV2** + explorer **tx proof** ([README](README.md#judge-facing-synthesis)). **Not** claiming the **Uniswap Developer Platform API** on the critical path unless you add it — confirm current prize wording in **`/catalog`**. |
| **Base (Autonomous Trading Agent)** | Base | **`npm run agent`** + executor **`rebalance`** under band policy ([`apps/agent/README.md`](apps/agent/README.md)). |
| **Best Use of Delegations** | MetaMask | **Deferred** — no load-bearing Delegation Framework path in repo ([`checklist.md`](checklist.md) **C4**); omit UUID unless you ship it. |

---

## Before submit

- [ ] Re-fetch **`/catalog`** and copy each track’s **`uuid`** into the project submission.
- [ ] Each claim needs matching **code + demo** proof in the same submission.

---

## Related

- [`checklist.md`](checklist.md) — **Done / To do** for submit  
- [`docs/BUILD_LOG.md`](docs/BUILD_LOG.md) — **Current state**  
- [`docs/DEPLOY.md`](docs/DEPLOY.md) — Base Sepolia deploy + agent wiring  
- [`docs/PROOF.md`](docs/PROOF.md) — judge tx / URL placeholders  
- [`frontend/README.md`](frontend/README.md) — dashboard; **TEST** uses on-chain Uniswap **SwapRouter02**  
- [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md) — MVP  
- [Submission skill](https://synthesis.md/submission/skill.md) — `trackUUIDs`, metadata honesty  
