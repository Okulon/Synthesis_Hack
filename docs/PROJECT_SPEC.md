# DAO Agent — project spec (Synthesis)

**Working name:** DAO Agent  
**Elevator pitch:** A pooled treasury where stakeholders vote on target portfolio weights; an autonomous executor rebalances on-chain within governance caps; influence and (eventually) profit skew reflect **trust** earned from past voting performance — without giving the agent unchecked custody.

**Status:** Pre-implementation. **Hackathon MVP** below is the build target; full mechanics are a north star.

Related: [`BUILD_LOG.md`](./BUILD_LOG.md) (process), [`BUILD_CHECKLIST.md`](./BUILD_CHECKLIST.md) (build order), [`GOVERNANCE_VOTING.md`](./GOVERNANCE_VOTING.md) (how users vote on tokens, DEXes, chains, caps).

---

## 1 — Problem & solution (judge-facing)

### Problem
- Individuals lack time to research and rebalance across many assets.
- Raw **one-person-one-vote** or **pure dollar voting** doesn’t weight **track record**.
- People want **collective** exposure with **enforced risk bounds** and **governance** over how automation behaves.

### Solution (conceptual)
1. **Pool** deposits; track each user’s **share** of the treasury.
2. On each **cycle**, users submit a **target allocation** (weights over allowlisted assets).
3. **Aggregate** targets using **voting power** derived from **share** and **trust** (e.g. `trust × share`, normalized among voters).
4. **Agent** moves the live portfolio toward the aggregate **only when drift exceeds configurable bands** (voter-set thresholds), not pixel-perfect weights — e.g. skip a swap meant to “fix” 89.99% → 90%. Still subject to **governance limits** (allowlist, max slippage, max single-asset weight, allowed venues).
5. **Trust** updates from how each user’s proposed portfolio **would have performed** vs a defined benchmark (rolling window, floors/ceilings).
6. **Profit** allocation (full spec): skew toward higher trust while weak voters still earn some upside; **losses** shared by share (trust does not increase downside) — *full accounting is post-MVP*.
7. **Governance** can change risk and **registry** parameters (allowlisted tokens, venues, rebalance thresholds; “which chain” is a heavy migration — see [`GOVERNANCE_VOTING.md`](./GOVERNANCE_VOTING.md)) via proposals (quorum, timelock, bounds) — *MVP may only ship a minimal param set*.

---

## 2 — Hackathon MVP (what we will implement first)

Goal: **credible vertical slice** matching Synthesis judging: real on-chain execution, clear agent role, honest integrations.

| Area | MVP intent |
|------|------------|
| **Chain** | Single L2 — **Base** (provisional; change only via `BUILD_LOG`). |
| **Assets** | **2–3 allowlisted** ERC-20s (e.g. USDC + WETH + one volatile) — governance-controlled list. |
| **Execution** | **Uniswap** (v3/v4 or API-assisted) swaps only; **real tx hashes** on testnet or mainnet. |
| **Vault** | Users **deposit/withdraw** shares; minimal correct accounting for **no mid-cycle deposits** or document simplified assumptions. |
| **Votes** | One **cycle** demonstrable: collect votes (Telegram and/or web), compute **aggregate weights**, show math in logs/README. |
| **Trust v0** | **One** benchmark, **one** update rule, **one** rolling window (e.g. last N cycles); output **auditable** (CSV or JSON + short explanation). |
| **Agent** | Off-chain worker: fetch state, compute target vs holdings, **apply rebalance bands** (see §2.1), **build minimal trade list**, enforce caps, **submit txs** (or propose txs until delegation path is complete). |
| **Telegram** | **UX + notifications**; **not** source of truth for balances — **chain + DB** are authoritative. |
| **Guardrails** | **Executor caps** aligned with **MetaMask Delegations** narrative if that track is claimed: agent cannot exceed allowlist/slippage/max weight. |

### 2.1 — Rebalance bands (threshold policy)

**Intent:** After the **target allocation** is computed, the executor **must not** chase negligible drift. Swaps happen only when portfolio weight (or notional) drift is **large enough**, using limits **governance can change** (same proposal flow as other risk params).

**Behavior (MVP-friendly):**

1. Compute **current weights** from vault holdings (priced consistently — same oracle/method as trust or a documented MVP shortcut).
2. Compare to **target weights** from the aggregated vote for this cycle.
3. For each allowlisted asset, define a **drift** metric, e.g. `drift_i = |w_current_i − w_target_i|` (absolute percentage points) or relative `drift_i / w_target_i` — pick **one** and document it.
4. **Rebalance threshold(s)** — at least one of:
   - **Global** minimum drift `ε` (e.g. 2 pp): no trade whose only purpose is to move an asset by &lt; `ε` unless another rule forces it.
   - **Per-asset** `ε_i` (optional v1): lets governance treat stablecoins vs volatiles differently.
5. **Optional second guard:** **minimum notional** per trade (USD or native units) so dust-sized fixes are skipped even if %-drift is large.
6. **Trades:** Only generate swaps for assets that are **out of band**; prefer a small set of routes that fix the largest deviations first (exact optimizer not required for hackathon).

**Governance:** Parameters like `ε`, per-asset caps, and min-notional are **governed settings** (see §1 step 7) — voters can tune how “lazy” rebalancing is. Defaults should be **conservative** for gas (e.g. 1–3 pp globally) and documented in README.

**Edge cases (document in code/README):** rounding, new token with 0% target, withdrawals between vote and execution, stale prices.

### Explicitly out of scope for MVP (document as future work)
- Full production **profit-skew** settlement and **legal-grade** fund accounting
- Multi-chain, CEX, or exotic venues
- Sybil-resistant identity beyond wallet linkage (unless added for a specific track)
- Fully autonomous **no-human** operation unless you intentionally target Protocol Labs–style tracks *and* budget the checklist (ERC-8004, manifests, logs)

---

## 3 — Architecture (high level)

```
[Users] → Telegram / Web UI → [API + DB] votes, trust snapshots
                              ↓
                    [Agent worker] plans rebalance
                              ↓
              [Vault + DEX] on Base — swaps within caps
                              ↑
              [Governance params] allowlist, slippage, weights, pause, rebalance ε / min-notional
```

- **On-chain:** vault, governance module (or params on vault), role that can call swap router or modular executor.
- **Off-chain:** indexer or RPC reads, pricing/benchmark feed for trust, signing key with **least privilege** (delegation / allowance).

---

## 4 — Implementation backlog

### Must-have (MVP shippable)
- [ ] **Monorepo layout** — e.g. `contracts/`, `apps/agent/` (or `services/`), `apps/bot/` (optional), `docs/`
- [ ] **Vault**: deposit, withdraw, share accounting; events for indexer
- [ ] **Allowlist + risk caps** enforced on-chain (or executor contract enforces + vault holds funds)
- [ ] **Swap path** to Uniswap with **documented** slippage and limits
- [ ] **Vote model** in DB (user id ↔ wallet, cycle id, weights JSON, timestamp)
- [ ] **Aggregation job** + reproducible log output for one demo cycle
- [ ] **Trust v0** computation + persistence
- [ ] **Rebalance band logic**: drift vs target, `ε` (global and/or per-asset), optional **min notional**; log “skip” reasons for demos
- [ ] **Governance**: store/update threshold params via same process as other risk knobs (timelock if on-chain)
- [ ] **Agent loop** (manual trigger OK): read vault, compute target, **apply bands**, then trades, execute
- [ ] **README** demo script + contract addresses + env template

### Should-have (stronger judging / track fit)
- [ ] **Uniswap Developer Platform** integration with **real API key** and **tx proof** (if claiming Uniswap track)
- [ ] **Delegation / smart account** demo: agent operates under **caveats** (if claiming MetaMask track)
- [ ] **Short video** walkthrough
- [ ] **Deployed** minimal UI or dashboard (even static status page)

### Nice-to-have (time permitting)
- [ ] Telegram **inline** vote UX with **deep links** to wallet signing
- [ ] **MCP** or tool surface for “query vault/target” (Lido-style tracks are different product — only if pivoting)
- [ ] **ENS** display for treasury or voters

---

## 5 — Sponsor tracks (provisional)

| Track | UUID source | Notes |
|--------|-------------|--------|
| **Synthesis Open Track** | `GET /catalog` | Always include. |
| **Agentic Finance (Uniswap)** | `GET /catalog` | Needs real API + real swaps. |
| **Best Use of Delegations (MetaMask)** | `GET /catalog` | Needs **load-bearing** delegation story. |
| **Best Use of Locus** | `GET /catalog` | Only if Locus is **core** to agent spend (Base, USDC). |

Refresh UUIDs from **`https://synthesis.devfolio.co/catalog`** before `trackUUIDs` on submission.

---

## 6 — Risks & disclosures

- **Pooled funds + performance language** → treat as **experimental prototype**; not investment advice; no warranty.
- **Oracle / manipulation**: trust v0 should name data sources and known gaps.
- **Smart contract risk**: test, limit TVL for demo, consider audit disclaimer.

---

## 7 — Open decisions (resolve into `BUILD_LOG`)

- Exact **vault vs smart account** design
- **Mid-cycle deposit** rule for hackathon (forbid vs simplify math)
- **Benchmark** for trust (e.g. 60/40 vs equal-weight allowlist)
- Whether **executor** is EOA with tight allowance or **contract** with immutable checks
- **Drift metric:** absolute percentage points vs relative; single global `ε` vs per-asset (MVP can ship global + min-notional only)
