# Deploy on Base Sepolia (DAO Agent vault)

_Last updated: 2026-03-20._

**Total beginner?** Use [`STEP_BY_STEP.md`](./STEP_BY_STEP.md) first, then come back here for details.

You need: **ETH on Base Sepolia** for gas, **RPC URL**, **deployer private key** (never commit). Optional: **Basescan API key** for verification.

## 1. Environment

From repo root:

```bash
cp .env.example .env
```

Set:

| Variable | Purpose |
|----------|---------|
| `PRIVATE_KEY` | Deployer (has `GOVERNANCE_ROLE` on vault) |
| `BASE_SEPOLIA_RPC_URL` or `CHAIN_RPC_URL` | HTTPS RPC to Base Sepolia |
| `GUARDIAN_ADDRESS` | Optional emergency multisig (guardian pause only) |
| `BASESCAN_API_KEY` | Contract verification |

**Foundry** `forge script` uses `BASE_SEPOLIA_RPC_URL` from [`contracts/foundry.toml`](../contracts/foundry.toml) `[rpc_endpoints]` — set that name **or** pass `--rpc-url` explicitly.

## 2. One-shot deploy + configure (recommended)

Deploys **`DAOVault`**, deploys **mock Chainlink-style aggregators** for USDC + WETH, sets oracle configs, allowlists **USDC** + **WETH** + **SwapRouter02**, sets **executor** (defaults to deployer unless `EXECUTOR_ADDRESS` is set).

```bash
cd contracts
forge script script/DeployConfigureDAOVault.s.sol:DeployConfigureDAOVault \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
  --broadcast \
  --verify
```

Copy the logged **`DAOVault`** address into:

- `VAULT_ADDRESS` in `.env`
- `CHAIN_ID=84532`
- `CHAIN_RPC_URL` (same RPC you used)
- `README` / `config/chain/contracts.yaml` (placeholders)
- **`frontend/.env.local`** (and optionally **`frontend/.env`**) — **`VITE_VAULT_ADDRESS`** + **`VITE_RPC_URL`** (must match repo-root **`VAULT_ADDRESS`**); optional **`VITE_ROLE_LOGS_FROM_BLOCK`**, **`VITE_HOLDER_LOGS_FROM_BLOCK`**, **`VITE_ALLOCATION_VOTE_LOGS_FROM_BLOCK`** set to the **deploy block** from **`contracts/broadcast/.../run-latest.json`** so log scans don’t miss **`AssetAllowed`** / ballots (see [`frontend/README.md`](../frontend/README.md))

## 3. Alternative: deploy only, configure later

```bash
forge script script/DeployDAOVault.s.sol:DeployDAOVault --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast --verify
export VAULT_ADDRESS=0x...   # from logs
forge script script/ConfigureDAOVault.s.sol:ConfigureDAOVault \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
  --broadcast \
  --verify
```

## 4. Off-chain agent (dry-run)

```bash
cd apps/agent && npm install
npm run aggregate   # → target weights JSON
npm run trust         # optional trust CSV
# Copy aggregated targets to config/local/targets.json
npm run plan          # needs VAULT_ADDRESS + CHAIN_RPC_URL
npm run quote         # pool slot0 + liquidity (Uniswap factory)
```

## 5. Frontend dashboard (optional)

```bash
cd frontend && cp .env.example .env.local
# Set VITE_RPC_URL + VITE_VAULT_ADDRESS (same vault as VAULT_ADDRESS)
npm install && npm run dev
```

→ **http://localhost:1337** — connect wallet on Base Sepolia. Full notes: [`frontend/README.md`](../frontend/README.md) (including **TEST**: wrap + Uniswap v3 WETH→USDC + `deposit(USDC)`).

## 6. Canonical addresses (Base Sepolia)

See [`contracts/script/BaseSepolia.sol`](../contracts/script/BaseSepolia.sol) and [`config/chain/base_sepolia.yaml`](../config/chain/base_sepolia.yaml). **Uniswap** addresses match [official Uniswap Base deployments](https://docs.uniswap.org/contracts/v3/reference/deployments/base-deployments).

## 7. Governance bootstrap (hackathon)

- **Today:** `GOVERNANCE_ROLE` is the **deployer EOA** — you can change params, pause, executor, cycle close.
- **North star:** timelock + `Governor` + share voting — see [`VAULT_ORACLE_AND_GOVERNANCE.md`](./VAULT_ORACLE_AND_GOVERNANCE.md).
- **Honest demo:** document “EOA governance until timelock” in README / submission.

## 8. Tokens

- **USDC** on Base Sepolia: `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (test USDC; verify on [Basescan Sepolia](https://sepolia.basescan.org)).
- Fund the vault with small test amounts for deposits/rebalances; use **faucets** / **bridges** as needed.

## 9. What you cannot automate without keys

- Broadcasting `forge script` (needs `PRIVATE_KEY`).
- Basescan verification (needs `BASESCAN_API_KEY` + successful deploy).
