# Vault — build checklist

Everything to ship the on-chain treasury per [`spec.md`](./spec.md). Check boxes as you complete; resolve open choices in [`docs/BUILD_LOG.md`](../docs/BUILD_LOG.md).

---

## 0 — Tooling & layout

- [x] Add **`contracts/`** at repo root (or agree subpath) with **Foundry** (`foundry.toml`: Solidity version, **Base** + **Base Sepolia** RPC profiles)
- [x] **OpenZeppelin** contracts dependency (ERC-20, ERC-4626 and/or Solmate if preferred)
- [x] **`lib/`** git submodules or `forge install` documented in root README
- [x] **`script/`** deploy scripts; **`test/`** unit + (optional) fork tests
- [x] `.env` / `.env.example` keys for deployer, RPC, verified **router/bot** addresses (`PRIVATE_KEY` in `.env.example`; **live router addresses** TBD after deploy — see [`config/chain/contracts.yaml`](../config/chain/contracts.yaml))

---

## 1 — Design locks (before coding core)

- [x] **ERC-4626** vs **custom** — **custom** multi-asset (`DAOVault.sol`; mint **virtual offset**, not full 4626 surface)
- [x] **MVP asset count** — **multi-asset** allowlisted ERC-20s from day one
- [x] **`totalNAV()`** — governance **`navPricePerFullToken1e18`** (abstract **1e18** unit); see [`contracts/README.md`](../contracts/README.md)
- [x] **Mid-cycle deposits** — **documented** in [`spec.md` §3](spec.md) (hackathon default + P&L caveat)
- [x] **`assetOut`** — allowlisted token present in **`trackedAssets`** (after at least one deposit of that asset)

---

## 2 — Share token & accounting

- [x] **Share token** — ERC-20 mint/burn on deposit/redeem
- [x] **Rounding** — `Math.mulDiv` **Floor** + first-depositor-style offset on mint
- [ ] **`convertToShares` / `convertToAssets`** — not exposed (optional later for UIs/agents)
- [x] **Events** — `Deposit`, `RedeemSingle` + ERC-20 `Transfer`

---

## 3 — Deposits ([`spec.md` §3](spec.md))

- [x] **`deposit(asset, amount, receiver)`** — allowlisted + `navPrice > 0`
- [x] **`safeTransferFrom`**; NAV from balances × prices
- [x] **Reverts** — zero amount, bad asset, `pauseAll` / `pauseDeposits`
- [x] **`pauseTrading`** ≠ auto-pause deposits — use **`pauseDeposits`** (document in deploy README / spec §8)

---

## 4 — Withdraw / redeem ([`spec.md` §4](spec.md))

- [x] **Burn shares** — user-chosen amount
- [x] **`redeemToSingleAsset(shares, assetOut, minAmountOut, SwapStep[])`**
- [x] **Pro-rata** slices; **slice-capped** approvals on redeem
- [x] **Swaps** — allowlisted `router` + `data` (Uniswap v3 encoded off-chain); no in-vault v3 adapter
- [ ] **`maxSlippageBps`** on-chain — **not** yet; user **`minAmountOut`** only
- [x] **`ReentrancyGuard`**
- [x] **No silent haircut** — revert if below `minAmountOut`
- [x] **`redeemProRata`** (basket exit)
- [ ] (Stretch) ERC-4626 **`redeem`/`withdraw`** for a single underlying

---

## 5 — Allowlists & risk caps ([`spec.md` §7](spec.md), §9)

- [x] **Token allowlist** (`onlyOwner`)
- [x] **Router allowlist** — no per-**pool** allowlist yet
- [ ] **`maxSlippageBps`** on-chain
- [ ] **`maxSingleAssetWeightBps`** on-chain
- [x] **`Ownable`** + separate **`executor`**

---

## 6 — Executor & rebalancing ([`spec.md` §5](spec.md))

- [x] **`executor`** + **`onlyExecutor`**
- [x] **`rebalance(SwapStep[])`** — full vault `tokenIn` balance may be approved per step (executor privilege)
- [x] Users use **redeem** / **redeemProRata**; executor only **rebalance**
- [x] **Reverts** when paused / wrong caller
- [ ] **Hard caps** still thin — **next:** governance slippage / pool allowlist to match spec story

---

## 7 — Pause ([`spec.md` §8](spec.md))

- [x] **`pauseTrading`** — blocks **rebalance**; **not** redeem (unless `pauseAll`)
- [x] **`pauseAll`** — blocks **redeem** + deposits
- [x] **`PauseUpdated`**

---

## 8 — Per-cycle P&L surface ([`spec.md` §6](spec.md) — Tier A bias)

- [x] **`cycleId`** + **`closeCycle`** (`onlyOwner`)
- [x] **`CycleClosed(cycleId, navStart, navEnd, timestamp)`** — NAV bounds operator-posted (Tier A trust model)
- [x] **Emit** NAV fields (no extra on-chain storage required for Tier A)
- [ ] Document **deposit/withdraw adjustments** for P&L (README / `BUILD_LOG`)

*(Profit weights `ŵ_i` / `g(trust)` stay **off-chain** for Tier A unless you add Merkle claim — [`spec.md` §6.4](spec.md).)*

---

## 9 — Security pass ([`spec.md` §9](spec.md))

- [x] No **mint** without **deposit**; redeem **slice caps**; malicious **router** = governance risk
- [ ] **Oracle / TWAP** — today **owner-set** prices; document attack surface / upgrade path
- [ ] **Solvency / illiquid redeem** — document **`MinOut` / `IncompleteRedeem`** for judges
- [ ] Slither / static read (optional)

---

## 10 — Tests

- [ ] Deposit → shares (**multi-user** case)
- [x] Redeem → burn; **assetOut** ≥ min (mock router)
- [ ] Non-allowlisted **asset** / **router** explicit reverts
- [x] **`rebalance`** gated to **executor**
- [x] **`pauseAll`** blocks redeem (`test_pause_all_blocks_redeem`)
- [x] **`pauseTrading`** blocks rebalance but **not** redeem — see `test_pause_trading_blocks_rebalance_but_not_redeem`
- [x] **`closeCycle`** emits
- [x] (Fork) **Base** + Uniswap V3 **factory/pool** smoke test ([`test/UniswapBaseFork.t.sol`](../contracts/test/UniswapBaseFork.t.sol); swaps are calldata-built off-chain per spec)

---

## 11 — Deploy & ops

- [ ] **Base Sepolia** deploy + **Basescan verify** *(you run `forge script --broadcast`; see [`docs/DEPLOY.md`](../docs/DEPLOY.md))*
- [x] Post-deploy **configure** in-repo — **`DeployConfigureDAOVault`** (mocks + allowlists + router + executor) or **`ConfigureDAOVault`** for existing `VAULT_ADDRESS`
- [ ] Addresses in **README** + [`config/chain/contracts.yaml`](../config/chain/contracts.yaml) *(after your deploy)*
- [x] **Secrets** — `.gitignore` / `.env.example` only; never commit keys

---

## 12 — Docs & demo

- [x] **`vault/spec.md`** §4.2 — **`SwapStep`** implementation note
- [ ] README **judge path**: deposit / redeem steps + **Basescan** (after deploy)
- [ ] One line: **agent down, calldata redeem still works** ([`spec.md` §1](spec.md))
- [x] [`STRUCTURE.md`](../STRUCTURE.md) lists **`contracts/`**

---

## Related

- [`spec.md`](./spec.md) — full intent  
- [`docs/PROJECT_SPEC.md`](../docs/PROJECT_SPEC.md) — product MVP  
- [`TRACKS.md`](../TRACKS.md) — Uniswap + MetaMask alignment  
