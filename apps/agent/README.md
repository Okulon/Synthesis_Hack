# DAO Agent — off-chain worker

_Last reviewed: 2026-03-21._

Reads config + chain state; **no private keys** in `plan` / `quote` / `aggregate` / `trust` (read-only).

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

Votes (optional):

```bash
cp apps/agent/fixtures/votes.example.json config/local/votes.json
```

Trust CSV (optional):

```bash
cp apps/agent/fixtures/trust_cycle.example.csv config/local/trust_cycle.csv
```

## Commands

| Script | Purpose |
|--------|---------|
| `npm run plan` | Current vault weights vs `targets.json` + band policy → JSON (`would_trade` / `skip`) |
| `npm run aggregate` | Trust-weighted vote aggregation → `targets` object (paste into `targets.json`) |
| `npm run trust` | Trust v0 from CSV + `config/trust/scoring.yaml` |
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
