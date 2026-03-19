# Vault pricing & governance (community votes)

How **`DAOVault`** gets prices, what **`DEFAULT_ADMIN_ROLE`** actually means in OpenZeppelin, and how **share-based voting** should wrap all parameter changes.

## What “admin” is (and isn’t)

OpenZeppelin **`AccessControl`** has **`DEFAULT_ADMIN_ROLE`**. That role **does not** mean “founders control the treasury.” It only means: **who may grant or revoke other roles** on this contract.

**Intended production setup:**

1. Deploy a **TimelockController** (with a delay).
2. Deploy **`DAOVault`** with **`governance = address(timelock)`** in the constructor. The timelock becomes the **only** account with **`GOVERNANCE_ROLE`** and **`DEFAULT_ADMIN_ROLE`** on the vault.
3. **Renounce** or never grant **any** vault roles to a founder EOA.

After that, **no human** changes vault parameters directly. They submit a **proposal**; if **enough voting power** (your quorum / thresholds) says yes, the **timelock** executes a **`DAOVault`** call (e.g. `setAssetOracleConfig`, `setPause`, `setExecutor`) **after** the delay.

So: **`DEFAULT_ADMIN_ROLE` on the timelock** is normal and still compatible with “**everything goes through votes**,” because the timelock only acts when the **Governor** tells it to.

## Who can do what today (on-chain)

| Action | Who |
|--------|-----|
| **Any parameter change** (oracles, allowlists, routers, `setExecutor`, **`setPause` including unpause**, `closeCycle`, manual price, legacy nav) | **`GOVERNANCE_ROLE`** only (timelock after votes) |
| **Emergency pause only** (`guardianPauseTrading` / `guardianPauseDeposits` / `guardianPauseAll`) | **`GUARDIAN_ROLE`** — one-way; **cannot** call `setPause` to unpause |
| **Rebalance (swaps)** | **`executor`** EOA/key **only** — cannot change settings |

The bot is **least-privilege**: it holds **no** governance role; it only calls **`rebalance`**.

**Constructor:** `DAOVault(governance, guardian, name, symbol)`. Pass **`guardian = address(0)`** if guardians are added later via governance `grantRole(GUARDIAN_ROLE, …)`.

## Share-weighted voting (your model)

The vault share token is plain **ERC-20** today. For **“enough voting share”** on-chain, the standard next step is:

- **`DAOVault` → `ERC20Votes`** (checkpoints for snapshot voting), and  
- **`Governor` + `GovernorVotes` + `TimelockController`**, with **voting power = vault shares** (optionally **`trust`** layered later via wrapper or separate token).

Flow: **propose → vote (by share) → queue in timelock → execute** → `DAOVault.setX(...)`.

Quorum, threshold, voting period, and timelock delay are **governance parameters** you set once (often themselves upgradeable via the same Governor).

## Price resolution (unchanged behavior)

See earlier sections in git history / [`contracts/README.md`](../contracts/README.md): primary + optional secondary Chainlink-style feeds, deviation cap, staleness, manual **time-bounded** override after a **passed** proposal, legacy nav last.

**Feed discontinued:** deposits fail until a **vote** passes a new `setAssetOracleConfig` or temporary `setManualPrice`.

## Hackathon / bootstrap

You may deploy with **`governance = your EOA`** to iterate, then **`grantRole` / transfer** to timelock and **renounce** — document that honestly for judges.

## TWAP

Optional **Uniswap TWAP** as secondary can be added later (adapter or in-contract `observe`). Not required for the governance model above.
