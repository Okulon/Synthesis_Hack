# DAO Agent — off-chain worker

_Last reviewed: 2026-03-20 (pm)._

Reads config + chain state; **no private keys** in `plan` / `quote` / `aggregate` / `trust` (read-only).

### One command (`npm run agent` from repo root)

Keeps wall-clock windows aligned. On each **closed** wall-clock window: **sync on-chain ballots** → **stamp prices** → **trust finalize** (time-weighted portfolio return → `trust_cycle.csv`) → **trust scoring** → **export** (`trust-scores.json`) → **`closeCycle`** (if gov key — must succeed before advancing); optional one-shot rollover rebalance only if **`AGENT_REBALANCE_TO_TARGET=0`**. Every tick (after aggregate): **`AGENT_REBALANCE_TO_TARGET`** (default on with executor key) runs **`plan` → `rebalance`** in a loop until no **`would_trade`** or **`AGENT_REBALANCE_MAX_STEPS_PER_TICK`** (continues on later ticks until converged). Set **`AGENT_REBALANCE_FROZEN_PHASE_ONLY=1`** to rebalance only in the frozen slice. **`rebalance.mjs`** is WETH→USDC only — tune **`REBALANCE_BPS`** and **`config/rebalancing/bands.yaml`**. See [`src/agent.mjs`](./src/agent.mjs).

**Wall-clock only** (`cycle:sync` / `cycle:daemon`) does **not** broadcast **`rebalance`** or **`closeCycle`** unless you use **`agent`** with **`AGENT_AUTO_REBALANCE=1`** ([`docs/CYCLES_AND_VOTING.md`](../docs/CYCLES_AND_VOTING.md)).

## Setup

From repo root:

```bash
cp .env.example .env
# For plan + quote: CHAIN_RPC_URL, VAULT_ADDRESS (optional), CHAIN_ID (84532 Sepolia, 8453 mainnet)
```

```bash
cd apps/agent && npm install
```

Targets (gitignored):

```bash
cp apps/agent/fixtures/targets.example.json config/local/targets.json
```

Votes — **prefer** cycle store ([`docs/CYCLES_AND_VOTING.md`](../docs/CYCLES_AND_VOTING.md)):

```bash
cp apps/agent/fixtures/vote-store.example.json config/local/vote-store.json
# template has no demo voters — add ballots; then:
npm run cycle:snapshot   # shares at block — needs .env RPC + VAULT_ADDRESS
```

Legacy single-file:

```bash
cp apps/agent/fixtures/votes.example.json config/local/votes.json
```

(Used only when **`config/local/vote-store.json` is absent**.)

Trust CSV (optional):

```bash
cp apps/agent/fixtures/trust_cycle.example.csv config/local/trust_cycle.csv
```

## Commands

| Script | Purpose |
|--------|---------|
| `npm run agent` | **All-in-one loop** — sync, trust stamp/finalize, **`closeCycle`** on rollover if gov key set, aggregate→**`targets.json`** (only if **allocation quorum** met, unless **`AGENT_REQUIRE_QUORUM_FOR_TARGETS=0`**), votes export, optional auto-rebalance ([`src/agent.mjs`](./src/agent.mjs)) |
| `npm run close-cycle` | Governance **`closeCycle`** once (NAV snapshot in `config/local/agent-close-cycle-state.json`) |
| `npm run plan` | Current vault weights vs `targets.json` + band policy → JSON (`would_trade` / `skip`) |
| `npm run aggregate` | **Trust × snapshot shares × weights** (vote-store) or legacy trust-only → `targets` for `targets.json` |
| `npm run quorum:check` | RPC: holders + on-chain ballots for `onChainCycleId` → JSON + exit `0` if quorum met, `2` if below ([`src/check-quorum-for-targets.mjs`](./src/check-quorum-for-targets.mjs)) — same math as dashboard **quorum tower**. Used **only** before writing **`config/local/targets.json`** (executor / `plan`). Does **not** change **`allocation-votes.json`** / UI “voted blend”. |
| `npm run votes:export` | Writes **`frontend/public/allocation-votes.json`** for dashboard **Voting** tab |
| `npm run cycle:clock-init` / `cycle:status` / `cycle:sync` | 30m wall-clock — pin genesis, inspect, align **`vote-store`** to current window ([`docs/CYCLES_AND_VOTING.md`](../docs/CYCLES_AND_VOTING.md)) |
| `npm run cycle:daemon` | **Keeps managing cycles**: init clock if missing, then on an interval runs **`cycle:sync`** + **`votes:export`** (`CYCLE_DAEMON_INTERVAL_SEC`, optional `CYCLE_DAEMON_TRUST_EXPORT`) |
| `npm run cycle:snapshot` | Captures vault **share** balances at block → `config/local/vote-store.json` (needs `VAULT_ADDRESS`, RPC) |
| `npm run trust` | Trust v0 from CSV + `config/trust/scoring.yaml` |
| `npm run trust:stamp-prices` | Writes ballot **`priceMarksUsdc`** from pool mid (stamp at vote time; optional `VOTE_CYCLE_KEY`, `TRUST_STAMP_OVERWRITE=1`) |
| `npm run trust:finalize-window` | **Previous** wall-clock window → upserts **`trust_cycle.csv`** with time-weighted portfolio `vote_return_bps` (`TRUST_FINALIZE_CYCLE_KEY` optional) |
| `npm run trust:export` | Writes **`frontend/public/trust-scores.json`** for dashboard Users tab |
| `npm run quote` | Uniswap V3 **factory → pool → slot0 + liquidity** (uses `config/chain/base.yaml` or `base_sepolia.yaml` by `CHAIN_ID`) |
| `npm run rebalance` | **Executor-only:** `vault.rebalance` WETH→USDC; **oracle vs pool mid-price guard** + **`amountOutMinimum`** from mid (+ fee fudge). See env vars below. |

**`npm run rebalance` env (repo root `.env`)**

| Variable | Default | Purpose |
|----------|---------|---------|
| `REBALANCE_DISABLE_ORACLE_POOL_GUARD` | off | Set `1` on rough testnet pools (skip divergence check). |
| `REBALANCE_ORACLE_POOL_MAX_DEVIATION_BPS` | `2000` | Abort if `abs(oracle − poolMid) / oracle` exceeds this (basis points). |
| `REBALANCE_SLIPPAGE_BPS` | `100` | Tightens `amountOutMinimum` vs mid estimate. |
| `REBALANCE_BPS` | `5000` | Fraction of vault WETH to sell (basis points). |
| `REBALANCE_FEE_FUDGE_NUM` / `DEN` | `997` / `1000` | One-hop v3 fee approximation for minOut. |

## Skills

- [`skills/rebalancing/SKILL.md`](./skills/rebalancing/SKILL.md) — first execution playbook for target aggregation + drift plan + quote sanity + execute/hold recommendation.
- [`skills/execution/SKILL.md`](./skills/execution/SKILL.md) — build `SwapStep[]`, preflight, broadcast `DAOVault.rebalance`, capture explorer proof.

**Env for `plan` / `quote`**

| Variable | Required | Notes |
|----------|----------|--------|
| `CHAIN_RPC_URL` | yes | Base / Base Sepolia |
| `VAULT_ADDRESS` | yes for `plan` | After deploy |
| `CHAIN_ID` | no | default `84532` |
| `POOL_FEE` | no | default `3000` for `quote` |

Deploy: [`docs/DEPLOY.md`](../../docs/DEPLOY.md).

**Dashboard:** [`frontend/README.md`](../../frontend/README.md) — point `VITE_VAULT_ADDRESS` / `VITE_RPC_URL` at the same vault; optional **TEST** flow deposits **USDC** after an on-chain WETH→USDC swap (see frontend README).

## Trust dev knobs

| Variable | Default | Purpose |
|----------|---------|---------|
| `TESTWETHOCCILATOR` | off | Synthetic oscillating WETH/USDC price (bypasses dead testnet pool). Set `true` for dev/demo. |
| `TESTWETH_OSCILLATOR_BASE_USDC` | `3000` | Mid-level USDC per WETH for oscillator. |
| `TESTWETH_OSCILLATOR_AMP` | `0.02` | Fractional amplitude (±2% sine wave). |
| `TESTWETH_OSCILLATOR_PERIOD_SEC` | `90` | Sine period in seconds (min 5). |
| `TESTWETH_OSCILLATOR_NOISE_BPS` | `50` | Random jitter per call (basis points). |
| `TESTBOOSTTRUST` | `1` | Multiplier on effective return before bps rounding in trust-finalize-window. E.g. `100000` turns tiny returns into visible bps. |
| `TRUST_MIN_TIME_WEIGHT_FLOOR` | off | 0..1; clamps time weight up so late-cycle votes still get non-zero effective return. E.g. `0.25`. |

## Next

- Build **`SwapStep[]`** for `rebalance` (Uniswap API / quoter + `contracts` ABI)
- Persist votes in DB; wire **executor** key only in a signer process (not this repo)
