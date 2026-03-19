# Contracts (DAO Agent vault)

Foundry project implementing [`../vault/spec.md`](../vault/spec.md).

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

**Fork test (Base mainnet — hits public RPC):** reads Uniswap V3 factory + USDC/WETH pool liquidity on a Base fork (`test/UniswapBaseFork.t.sol`). Override RPC with `BASE_MAINNET_RPC_URL` in `.env` if needed.

## Deploy & verify (Base Sepolia)

Set `PRIVATE_KEY`, `BASE_SEPOLIA_RPC_URL`, and `BASESCAN_API_KEY` (verification). Optional: `GUARDIAN_ADDRESS`.

```bash
forge script script/DeployDAOVault.s.sol:DeployDAOVault \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast --verify
```

Copy the logged `DAOVault` address into the root **README**, **`config/chain/contracts.yaml`**, and `VAULT_ADDRESS` in `.env`.

## Contracts

| Contract     | Role |
|-------------|------|
| `DAOVault` | Multi-asset share token; `deposit` / `redeemToSingleAsset` (user `SwapStep` calldata) / `redeemProRata`; `rebalance` (executor); **Chainlink-style oracles** + optional cross-check / fallback + **expiring manual price**; Tier A `closeCycle` event. |

**Pricing & votes:** see [`../docs/VAULT_ORACLE_AND_GOVERNANCE.md`](../docs/VAULT_ORACLE_AND_GOVERNANCE.md). **Only `GOVERNANCE_ROLE`** (timelock after share-votes) may change parameters **including** pause, executor, cycle close, oracles, allowlists. The **executor** only **`rebalance`s**.

**Legacy:** `navPricePerFullToken1e18` is still a last-resort path when feeds are unset (governed).
