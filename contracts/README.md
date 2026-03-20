# Contracts (DAO Agent vault)

Foundry project implementing [`../vault/spec.md`](../vault/spec.md). **Deploy:** [`../docs/DEPLOY.md`](../docs/DEPLOY.md). **Browser QA (deposits / swap path):** [`../frontend/README.md`](../frontend/README.md).

## Prereqs

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `cast`)

## Dependencies

Libs are **git submodules** under `lib/` (OpenZeppelin `v5.0.2`, `forge-std`). From repo root:

```bash
git submodule update --init --recursive
```

OpenZeppelin also vendors nested submodules (`lib/erc4626-tests`, nested `forge-std`); **`--recursive`** is required for a clean `forge build`.

To reinstall from scratch:

```bash
cd contracts
rm -rf lib/openzeppelin-contracts lib/forge-std
forge install OpenZeppelin/openzeppelin-contracts@v5.0.2
forge install foundry-rs/forge-std
```

## Commands

```bash
cd contracts
forge build
forge test
```

**Fork test (Base mainnet):** `test/UniswapBaseFork.t.sol` — set `BASE_MAINNET_RPC_URL` in `.env` or the test **skips** (CI-friendly).

## Deploy & verify (Base Sepolia)

Full walkthrough: [`../docs/DEPLOY.md`](../docs/DEPLOY.md).

**One-shot deploy + configure** (mock oracles for USDC/WETH, allowlists, SwapRouter02, executor):

```bash
forge script script/DeployConfigureDAOVault.s.sol:DeployConfigureDAOVault \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast --verify
```

**Vault only:**

```bash
forge script script/DeployDAOVault.s.sol:DeployDAOVault \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast --verify
```

**Configure existing vault** (`VAULT_ADDRESS` in env):

```bash
forge script script/ConfigureDAOVault.s.sol:ConfigureDAOVault \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast --verify
```

Set `PRIVATE_KEY`, `BASE_SEPOLIA_RPC_URL`, `BASESCAN_API_KEY`. Optional: `GUARDIAN_ADDRESS`, `EXECUTOR_ADDRESS`.

Addresses: [`script/BaseSepolia.sol`](script/BaseSepolia.sol).

## Contracts

| Contract     | Role |
|-------------|------|
| `DAOVault` | Multi-asset share token; `deposit` / `redeemToSingleAsset` (user `SwapStep` calldata) / `redeemProRata`; `rebalance` (executor); **Chainlink-style oracles** + optional cross-check / fallback + **expiring manual price**; Tier A `closeCycle` event. |

**Pricing & votes:** see [`../docs/VAULT_ORACLE_AND_GOVERNANCE.md`](../docs/VAULT_ORACLE_AND_GOVERNANCE.md). **Only `GOVERNANCE_ROLE`** (timelock after share-votes) may change parameters **including** pause, executor, cycle close, oracles, allowlists. The **executor** only **`rebalance`s**.

**Legacy:** `navPricePerFullToken1e18` is still a last-resort path when feeds are unset (governed).
