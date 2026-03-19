# Vault — build checklist

Everything to ship the on-chain treasury per [`spec.md`](./spec.md). Check boxes as you complete; resolve open choices in [`docs/BUILD_LOG.md`](../docs/BUILD_LOG.md).

---

## 0 — Tooling & layout

- [ ] Add **`contracts/`** at repo root (or agree subpath) with **Foundry** (`foundry.toml`: Solidity version, **Base** + **Base Sepolia** RPC profiles)
- [ ] **OpenZeppelin** contracts dependency (ERC-20, ERC-4626 and/or Solmate if preferred)
- [ ] **`lib/`** git submodules or `forge install` documented in root README
- [ ] **`script/`** deploy scripts; **`test/`** unit + (optional) fork tests
- [ ] `.env` / `.env.example` keys for deployer, RPC, verified **router/quoter** addresses (see [`config/chain/contracts.yaml`](../config/chain/contracts.yaml))

---

## 1 — Design locks (before coding core)

- [ ] Decide **ERC-4626 inherit** vs **custom** vault with same user-facing preview methods ([`spec.md` §12](spec.md))
- [ ] Decide **MVP asset count:** start **single underlying** then generalize, vs **2–3 ERC-20** from day one ([`spec.md` §2](spec.md))
- [ ] Define **`totalAssets` / NAV** in **one unit of account** (USDC peg, oracle, or reserves-only shortcut) — document in code comments + README
- [ ] Document **mid-cycle deposits** rule (forbid vs simplify math) ([`spec.md` §3](spec.md))
- [ ] Lock **`assetOut`** list for `redeemToSingleAsset` (subset of allowlist)

---

## 2 — Share token & accounting

- [ ] **Share token** (ERC-20) name/symbol; **mint** on deposit, **burn** on redeem
- [ ] Correct **rounding** (4626-style round-down on mint, round-down on redeem assets — or documented alternates)
- [ ] **`totalSupply`**, **`convertToShares` / `convertToAssets`** (or equivalents) exposed for agent + UI
- [ ] **Events** for mint/burn/deposit/redeem indexable by subgraph or off-chain agent

---

## 3 — Deposits ([`spec.md` §3](spec.md))

- [ ] **`deposit(asset, amount, receiver)`** (or batch) — **only** allowlisted `asset`
- [ ] **Pull** asset via safeTransferFrom; update internal balances / totalAssets logic
- [ ] **Reverts** on zero amount, bad asset, full pause if deposits disabled
- [ ] Optional: **disable deposits** when `pauseTrading` only — decide and document ([`spec.md` §8](spec.md))

---

## 4 — Withdraw / redeem ([`spec.md` §4](spec.md))

- [ ] **Burn shares**; amount exact per user input
- [ ] **`redeemToSingleAsset`** (final name in ABI): args include **`assetOut`**, **`minAmountOut`**, **`shares`**
- [ ] Compute user’s **pro-rata** claim on vault token balances for burned shares
- [ ] **Swap path(s)** via **allowlisted Uniswap v3 router** (pool fee tiers from config/governance)
- [ ] Enforce **governance max slippage** + user **`minAmountOut`**
- [ ] **Reentrancy** guards on external swap callbacks
- [ ] Document **no silent haircut** — explicit fees if any ([`spec.md` §4.3](spec.md))
- [ ] (Stretch) Standard **`redeem`** / **`withdraw`** if you want pure 4626 compatibility alongside single-asset exit

---

## 5 — Allowlists & risk caps ([`spec.md` §7](spec.md), §9)

- [ ] **Token allowlist** (add/remove gated by governance role)
- [ ] **Router + optional pool allowlist** (executor cannot call arbitrary contracts)
- [ ] **`maxSlippageBps`** (or per-swap ceiling) stored on-chain
- [ ] **`maxSingleAssetWeightBps`** or equivalent if portfolio caps are on-chain
- [ ] **Governance** role: Ownable / AccessManager / multisig — document who holds it at deploy

---

## 6 — Executor & rebalancing ([`spec.md` §5](spec.md))

- [ ] **`executor`** address set by governance; **`onlyExecutor`** modifier
- [ ] **Swap / rebalance** entrypoint(s): e.g. `rebalance(...)` with calldata to router or internal swap helper
- [ ] **Cannot** move user funds except through defined swap/withdraw paths
- [ ] **Reverts** when `pauseTrading` or not executor
- [ ] Off-chain **bands** (`ε`) remain in agent; on-chain still enforces **hard** caps (this checklist = vault side)

---

## 7 — Pause ([`spec.md` §8](spec.md))

- [ ] **`pauseTrading`** — blocks executor (and policy for deposits); **does not** block user **redeem** (MVP default)
- [ ] **`pauseAll`** (optional) — document that **exits** are blocked; use only if unavoidable
- [ ] Events for pause state changes

---

## 8 — Per-cycle P&L surface ([`spec.md` §6](spec.md) — Tier A bias)

- [ ] **`cycleId`** increment or governance-set
- [ ] **`cycleOpen` / `cycleClose`** (or single `closeCycle`) callable by **governance** or **operator** (document trust model — bot should not unilaterally lie about NAV without constraints)
- [ ] Persist or emit **`NAV_start`**, **`NAV_end`** in **unit of account** (uint with documented decimals)
- [ ] Emit **`CycleClosed(cycleId, navStart, navEnd, timestamp)`** (fields as needed for off-chain profit-split CSV)
- [ ] Document **deposit/withdraw adjustments** if `NAV_end - NAV_start` is not raw P&L ([`spec.md` §6.2](spec.md))

*(Profit weights `ŵ_i` / `g(trust)` stay **off-chain** for Tier A unless you add Merkle claim — [`spec.md` §6.4](spec.md).)*

---

## 9 — Security pass ([`spec.md` §9](spec.md))

- [ ] No **mint** without deposit; no **drain** via executor except swaps
- [ ] **Oracle / TWAP** choice documented; minimal exposure for MVP
- [ ] **Solvency:** revert or partial behavior when **insufficient liquidity** for `redeemToSingleAsset` documented
- [ ] Slither / static read optional but nice

---

## 10 — Tests

- [ ] Deposit → shares minted correctly (multiple users)
- [ ] Redeem → shares burned; **assetOut** received ≥ min (mock router or fork)
- [ ] Non-allowlisted **asset** / **router** reverts
- [ ] **Executor** cannot call restricted functions; non-executor cannot rebalance
- [ ] **Pause** matrix: trading blocked, redeem allowed (unless `pauseAll`)
- [ ] **Cycle** close emits/stores NAV fields
- [ ] (Fork) **Base Sepolia** or Base mainnet fork — one real Uniswap swap path smoke test if feasible

---

## 11 — Deploy & ops

- [ ] **Base Sepolia** deploy + **verify** on Basescan
- [ ] Constructor args documented; **set executor** + **seed allowlist** via script
- [ ] Addresses in root **README** + update **[`config/chain/contracts.yaml`](../config/chain/contracts.yaml)** env key names
- [ ] Backup **deployer key** handling — never in git

---

## 12 — Docs & demo

- [ ] **`vault/spec.md`** updated if implementation diverges (footnote deltas)
- [ ] Root README: **how to deposit / redeem** + **Basescan** links
- [ ] Short **“agent down, user can still redeem”** sentence for judges ([`spec.md` §1](spec.md))
- [ ] Optional: **architecture diagram** snippet in README or [`STRUCTURE.md`](../STRUCTURE.md)

---

## Related

- [`spec.md`](./spec.md) — full intent  
- [`docs/PROJECT_SPEC.md`](../docs/PROJECT_SPEC.md) — product MVP  
- [`TRACKS.md`](../TRACKS.md) — Uniswap + MetaMask alignment  
