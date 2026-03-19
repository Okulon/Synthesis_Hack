# DAO Agent — dry-run planner

Reads **`DAOVault`** state over RPC, compares to **target weights** (from a local JSON file), applies **`config/rebalancing/bands.yaml`** drift gates — **no transactions**.

## Setup

From repo root:

```bash
cp .env.example .env
# Set CHAIN_RPC_URL, VAULT_ADDRESS, CHAIN_ID (84532 = Base Sepolia, 8453 = Base mainnet)
```

```bash
cd apps/agent && npm install
```

Targets (gitignored):

```bash
cp apps/agent/fixtures/targets.example.json config/local/targets.json
# Edit addresses + weights to match your deployed allowlisted tokens
```

## Run

```bash
cd apps/agent && npm run plan
```

**Env**

| Variable | Required | Notes |
|----------|----------|--------|
| `CHAIN_RPC_URL` | yes | Base / Base Sepolia HTTP(S) RPC |
| `VAULT_ADDRESS` | yes | `DAOVault` proxy/impl address |
| `CHAIN_ID` | no | default `84532` (Base Sepolia) |

**Files**

- `config/rebalancing/bands.yaml` — ε, min notional, drift metric
- `config/local/targets.json` — per-token target weights (see `fixtures/targets.example.json`)

## Next

- Uniswap quote / route → `SwapStep[]` preview for `rebalance`
- Wire vote aggregation + trust (off-chain DB or files)
