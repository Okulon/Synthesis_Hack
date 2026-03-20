# DAO Vault dashboard

Read-only **React** dashboard for [`DAOVault`](../contracts/src/DAOVault.sol): NAV, share supply, pause flags, tracked assets (balances, oracle config), and **Access Control** members (from `RoleGranted` / `RoleRevoked` logs).

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
| `VITE_ROLE_LOGS_FROM_BLOCK` | no | If log queries time out, set to the vault’s deployment block |

`VITE_*` values are **embedded in the browser bundle** — do not put private keys or paid RPC secrets you need to hide.

## Build

```bash
npm run build
npm run preview
```
