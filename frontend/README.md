# DAO Vault dashboard

Read-only **React** dashboard for [`DAOVault`](../contracts/src/DAOVault.sol): NAV, share supply, pause flags, tracked assets (balances, oracle config), **Access Control** members (from `RoleGranted` / `RoleRevoked` logs), **Users** tab with **off-chain trust scores**, **Voting** tab for allocation ballots, and **History** tab for **per-cycle trust** and **ballot performance** (see below).

## Run (port **1337**)

```bash
cd frontend
cp .env.example .env.local
# Edit .env.local: VITE_RPC_URL + VITE_VAULT_ADDRESS (match repo root .env)
npm install
npm run dev
```

Open **http://localhost:1337**

## Wallet (deposit)

- **Deposit** uses **wagmi** + **injected** wallet (**Rabby**, MetaMask, …). You must be on **Base Sepolia**.
- **ETH** in the asset dropdown: wraps via canonical WETH `deposit{value}`, then **approve** + vault **deposit** (three txs). The vault contract still only ever receives **WETH** as ERC-20.
- **USDC** / **WETH**: approve + deposit as before.

## TEST (hackathon / QA only)

A separate **TEST** panel (warn-styled) runs a **multi-tx** path so you can fund the vault with **USDC** starting from **native ETH**:

1. Wrap ETH → **WETH** (`WETH.deposit` + `value`)
2. **Approve** Uniswap **SwapRouter02** for WETH
3. **`exactInputSingle`** — **WETH → USDC** (v3 pool fee tier from repo config, typically **3000**)
4. **Approve** vault for **USDC**, then **`vault.deposit(USDC, amount, receiver)`**

**Not for production:** the swap uses **`amountOutMinimum: 0`** (no slippage protection). On testnet the pool can be missing or illiquid — the UI warns about that. The vault never receives native ETH; wrap + swap are **client-side** before `deposit`.

## Env

| Variable | Required | Notes |
|----------|----------|--------|
| `VITE_RPC_URL` | yes | Public HTTPS RPC for the chain |
| `VITE_VAULT_ADDRESS` | yes | `0x…` vault |
| `VITE_CHAIN_ID` | no | Default `84532` (Base Sepolia) |
| `VITE_ROLE_LOGS_FROM_BLOCK` | no | First block for role discovery — use **vault deploy block** (from `contracts/broadcast/.../run-latest.json`) if **`AssetAllowed`** / roles are missing from default lookback |
| `VITE_HOLDER_LOGS_FROM_BLOCK` | no | Same idea for **share `Transfer`** logs (Users tab) |
| `VITE_ALLOCATION_VOTE_LOGS_FROM_BLOCK` | no | Same for **`AllocationBallotCast`** (Voting tab) |

`VITE_*` values are **embedded in the browser bundle** — do not put private keys or paid RPC secrets you need to hide.

## Allocation voting (Voting tab)

- **On-chain:** connect wallet and **`castAllocationBallot`** (weights in **basis points**, one weight per **`ballotAssets[i]`** on current vault bytecode — i.e. **allowlisted** order, not “only tokens already in the vault”). **Donut chart** previews the form when percents sum to **100%**. **Aggregate targets** table + second **pie** blend **trust × shares × on-chain ballot weights** (same idea as `computeOnChainTargets` / `npm run aggregate`). **Older vault bytecode** without **`ballotAssets`**: UI falls back to **tracked** assets only and shows a **legacy** banner if **`AssetAllowed`** logs show extra allowlisted tokens — **redeploy** for full behavior.
- **Off-cycle schedule + file export:** **trust × snapshot shares × weights** from **`allocation-votes.json`** (same math as `npm run aggregate`). See **`docs/CYCLES_AND_VOTING.md`**.

1. **`config/local/vote-store.json`** — if missing, `cycle:sync` seeds from an **empty** `vote-store.example.json`. Add **real** ballots (UI / imports); run **`npm run cycle:snapshot`** (RPC + `VAULT_ADDRESS`) to record **`shares1e18`** at a block.  
   **Or** legacy **`config/local/votes.json`** only (trust-only / embedded trust per file) if `vote-store.json` is absent.
2. From repo root:
   ```bash
   cd apps/agent && npm run votes:export
   ```
   This writes **`frontend/public/allocation-votes.json`**. The UI warns if **`onChainCycleId`** differs from on-chain `DAOVault.cycleId`.

See **`docs/GOVERNANCE_VOTING.md`** — allocation votes are separate from **parameter / governance** votes.

## Trust scores (Users tab)

Trust multipliers match **`npm run trust`** / **`aggregate`** (CSV + [`config/trust/scoring.yaml`](../config/trust/scoring.yaml)).

1. Maintain cycle returns in `config/local/trust_cycle.csv` (or rely on the fixture for demos).
2. From repo root:
   ```bash
   cd apps/agent && npm run trust:export
   ```
   This writes **`frontend/public/trust-scores.json`**, which the Users page fetches at `/trust-scores.json`.

Wallets not listed get **default 1.00** (asterisk in UI). **Influence** ≈ shares × trust (informal, not an on-chain value).

## History tab (per-cycle trust & performance)

After **`npm run trust:export`**, the agent also writes **`frontend/public/trust-history.json`** (same command as trust-scores). The **History** tab:

- Connect wallet **or** paste a voter `0x…` address.
- **Line chart:** trust score **after** each finalized wall-clock window.
- **Table:** per window — **trust Δ**, **vote return** (bps / %), **benchmark** (bps), and **your ballot weights** (from `vote-store` when available).

Regenerate whenever `trust_cycle.csv` changes (agent rollover runs **`trust:export`** when trust pipeline is on).

## Trust leaderboard

**Trust leaderboard** tab: holders ranked with a bar chart (metric follows active sort), **Trust / Share % / Power** sort toggles, and **your rank** when the wallet matches (or paste `0x…`).

## Profits tab (cycle upside split)

**`frontend/public/cycle-profits.json`** is written when **`closeCycle`** succeeds (see **`apps/agent`**) or manually via **`npm run profit:export`**. The **Profits** tab shows:

- **Your share** — cumulative attributed amount across closes (wallet or pasted address).
- **Everyone by cycle** — profit pool per **`closeCycle`** (NAV delta, or per-close **random synthetic** from **`TESTGAINS`** = **T**: uniform in **`[-T/2, T]`**, pool **`max(0,·)`**) split **∝ trust_before × shares** over ballot voters in **`vote-store`** (same power model as aggregate). **TESTGAINS** badge tooltip reflects **`testGainsRange`** from JSON when present.

## Build

```bash
npm run build
npm run preview
```
