# Build checklist — DAO Agent (Synthesis)

Use this as the **order of operations**. Check boxes as you go. Details live in [`PROJECT_SPEC.md`](./PROJECT_SPEC.md); governance params in [`GOVERNANCE_VOTING.md`](./GOVERNANCE_VOTING.md); vault mechanics in [`vault/spec.md`](../vault/spec.md) + [`vault/checklist.md`](../vault/checklist.md); session narrative in [`BUILD_LOG.md`](./BUILD_LOG.md).

- **§3** = what the **vault contract** already does (and small on-chain gaps).  
- **§4** = the **DAO Agent product loop** still to wire end-to-end (votes, trust-weighted targets, cycles, executor swaps, single-token exit UX, profit path).  
- Aligns with [`PROJECT_SPEC.md`](./PROJECT_SPEC.md) §2 (MVP), §2.1 (bands), §2.2 (profit), §3 (architecture), §4 (backlog), §7 (open decisions).

_Last reviewed: 2026-03-20._

---

## P — Planning & docs (foundation)

- [x] **Product spec** — [`PROJECT_SPEC.md`](./PROJECT_SPEC.md) (MVP, rebalance bands §2.1, backlog)
- [x] **Governance model** — [`GOVERNANCE_VOTING.md`](./GOVERNANCE_VOTING.md) (param registry, vote streams, MVP recommendation)
- [x] **Build log** — [`BUILD_LOG.md`](./BUILD_LOG.md) (cross-session handoff + **Current state**)
- [x] **Config scaffold** — [`config/`](../config/) (`agent/`, `chain/`, `dex/`, `rebalancing/`, `governance/`, `trust/`, `telegram/`, `integrations/`, `logging/`, `security/`)
- [x] **`.gitignore`** — root (`.env`, `config/local/`, common artifacts)
- [x] **`.env.example`** — secret **names** only; `cp .env.example .env` documented there
- [x] `git add` / **commit** + **push** current docs + config (ongoing; use submodules for `contracts/lib`)

---

## 0 — Hackathon & identity

- [x] **Initial registration** — web form submitted (confirm email / Telegram for follow-ups: [`BUILD_LOG.md`](./BUILD_LOG.md))
- [ ] Obtain **`sk-synth-…`** (or documented web-only submission path) and **team UUID** when available
- [ ] `GET https://synthesis.devfolio.co/catalog` — save **track UUIDs** you will claim (refresh before submit)
- [ ] Wallet ready for **self-custody transfer** before publish (all team members — solo = you)

---

## 1 — Repo & hygiene

- [x] Root **README**: problem, MVP demo steps, env vars (names only), links to docs
- [x] `.gitignore` (node, forge, `.env`, keys, `out/`, `cache/`, `contracts/broadcast/`, etc.)
- [x] **No secrets in git** — `.env.example` + [`config/README.md`](../config/README.md)
- [x] License file — [`LICENSE`](../LICENSE) (MIT)
- [x] **First commit** on repo; **ongoing** commits for `frontend/`, agent, contracts (keep `BUILD_LOG` current)
- [ ] **Deployed `VAULT_ADDRESS`** mirrored in README + [`config/chain/contracts.yaml`](../config/chain/contracts.yaml) when stable ([`PROJECT_SPEC.md`](./PROJECT_SPEC.md) status + §4 backlog)

---

## 2 — MVP freeze (before heavy code)

- [x] **MVP scope** documented — [`PROJECT_SPEC.md`](./PROJECT_SPEC.md) §2 + §2.1 (+ architecture §3)
- [x] Lock **chain** — **Base** (`config/chain/base.yaml`, spec)
- [x] Lock **custody model** for implementation — **vault contract** holds assets; **scoped `executor`** for rebalances ([`vault/spec.md`](../vault/spec.md) §2)
- [x] Lock **2–3 allowlisted tokens** + **Uniswap** for v0 (spec + `config/chain/contracts.yaml` hints + `config/dex/uniswap.yaml`)
- [x] Lock **rebalance band defaults** — spec §2.1 + `config/rebalancing/bands.yaml`
- [x] **Telegram** direction — `config/telegram/bot.yaml` (polling MVP); refine notify-only vs vote UX when building §7
- [ ] **Resolve & log** [`PROJECT_SPEC.md`](./PROJECT_SPEC.md) **§7** in [`BUILD_LOG.md`](./BUILD_LOG.md): **trust benchmark** (e.g. 60/40 vs equal-weight allowlist); **drift metric** (absolute pp vs `drift_i / w_target_i`); **global ε vs per-asset ε_i**; **executor** shape (EOA vs contract with immutable checks)

---

## 3 — Smart contracts / on-chain (vault status)

- [x] **`DAOVault`**: **deposit** / **redeem** / **share** accounting — multi-asset allowlist, NAV from balances × governance/oracle pricing ([`contracts/src/DAOVault.sol`](../contracts/src/DAOVault.sol); see [`vault/checklist.md`](../vault/checklist.md))
- [x] **Withdraw to one token** — `redeemToSingleAsset(…, SwapStep[])` (calldata built **off-chain**); **pro-rata** basket exit `redeemProRata`
- [x] **Executor `rebalance(SwapStep[])`** — allowlisted routers; gated **`onlyExecutor`**; pauses respected
- [x] **Governance / safety surface** — token + router allowlists, **`pauseTrading` / `pauseDeposits` / `pauseAll`**, guardian vs governance pause story ([`docs/VAULT_ORACLE_AND_GOVERNANCE.md`](./VAULT_ORACLE_AND_GOVERNANCE.md))
- [x] **Per-cycle P&L hook (Tier A)** — `cycleId`, **`closeCycle`**, **`CycleClosed`** with operator-posted NAV bounds ([`vault/spec.md`](../vault/spec.md) §6)
- [x] **Allocation ballots on-chain** — **`ballotAssets`** (allowlist order) + **`castAllocationBallot`** (bps sum 10_000); legacy deploys fall back to **tracked-only** ballot length in UI ([`BUILD_LOG.md`](./BUILD_LOG.md))
- [x] **Foundry tests** — deposits, redeem, rebalance auth, pause, oracle paths, multi-slot ballots ( **`DAOVault.t.sol`** **18** tests); fork test optional on `BASE_MAINNET_RPC_URL`
- [ ] **On-chain knobs still thin** — no **`maxSlippageBps`** / **`maxSingleAssetWeightBps`** / **on-chain ε**; drift + min-notional live in **YAML + `plan`** only
- [x] **Testnet deploy path documented** — [`DEPLOY.md`](./DEPLOY.md) + `DeployConfigureDAOVault`
- [ ] At least one **real executor `rebalance`** tx on testnet (built **`SwapStep[]`**, explorer hash) — **Uniswap track** credibility

---

## 4 — Core DAO Agent loop *(finished product gap)*

This is the **story** beyond “we have a vault”: allocation **votes**, **trust × share** targets, **cycles**, **moving the vault** toward targets, **easy single-asset exit**, **profit** after a cycle.

- [x] **Cycles as a product** — wall-clock windows (voting + frozen) via `cycles.yaml`; `closeCycle` on rollover advances on-chain `cycleId`; trust finalize runs per closed window; mid-cycle deposits don't affect trust (trust uses ballot-time vs close-time prices, not vault NAV).
- [x] **Allocation voting (MVP)** — **cycle-keyed** `vote-store.json` + operator **`cycle:snapshot`** (share `balanceOf` at block); see [`CYCLES_AND_VOTING.md`](./CYCLES_AND_VOTING.md) (DB / signed ballots still future)
- [x] **Trust × share aggregation** — **`npm run aggregate`** / **`votes:export`**: **trust** (CSV) × **snapshot shares** × ballot **weights** → normalized targets; legacy **`votes.json`** if no vote-store
- [ ] **Executor path** — read vault weights + NAV, compare to targets, apply **band rules** (`plan` logic), build **`SwapStep[]`**, set **minOut** from quotes, **`rebalance`** broadcast (or human confirm / delegation wrapper)
- [ ] **Single-asset withdraw UX** — reliable **route + calldata builder** for `redeemToSingleAsset` in **agent and/or frontend** (users shouldn’t hand-roll Uniswap encoding)
- [x] **Profit after cycle (Tier A JSON)** — [`vault/spec.md`](../vault/spec.md) §6: **`closeCycle`** NAV Δ → **`config/local/cycle-close-log.json`** + **`frontend/public/cycle-profits.json`**; split **ŵ ∝ trust_before × shares** over ballot voters; **`TESTGAINS`**: per exported close, random pool in **`[-T/2, T]`** clamped ≥0 (see **`.env.example`**); **Profits** dashboard tab. **Not done:** deposit/withdraw-adjusted P&L, on-chain accrual / **Merkle claim**.
- [ ] **Trust updates over time** — after each cycle, score each voter’s **proposed portfolio vs benchmark** (rolling window, floors/ceilings per [`config/trust/scoring.yaml`](../config/trust/scoring.yaml)); feed **next** cycle’s aggregation (not a one-off CSV demo only)
- [x] **Pricing consistency** — trust stamp + finalize use **`fetchUsdcPricesForTokens`** (Uniswap v3 slot0 mid, or synthetic oscillator for testnet); `plan` uses on-chain `pricePerFullToken1e18` (oracle-based). MVP shortcut documented: oracle vs pool mid divergence is expected on thin testnet pools.
- [ ] **Band policy edge cases** — document in README or code: **rounding**, **new token at 0% target**, **withdrawals between vote and execution**, **stale prices** ([`PROJECT_SPEC.md`](./PROJECT_SPEC.md) §2.1 closing paragraph)
- [x] **Mid-cycle deposits / liquidity** — **locked** in [`PROJECT_SPEC.md`](./PROJECT_SPEC.md) **§2.0** + [`vault/spec.md`](../vault/spec.md) §3: **deposit/withdraw anytime** (unless pause); **vote snapshot** → new shares **after** cutoff **vote next cycle**; still **document** P&L boundary vs NAV flows in README/`BUILD_LOG`

---

## 5 — Off-chain agent & integrations

- [x] **Dry-run planner** — [`apps/agent`](../apps/agent/README.md) (`npm run plan`): RPC + [`config/rebalancing/bands.yaml`](../config/rebalancing/bands.yaml) + local targets JSON; **skip / would_trade** (no txs)
- [x] **Aggregation** (file-based MVP) — `npm run aggregate` + [`fixtures/votes.example.json`](../apps/agent/fixtures/votes.example.json) → normalized weights
- [x] **Trust v0** (file-based MVP) — `npm run trust` + [`config/trust/scoring.yaml`](../config/trust/scoring.yaml) + CSV fixture
- [x] **Quote helper** — `npm run quote` (pool read; routing still manual)
- [ ] **Vote ingestion** — move from fixtures to **real** source of truth (§4)
- [ ] **API + durable store** — per [`PROJECT_SPEC.md`](./PROJECT_SPEC.md) §3: votes + trust snapshots **persisted** (DB or chain); **Telegram/web are not** balance source of truth (**chain + DB** authoritative)
- [ ] **Execution worker** — §4 executor path: **sign / submit** `rebalance`, retries, logging; **least-privilege** signing key (delegation / allowance narrative); extends `plan`, does not replace it ([`PROJECT_SPEC.md`](./PROJECT_SPEC.md) §2 agent row)
- [ ] **Minimal trade list** — prefer routes that fix **largest deviations** first; no full optimizer required ([`PROJECT_SPEC.md`](./PROJECT_SPEC.md) §2.1 step 6)
- [ ] **Governance on-chain (north star)** — timelock + `Governor` for params ([`PROJECT_SPEC.md`](./PROJECT_SPEC.md) §1.7, §4 backlog); *hackathon honest path:* EOA `GOVERNANCE_ROLE` per [`DEPLOY.md`](./DEPLOY.md) until upgraded
- [ ] **Uniswap API** (if claiming Uniswap track) — real **API key** + **tx proof** on critical path (dashboard TEST path is **router calldata**, not the API track requirement by itself)
- [ ] **MetaMask Delegations** (if claiming track) — **capped executor** as load-bearing demo, not README-only ([`PROJECT_SPEC.md`](./PROJECT_SPEC.md) §2 guardrails + §5)
- [ ] **Locus track** ([`PROJECT_SPEC.md`](./PROJECT_SPEC.md) §5) — only if agent **spend rails** are genuinely built on **Locus** (Base, USDC); otherwise do not claim
- [ ] **MCP / tool surface** (nice-to-have) — query vault state / targets for judges or agent ops ([`PROJECT_SPEC.md`](./PROJECT_SPEC.md) §4); skip unless pivoting to tool-native tracks

---

## 6 — Frontend & demo UX

- [x] **Dashboard** — [`frontend/`](../frontend/): NAV, pause, assets, roles, **Users** (share holders), **Deposit** (WETH / USDC / ETH→WETH), **Voting** (on-chain ballots, **donut pies** for preview + aggregate targets, legacy allowlist banner)
- [x] **TEST swap-deposit** (hackathon QA) — ETH → WETH → USDC → `deposit` ([`frontend/README.md`](../frontend/README.md))
- [ ] **`redeemToSingleAsset` in UI** — pick **assetOut**, slippage, build **SwapStep[]** or call helper API
- [ ] **Vote / cycle UX** (optional) — even a minimal **admin “set targets for cycle”** + display beats invisible JSON for judges
- [ ] **One demonstrable cycle** ([`PROJECT_SPEC.md`](./PROJECT_SPEC.md) §2 **Votes**) — collect allocation votes (**web and/or** Telegram), compute **aggregate weights** with **trust × share** math, show **reproducible** output (logs, JSON, or UI)
- [ ] **ENS** (nice-to-have) — display for treasury or voters ([`PROJECT_SPEC.md`](./PROJECT_SPEC.md) §4)

---

## 7 — Telegram (if shipping)

- [ ] Bot created; token only in **env**
- [ ] **Idempotent** handlers, basic `/status`, vote or deep-link flow
- [ ] Failure modes: downtime, duplicate messages, user correction path
- [ ] README: how a judge spins up bot (or use hosted demo instance)
- [ ] **Nice-to-have:** inline vote UX + **deep links** to wallet signing ([`PROJECT_SPEC.md`](./PROJECT_SPEC.md) §4)

---

## 8 — Demo & proofs

- [ ] **Deployed URL** and/or **short video** (2–5 min; [`PROJECT_SPEC.md`](./PROJECT_SPEC.md) §4 should-have): problem → **vote** → **rebalance** (and ideally **one “below ε, no swap”** clip) → governance / thresholds visible
- [x] **Architecture / trust / limits** — `docs/` + README + [`DEPLOY.md`](./DEPLOY.md) (judge path: clone → configure env → deploy)
- [x] **Frontend TEST path** (optional QA) — [`frontend/README.md`](../frontend/README.md): ETH → WETH → Uniswap v3 WETH→USDC → `deposit(USDC)` on Base Sepolia (`minOut = 0`; hackathon only)
- [ ] Explorer links for **key txs** in README or demo script (**deposit**, **`rebalance`**, optional **redeem**)
- [ ] **README disclosures** — pooled funds / prototype language, **oracle & manipulation** caveats, **contract risk** + TVL guidance ([`PROJECT_SPEC.md`](./PROJECT_SPEC.md) §6); **trust v0** names **benchmark/data sources** and known gaps

---

## 9 — Submission package

- [ ] **Public `repoURL`**
- [ ] **Draft project** via API: name, description, `problemStatement`, `trackUUIDs`, `conversationLog` (from `BUILD_LOG` + polish)
- [ ] **Moltbook** post + `moltbookPostURL`
- [ ] **Honest `submissionMetadata`**: `cursor`, `other`/framework truth, **Cursor Auto** for model, real **skills** / **tools** / **helpfulResources`
- [ ] **Self-custody** complete for everyone on team
- [ ] **Publish** + verify `GET /projects/:uuid` → `publish` and public listing

---

## 10 — Post-submit (before deadline)

- [ ] Small fixes only; no scope creep
- [ ] `BUILD_LOG.md` caught up through final push
