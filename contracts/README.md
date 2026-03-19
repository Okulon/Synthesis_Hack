# Contracts (DAO Agent vault)

Foundry project implementing [`../vault/spec.md`](../vault/spec.md).

## Prereqs

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `cast`)

## Dependencies

Vendor libs live under `lib/` (OpenZeppelin `v5.0.2`, `forge-std`). To refresh with `forge install` instead:

```bash
cd contracts
rm -rf lib/openzeppelin-contracts lib/forge-std
forge install OpenZeppelin/openzeppelin-contracts@v5.0.2 --no-commit
forge install foundry-rs/forge-std --no-commit
```

## Commands

```bash
cd contracts
forge build
forge test
```

Deploy (example — set `PRIVATE_KEY` and RPC in env):

```bash
forge script script/DeployDAOVault.s.sol:DeployDAOVault --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast
```

## Contracts

| Contract     | Role |
|-------------|------|
| `DAOVault` | Multi-asset share token; `deposit` / `redeemToSingleAsset` (user `SwapStep` calldata) / `redeemProRata`; `rebalance` (executor); **Chainlink-style oracles** + optional cross-check / fallback + **expiring manual price**; Tier A `closeCycle` event. |

**Pricing & votes:** see [`../docs/VAULT_ORACLE_AND_GOVERNANCE.md`](../docs/VAULT_ORACLE_AND_GOVERNANCE.md). **Only `GOVERNANCE_ROLE`** (timelock after share-votes) may change parameters **including** pause, executor, cycle close, oracles, allowlists. The **executor** only **`rebalance`s**.

**Legacy:** `navPricePerFullToken1e18` is still a last-resort path when feeds are unset (governed).
