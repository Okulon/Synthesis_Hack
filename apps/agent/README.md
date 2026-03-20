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
