# Execution Skill — `rebalance(SwapStep[])`

## Objective

Turn an approved **plan** (from [`rebalancing/SKILL.md`](../rebalancing/SKILL.md)) into **on-chain execution**: build `SwapStep[]`, run preflight checks, broadcast `DAOVault.rebalance`, and record a verifiable tx hash.

## On-chain contract shape

From `contracts/src/DAOVault.sol`:

```solidity
struct SwapStep {
    address tokenIn;
    address router;
    bytes data;
}

function rebalance(SwapStep[] calldata steps) external;
```

**Behavior per step**

1. `tokenIn` must be **allowlisted** (`isAssetAllowed`).
2. `router` must be **allowlisted** (`isRouterAllowed`).
3. Vault **approves `tokenIn` balance** to `router` (full balance of that token in the vault at step time).
4. Vault **calls** `router` with `data` — must **succeed** or whole tx reverts (`BadStep`).
5. Vault **zeros** approval after the call.

**Critical:** router calldata must move output **back into the vault** (recipient = vault), not an EOA. Match patterns used in tests: `contracts/test/DAOVault.t.sol` (`MockSwapRouter.swapExactIn` → `address(vault)`).

## Preconditions

- Completed **rebalancing** skill with recommendation `execute` (not `hold`).
- `.env` (repo root) has:
  - `CHAIN_RPC_URL`, `CHAIN_ID`, `VAULT_ADDRESS`
  - **`EXECUTOR_PRIVATE_KEY`** (or equivalent) only in the **signing environment** — never commit; CI must not use it.
- On-chain:
  - Caller wallet is **`vault.executor()`**
  - `pauseTrading` / `pauseAll` allow rebalance
  - Sufficient **gas** on executor wallet

## Inputs

| Input | Notes |
|-------|--------|
| `steps[]` | Ordered `SwapStep` payloads |
| `dryRun` | `true` = simulate / fork only; `false` = broadcast |

## Execution checklist

### 1. Preflight (read-only)

- Read `executor`, `pauseTrading`, `pauseAll`, allowlists for each `tokenIn` and `router`.
- Confirm vault balances for each `tokenIn` match intended swap notionals.
- Optional: fork test or `cast call` simulation against same bytecode.

### 2. Build calldata (`data`)

- Use the **same router** you configured on deploy (e.g. Base Sepolia `SWAP_ROUTER02` in `contracts/script/BaseSepolia.sol`).
- Encode the exact router function (e.g. Uniswap V3 `exactInputSingle` / multicall) with:
  - correct path / fee tier
  - **`amountIn`** ≤ vault balance of `tokenIn` after prior steps
  - **`recipient` = `VAULT_ADDRESS`**
  - **`amountOutMinimum`** / slippage per governance (never `0` on mainnet-style deploys)

**Repo helper:** `npm run rebalance` (see `apps/agent/README.md`) applies an **oracle vs Uniswap pool mid-price** divergence check and sets a non-zero **`amountOutMinimum`** from mid + fee fudge (not a full Quoter). Use **`REBALANCE_DISABLE_ORACLE_POOL_GUARD=1`** only when testnet pools disagree wildly with mocks.

Reference ABI fragments: [`frontend/src/lib/swapRouter02Abi.ts`](../../../frontend/src/lib/swapRouter02Abi.ts).

### 3. Assemble `SwapStep[]`

For each swap:

- `tokenIn`: ERC-20 the vault will approve and spend
- `router`: allowlisted router address
- `data`: encoded router call from step 2

Order matters: first step spends one token; later steps spend whatever the vault holds after prior swaps.

### 4. Broadcast

**Option A — Foundry (`cast`)**  
If you have a helper script or encoded calldata: `cast send` from executor.

**Option B — viem / small Node script**  
`walletClient.writeContract({ address: VAULT, abi, functionName: 'rebalance', args: [steps] })`.

**Option C — MetaMask / hardware**  
Use block explorer “Write contract” only for demos; prefer scripted reproducible sends for evidence.

### 5. Post-execution

- Save **tx hash** + explorer URL (BaseScan).
- Re-run `npm run plan` and compare weights vs target.
- Append outcome to `docs/BUILD_LOG.md` (no private keys).

## Success criteria

- `rebalance` tx **succeeds** on target chain.
- Vault holdings move toward planned allocation within governance band policy.
- Evidence: explorer link + before/after `plan` JSON snapshot.

## Failure handling

| Failure | Action |
|---------|--------|
| `NotExecutor` | Fix `msg.sender`; must be `vault.executor()` |
| `Paused` | Wait for governance unpause or abort |
| `RouterNotAllowed` / `AssetNotAllowed` | Update allowlists via governance or fix step addresses |
| `BadStep` | Router call reverted — debcode `data`, slippage, pool, path |
| Insufficient balance | Re-order steps or reduce `amountIn` |

## Safety

- Keep **executor keys** out of `plan` / `quote` tooling; isolate **signing** to this skill only.
- Prefer **mainnet fork** or Sepolia dry runs before high-value calls.
- Document real **minOut** / slippage policy in README for judges.

## Related

- Deploy addresses: [`docs/DEPLOY.md`](../../../docs/DEPLOY.md)
- Base Sepolia constants: [`contracts/script/BaseSepolia.sol`](../../../contracts/script/BaseSepolia.sol)
