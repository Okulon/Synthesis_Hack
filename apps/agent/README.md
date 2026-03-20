# DAO Agent — off-chain worker

_Last reviewed: 2026-03-21._

Reads config + chain state; **no private keys** in `plan` / `quote` / `aggregate` / `trust` (read-only).

**Wall-clock cycle sync** (`cycle:sync` / `cycle:daemon`) updates the vote-store + dashboard JSON — it does **not** broadcast **`rebalance`** or **`closeCycle`** on-chain ([`docs/CYCLES_AND_VOTING.md`](../docs/CYCLES_AND_VOTING.md)).

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
# edit ballots; then:
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
| `npm run plan` | Current vault weights vs `targets.json` + band policy → JSON (`would_trade` / `skip`) |
| `npm run aggregate` | **Trust × snapshot shares × weights** (vote-store) or legacy trust-only → `targets` for `targets.json` |
| `npm run votes:export` | Writes **`frontend/public/allocation-votes.json`** for dashboard **Voting** tab |
| `npm run cycle:clock-init` / `cycle:status` / `cycle:sync` | 30m wall-clock — pin genesis, inspect, align **`vote-store`** to current window ([`docs/CYCLES_AND_VOTING.md`](../docs/CYCLES_AND_VOTING.md)) |
| `npm run cycle:daemon` | **Keeps managing cycles**: init clock if missing, then on an interval runs **`cycle:sync`** + **`votes:export`** (`CYCLE_DAEMON_INTERVAL_SEC`, optional `CYCLE_DAEMON_TRUST_EXPORT`) |
| `npm run cycle:snapshot` | Captures vault **share** balances at block → `config/local/vote-store.json` (needs `VAULT_ADDRESS`, RPC) |
| `npm run trust` | Trust v0 from CSV + `config/trust/scoring.yaml` |
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

## Next

- Build **`SwapStep[]`** for `rebalance` (Uniswap API / quoter + `contracts` ABI)
- Persist votes in DB; wire **executor** key only in a signer process (not this repo)
