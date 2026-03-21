# Rebalance band policy — edge cases

Authoritative thresholds live in [`config/rebalancing/bands.yaml`](../config/rebalancing/bands.yaml). The agent’s `plan` (`apps/agent/src/cli.mjs`) and target-aware `rebalance` (`apps/agent/src/rebalance.mjs`) share the same math via [`apps/agent/src/lib/bandPolicy.mjs`](../apps/agent/src/lib/bandPolicy.mjs).

## Drift metric

- **Implemented:** **`absolute_pp`** — for each asset, `drift_pp = |w_current − w_target| × 100` (percentage points on a 0–100 scale).
- **`relative` in YAML:** not implemented; `plan` / `rebalance` **warn** and still use **absolute** drift (legacy behavior).

## ε (epsilon) and min-notional

- **`global_epsilon_pp` / `per_asset_epsilon_pp`:** a trade is only considered when `drift_pp ≥ ε` for that asset (float tolerance `1e-9`).
- **`min_trade_notional_quote`:** second gate — approximate **USD-ish** size of the gap `(drift_pp / 100) × (NAV in float)` must meet the floor. Prevents dust trades when `%` drift is large but NAV is tiny.

## Rounding

- On-chain balances and `totalNAV()` are integer-valued; **`w_current`** in `plan` uses JS `Number` division. Weights can be off by ~1e-15; band decisions use the same float tolerance as before. If a rebalance **rounds to zero** on the computed leg, the script exits with a clear error — widen holdings or check oracles.

## 0% target

- If **`w_target = 0`**, drift in pp equals **`w_current × 100`**. A non-zero holding against a 0% target is usually **out of band** unless ε and min-notional allow skipping.

## Stale prices

- **`w_current`** uses vault **`pricePerFullToken1e18`** (oracles/aggregators as deployed). If an oracle is stale or zero, pricing is wrong — **`rebalance`** also compares **oracle vs pool mid** when the guard is enabled (`REBALANCE_DISABLE_ORACLE_POOL_GUARD`).

## Withdrawals / deposits between vote and execution

- **Targets** come from aggregated votes for the cycle (`config/local/targets.json`); **live balances** change when users deposit or withdraw. The executor always plans against **current** NAV and weights, so the **effective** trade may differ from what voters imagined. Documented product intent: snapshot rules for **voting power** are separate from **execution-time** drift (`vault/spec.md` §3, §6).

## Multi-token (hackathon minimum)

- **`rebalance.mjs`** routes **any** tracked asset listed under **`config/chain/<chain>.yaml` → `tokens`** against **WETH** and **USDC** using **USDC as hub** (single-hop to USDC where a pool exists; **two-hop** `exactInput` for **WETH ↔ optional third token**, e.g. **cbETH** on Base mainnet in `base.yaml`).
- Add **`tokens.<SYMBOL>.address`**, **`decimals`**, and **`usdc_pool_fee`** (Uniswap v3 tier for the **TOKEN/USDC** pool). Governance must **allowlist** the token and keep an oracle on the vault.
- If drift is only on a token **not** in the chain yaml routing set, add it to yaml + vault or implement custom `SwapStep`s.
