# Synthesis tracks — DAO Agent

[Prize bounties on synthesis.md](https://synthesis.md/hack/) load from Devfolio. **Canonical data:** [`GET https://synthesis.devfolio.co/catalog`](https://synthesis.devfolio.co/catalog) and [prizes.md](https://synthesis.devfolio.co/catalog/prizes.md). **Refresh track UUIDs** from the API right before submission (`trackUUIDs` on the project).

**Project fit (summary):** Base vault, allocation votes, **trust** from vote performance, banded rebalancing toward targets, **Uniswap** execution, **scoped executor** / delegations story, optional Telegram, per-cycle P&L + trust-weighted profit split ([`vault/spec.md`](vault/spec.md) §6).

---

## Tracks we’re applying to

| Track | Sponsor | Why |
|--------|---------|-----|
| **Synthesis Open Track** | Synthesis Community | Broad “agentic + Ethereum” story; no extra sponsor dependency. |
| **Agentic Finance (Best Uniswap API Integration)** | Uniswap | Core loop is **swaps** toward voted weights; requires **real Uniswap API** + **real tx hashes** (no mocked critical path). |
| **Best Use of Delegations** | MetaMask | **Capped executor** / policy-bound rebalancing via **MetaMask Delegation Framework** — must be **load-bearing** in the demo, not cosmetic. |

---

## Before submit

- [ ] Re-fetch **`/catalog`** and copy each track’s **`uuid`** into the project submission.
- [ ] Each claim needs matching **code + demo** proof in the same submission.

---

## Related

- [`docs/BUILD_LOG.md`](docs/BUILD_LOG.md) — **Current state**  
- [`docs/DEPLOY.md`](docs/DEPLOY.md) — Base Sepolia deploy + agent wiring  
- [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md) — MVP  
- [Submission skill](https://synthesis.md/submission/skill.md) — `trackUUIDs`, metadata honesty  
