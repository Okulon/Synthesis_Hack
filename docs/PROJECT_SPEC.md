# DAO Agent — project spec (Synthesis)

**Working name:** DAO Agent  
**Elevator pitch:** A pooled treasury where stakeholders vote on target portfolio weights; an autonomous executor rebalances on-chain within governance caps; influence and (eventually) profit skew reflect **trust** earned from past voting performance — without giving the agent unchecked custody.

**Status:** **On-chain vault** + tests + **Base Sepolia deploy/configure scripts** ([`docs/DEPLOY.md`](../docs/DEPLOY.md)); **agent** (`plan`, `aggregate`, `trust`, `quote`, executor **`rebalance`**, **quorum check**, **on-chain ballot sync**, **trust finalize pipeline** — see [`apps/agent/README.md`](../apps/agent/README.md)); **frontend** dashboard with **`castAllocationBallot`**, ballot **pie** preview, on-chain aggregate **pie**, trust scores, and legacy bytecode fallback ([`frontend/README.md`](../frontend/README.md)); hackathon **TEST** deposit path. **Trust pipeline confirmed working** end-to-end: sync → stamp → finalize → trust → export; scores move off default with `TESTWETHOCCILATOR` + `TESTBOOSTTRUST` on testnet. **No** on-chain storage of **final aggregate targets** — ballots are **events**; **`closeCycle`** only bumps **`cycleId`**. Optional later: **`setCycleTargets`**. **Hackathon MVP** below is the build target; full mechanics are a north star.

Related: [`BUILD_LOG.md`](./BUILD_LOG.md) (process), [`BUILD_CHECKLIST.md`](./BUILD_CHECKLIST.md) (build order), [`GOVERNANCE_VOTING.md`](./GOVERNANCE_VOTING.md) (how users vote on tokens, DEXes, chains, caps), [`vault/spec.md`](../vault/spec.md) (on-chain vault design).

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
6. **Profit** (per cycle): measure vault **P&L** over each allocation cycle; **positive** results are split using weights that combine **`share`** and **`trust`** (e.g. `share × g(trust)`, normalized); **losses** hit participants **by share only** — trust does **not** increase downside. See [`vault/spec.md`](../vault/spec.md) §6 for formulas and MVP tiers (ledger vs accrue vs Merkle).
7. **Governance** can change risk and **registry** parameters (allowlisted tokens, venues, rebalance thresholds; “which chain” is a heavy migration — see [`GOVERNANCE_VOTING.md`](./GOVERNANCE_VOTING.md)) via proposals (quorum, timelock, bounds) — *MVP may only ship a minimal param set*.

---

## 2 — Hackathon MVP (what we will implement first)

Goal: **credible vertical slice** matching Synthesis judging: real on-chain execution, clear agent role, honest integrations.

| Area | MVP intent |
|------|------------|
| **Chain** | Single L2 — **Base** (provisional; change only via `BUILD_LOG`). |
| **Assets** | **2–3 allowlisted** ERC-20s (e.g. USDC + WETH + one volatile) — governance-controlled list. |
| **Execution** | **Uniswap** (v3/v4 or API-assisted) swaps only; **real tx hashes** on testnet or mainnet. |
| **Vault** | Users **deposit/withdraw anytime** (unless paused); **voting** uses a **snapshot** — new depositors vote **next** cycle ([`vault/spec.md`](../vault/spec.md) §3). **Per-cycle NAV / P&L** for trust updates & profit split ([`vault/spec.md`](../vault/spec.md) §6). |
| **Votes** | One **cycle** demonstrable: collect votes (Telegram and/or web), compute **aggregate weights**, show math in logs/README. |
| **Trust v0** | **One** benchmark, **one** update rule, **one** rolling window (e.g. last N cycles); output **auditable** (CSV or JSON + short explanation). |
| **Agent** | Off-chain worker: fetch state, compute target vs holdings, **apply rebalance bands** (see §2.1), **build minimal trade list**, enforce caps, **submit txs** (or propose txs until delegation path is complete). |
| **Telegram** | **UX + notifications**; **not** source of truth for balances — **chain + DB** are authoritative. |
| **Guardrails** | **Executor caps** aligned with **MetaMask Delegations** narrative if that track is claimed: agent cannot exceed allowlist/slippage/max weight. |

### 2.0 — Cycles: length (prod vs test), liquidity, and who can vote

**Cycle length (product intent)**  
- **Production-style cadence:** **~30-day** allocation cycles — one window to **cast allocation votes**, then a **frozen aggregate target** for the cycle, **executor** work under bands, then **`closeCycle`** (and trust / P&L bookkeeping). Exact boundaries are configurable.

**Testing and demos (same mechanics, shorter wall-clock)**  
- The **state machine** does not depend on 30 wall-clock days. On **Base Sepolia** (and in videos), use either:
  - a **configurable shorter** `cycleLength` (e.g. hours), and/or  
  - **operator-controlled** phase transitions (close voting / call `closeCycle` when ready)  
  so a full **vote → aggregate → plan/rebalance → close** loop fits one session. **README / `DEPLOY`:** state that **mainnet-style parameterization is ~30d** while **testnet uses compressed or manual timing**.

**Deposits and withdrawals (no cycle lockups)**  
- **Deposit** and **withdraw** / **redeem** stay **permissionless** whenever the vault is not paused by governance — **no** alternating “only withdraw on Tuesdays” or cycle-phase lockouts for MVP.
- **Voting voice:** allocation votes use a **snapshot** of **share** (and **trust** per your rules) at a **defined cutoff** (e.g. end of voting or a committed block height). Wallets that **first receive shares after** that snapshot **do not vote in that cycle**; they **gain a voice in the next cycle**. This is fair, simple to explain, and avoids punishing people who don’t trade during a vote window — they simply weren’t in the snapshot yet.
- **P&L / trust:** Tier A and off-chain splits should **document** how **mid-cycle deposits/withdrawals** interact with `navStart` / `navEnd` and cycle boundaries ([`vault/spec.md`](../vault/spec.md) §3, §6).

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

### 2.2 — Per-cycle profit & trust-weighted distribution (summary)

- At each **cycle boundary**, compute vault **result** in a single unit of account (`NAV_end - NAV_start` with deposit/withdraw adjustments — see [`vault/spec.md` §6.2](../vault/spec.md)).
- **If profit:** allocate `profit_cycle` across users with weights `ŵ_i ∝ share_i × g(trust_i)` (governance picks `g`, e.g. `trust^α`); optional **floor** so everyone gets some upside.
- **If loss:** no trust-skewed **profit** pool; impairment flows **through share price / pro-rata loss** — not through extra downside for high-trust voters.
- **MVP:** prefer **Tier A** (on-chain `CycleClosed` + off-chain CSV of splits) or small **Merkle claim** if time permits — full **legal-grade** fund ops still out of scope.

### Explicitly out of scope for MVP (document as future work)
- **Legal-grade** fund accounting, audits, and regulatory-grade reporting (product **does** document profit logic for the hackathon)
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
- [x] **Monorepo layout** — `contracts/`, `apps/agent/`, `docs/` (optional `apps/bot/` later)
- [x] **Vault**: deposit, redeem, share accounting; events for indexer
- [x] **Allowlist** + router allowlist on-chain; **risk caps** partially (slippage via `minAmountOut`; full `maxSlippageBps` / weight caps still backlog)
- [ ] **Swap path** to Uniswap with **documented** slippage and **real tx** on testnet/mainnet (calldata built off-chain per `vault/spec` §4.2)
- [x] **Vote model** — **file-based** `vote-store.json` + snapshots + aggregate *(DB optional later)*
- [x] **Aggregation** — `npm run aggregate` + reproducible JSON for one demo cycle
- [x] **Trust v0** (off-chain MVP) — `npm run trust` + [`config/trust/scoring.yaml`](../config/trust/scoring.yaml)
- [x] **Cycle P&L** snapshot — Tier A `CycleClosed` event + off-chain CSV path per [`vault/spec.md`](../vault/spec.md) §6
- [x] **Rebalance band logic** (`npm run plan`) + `config/rebalancing/bands.yaml`
- [ ] **Governance**: full on-chain timelock + votes *(hackathon: EOA `GOVERNANCE_ROLE` + [`DEPLOY.md`](../docs/DEPLOY.md) honesty)*
- [x] **Agent execution** — executor **`npm run rebalance`** ( [`apps/agent/src/rebalance.mjs`](../apps/agent/src/rebalance.mjs)); **target-aware sizing** / full automation loop still optional ([`BUILD_LOG.md`](./BUILD_LOG.md))
- [x] **README** + **env template** + **[`DEPLOY.md`](../docs/DEPLOY.md)**; **`VAULT_ADDRESS`** TBD after your deploy

### Should-have (stronger judging / track fit)
- [ ] **Uniswap Developer Platform** integration with **real API key** and **tx proof** (if claiming Uniswap track)
- [ ] **Delegation / smart account** demo: agent operates under **caveats** (if claiming MetaMask track)
- [ ] **Short video** walkthrough
- [x] **Deployed** minimal UI — Vite dashboard in [`frontend/`](../frontend/) (NAV, deposit, Users, **Voting** / on-chain ballots + pies, optional **TEST** swap-deposit for QA on testnet)

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

- **Vault vs smart account:** **vault contract** + executor (see [`vault/spec.md`](../vault/spec.md)); smart account optional later
- **Mid-cycle deposit / voting** — **locked:** deposits & withdrawals **always on** (unless pause); **snapshot** for allocation vote; shares minted **after** snapshot → **no vote until next cycle** (§2.0 above; [`vault/spec.md`](../vault/spec.md) §3)
- **Benchmark** for trust (e.g. 60/40 vs equal-weight allowlist)
- Whether **executor** is EOA with tight allowance or **contract** with immutable checks
- **Drift metric:** absolute percentage points vs relative; single global `ε` vs per-asset (MVP can ship global + min-notional only)
