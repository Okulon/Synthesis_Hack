# Vault — technical spec (DAO Agent)

**Location:** `contracts/` will implement this design (Foundry/Hardhat). This doc is the **source of intent** for the on-chain treasury.

**Related:** [`docs/PROJECT_SPEC.md`](../docs/PROJECT_SPEC.md) (product MVP), [`config/chain/contracts.yaml`](../config/chain/contracts.yaml) (addresses), [`config/rebalancing/bands.yaml`](../config/rebalancing/bands.yaml) (off-chain band defaults; governance may mirror on-chain).

---

## 1 — Role of the vault

| Responsibility | Owner |
|----------------|--------|
| Hold pooled assets | **Vault** |
| Mint/burn **share** tokens | **Vault** |
| User **deposit** / **withdraw** / **redeem** (must work **without** off-chain agent) | **Vault** (permissionless for holders) |
| Routine **rebalancing** (swaps toward voted target, subject to bands) | **Executor** (bot key / contract), within vault-enforced caps |
| Parameter changes (allowlist, slippage caps, pause flags) | **Governance** (staged: multisig → on-chain votes later) |
| **Per-cycle P&L attribution** (see §6) | **Agent/indexer + contracts (MVP split)** |

**Non-goal:** The off-chain agent is **not** required for users to exit. If the agent is down, **deposits/withdrawals** still succeed on-chain (unless governance has fully paused exits — see §8).

---

## 2 — High-level architecture

- **Share-based pooled vault** (ERC-4626 *semantics*, not necessarily literal inheritance on day one).
- **Multi-underlying** in MVP: **2–3 allowlisted ERC-20s** on **Base** (see [`PROJECT_SPEC` §2](../docs/PROJECT_SPEC.md)).
- **Accounting unit:** define **`totalAssets()`** in a single **unit of account** (e.g. USDC-equivalent) via explicit pricing rules, or start **simpler** for hackathon: *two-asset vault with documented conversion* — implementer chooses minimal path but must document `previewRedeem` behavior.

**Custody model (decided for implementation):** **Vault contract holds assets**; **executor** is a separate address with **narrow permissions** (swap-only paths, no arbitrary transfer of user principal).

---

## 3 — Deposits

- User transfers allowed ERC-20 into vault; vault **mints shares** according to **exchange rate** at deposit time.
- **Formula (conceptual):** `shares_minted = f(deposit_value, total_assets_before, total_shares_before)` with standard ERC-4626 rounding rules when using that base.
- **Events:** `Deposit`, updated totals for indexers.

**UX note (native ETH):** The vault API is **ERC-20 `deposit(asset, …)`** — it does **not** take native ETH. Clients that start from ETH must **wrap** (e.g. WETH) and/or **swap** via external routers *before* calling `deposit` on an allowlisted token. The hackathon **frontend** exposes a labeled **TEST** flow: wrap → Uniswap v3 WETH→USDC → `deposit(USDC, …)` (testnet-oriented; see [`frontend/README.md`](../frontend/README.md)).

**Product lock (allocation voting):** **Deposit** and **redeem/withdraw** are **always available** when not globally paused — **no** cycle-phase lock on liquidity. **Allocation votes** use a **snapshot** of share balances (and trust, if applicable) at a defined **vote cutoff**. Holders who **mint shares after** that snapshot **do not vote in that cycle**; they participate in **allocation votes starting the next cycle**. See [`PROJECT_SPEC.md`](../docs/PROJECT_SPEC.md) §2.0.

**P&L / Tier A:** **Mid-cycle deposits and withdrawals** still affect NAV between `navStart` and `navEnd`; document in `BUILD_LOG` / README how **operator-posted** cycle boundaries interact with flows (small TVL / short testnet cycles vs production ~**30-day** cadence — same vault rules, different timing config).

---

## 4 — Withdrawals & “redeem to single asset”

Users may hold economic exposure across **N** assets (`N` small in MVP). **UX target:** user exits in **one** token (`assetOut`), e.g. USDC.

### 4.1 Share accuracy

- User specifies **shares to burn** (or assets to receive — pick one primary API and document).
- **Shares burned are exact** on-chain.

### 4.2 Single-asset exit (intended flow)

**Implementation (`contracts/src/DAOVault.sol`):** user passes an ordered array of **`SwapStep { tokenIn, router, data }`**. The vault approves at most that redeemer’s **slice** of `tokenIn` and executes `router.call(data)`, so **routing stays in calldata** (any client can build it). Swaps should generally send **`assetOut` back to the vault** until final settlement; the contract then transfers aggregate **`assetOut`** to `msg.sender` subject to **`minAmountOut`**.

1. User calls `redeemToSingleAsset(shares, assetOut, minAmountOut, ...)` (exact name TBD).
2. Contract computes the **pro-rata** claim those shares represent against **vault holdings** (or against internal NAV).
3. Vault uses **allowlisted DEX router** (Uniswap v3 on Base) to swap the constituent pieces into **`assetOut`**, respecting:
   - governance **max slippage** / **minAmountOut** per call;
   - **allowlisted** tokens and **allowlisted** routers/pools.
4. Transfers **`assetOut`** to user.

### 4.3 Slippage, fees, “10% shares → ~9.95% value”

- **DEX LP fees + price impact** reduce output vs an ideal quote.
- User provides **`minAmountOut`** (or vault derives from governance bps cap): execution **reverts** if swaps cannot achieve at least that — user **keeps shares**.
- Optional **protocol withdrawal fee** (bps) — if added, must be **explicit** in code and docs.

### 4.4 Pro-rata basket (non-MVP default)

- Returning **N** tokens in one `redeem` is **gas-expensive** for large `N`; not the primary UX path.

---

## 5 — Rebalancing (executor)

- **Goal:** Move holdings toward **aggregated vote target** weights from the current cycle.
- **Bands:** Off-chain agent applies **drift thresholds** (`ε`, min notional) per [`PROJECT_SPEC` §2.1](../docs/PROJECT_SPEC.md); on-chain, executor must still respect **hard caps** (allowlist, max slippage, max single-asset weight).
- **Who signs:** executor EOA or executor contract; preferably scoped via **delegations** narrative for sponsor alignment.
- **Independence:** rebalancing **never** blocks `redeem` / `withdraw` in MVP unless explicitly designed otherwise.

---

## 6 — Per-cycle profit, trust, and upside distribution

Users hold **shares** (pro-rata claim on vault NAV). Separately, the system must **measure performance each allocation cycle** and **allocate the cycle’s profit** (if any) in a way that rewards **better market calls** (`trust`) while still tying entitlement to **economic stake** (`share`).

### 6.1 Definitions

- **Cycle:** Same window as an **allocation vote → rebalance → settle** round (length governance-configurable; see [`config/governance/defaults.yaml`](../config/governance/defaults.yaml)).
- **`trust_i`:** Non-negative score for user *i*, updated after the cycle from how their **submitted vote** would have performed vs a **benchmark** (rolling window, floor/ceiling — [`config/trust/scoring.yaml`](../config/trust/scoring.yaml), [`PROJECT_SPEC`](../docs/PROJECT_SPEC.md)). **Implemented:** agent runs `trust-finalize-window` on rollover (time-weighted portfolio return from vote-time USDC prices to cycle-end prices); `trust.mjs` applies `scoring.yaml` update rule to produce per-voter scores. Dev knobs for testnet: `TESTWETHOCCILATOR` (synthetic prices), `TESTBOOSTTRUST` (amplify bps).
- **`share_i`:** User *i*’s vault shares at the **snapshot** used for profit distribution (see §6.3).

### 6.2 Cycle P&L (vault-level)

Using a single **unit of account** *U* (e.g. USDC-equivalent), consistent with §2:

1. **`NAV_start`:** Total vault value in *U* at cycle start (snapshot block or timestamp).
2. **`NAV_end`:** Total vault value in *U* at cycle end.

**Gross cycle result** (conceptual; implementer adds deposit/withdraw **adjustments** so new capital doesn’t look like alpha):

`cycle_result = NAV_end - NAV_start + (deposit/withdraw adjustments)`

- **If `cycle_result ≤ 0` (loss or flat):** treat as **no profit to allocate** for trust-skewed upside this cycle; **losses** hit all participants **by share only** (trust does **not** increase loss share — product rule per [`PROJECT_SPEC`](../docs/PROJECT_SPEC.md)).
- **If `cycle_result > 0`:** **`profit_cycle = cycle_result`** is the pool available for **trust-weighted upside allocation** for that cycle (before governance fees, if any).

Document the exact **adjustment** rule in code (MVP can **freeze deposits/withdrawals** over the cycle boundary to simplify).

### 6.3 Profit share weights (share × trust)

For **positive `profit_cycle` only**, assign each participant a **profit weight** combining stake and skill:

`w_i = share_i_at_snapshot × g(trust_i)` — normalize to `ŵ_i` so Σŵ_i = 1 over the chosen participant set.

- **`g(trust)`** is governance-chosen: e.g. `trust^α` with `α > 0`, or piecewise linear, with **`g(1)=1`** for neutral trust so newcomers aren’t penalized.
- **Normalize:** `ŵ_i = w_i / Σ_j w_j` over everyone who **participated** in the cycle or over **all** shareholders — **pick one** and document (affects passive holders).

**Minimum upside:** Optionally enforce a floor on `ŵ_i` so low-trust users still receive **some** cycle profit (mass redistributed from high-trust — or subsidized from protocol fee — document).

**Claims:**

- **Principal / NAV:** Still represented by **redeeming shares** at current exchange rate.
- **Cycle profit attribution:** Either (MVP) **accrued internally** and merged into NAV via **share price increase** after distribution math, or **claimable yield** in *U* — see §6.4.

### 6.4 MVP implementation tiers (pick one for the hackathon)

| Tier | What ships | Trust / P&L |
|------|------------|----------------|
| **A — Ledger + demo script** | On-chain: `CycleClosed` event with **`NAV_start`, `NAV_end`, cycle id`**. Off-chain: DB stores `trust_i`, computes `ŵ_i`, logs **“profit split”** CSV; **no** separate claiming unless you add a small Merkle drop. | Fastest; judges see **transparent math**. |
| **B — Accrue into share price** | At cycle end, **mint** protocol shares or **adjust** exchange rate so post-distribution NAV per share reflects profit allocated by `ŵ_i`. | Economically clean but **must not** double-count with naive ERC-4626; often needs **custom ledger** or **second accounting token**. |
| **C — Merkle / streaming claim** | Deploy **`claimProfits(cycleId, amount, proof)`** fed by off-chain root after cycle settles. | Strong audit trail; more Solidity time |

**Recommendation:** **Tier A** for slice + **one** Tier-C-style **optional** claim tx if time allows.

### 6.5 What the vault contract should guarantee

- **Shares** always redeem pro-rata **current** vault assets (§4).
- **Profit-skew** is an **explicit** layer: either merged into vault accounting (Tier B) or **separate claim** (Tier C). Do **not** silently “tax” redeemers without documenting it.
- **Trust values** used in §6.3 should be **snapshot** at cycle end and **verifiable** (hash commitments or on-chain storage in later versions).

### 6.6 Tier A ledger vs deposits / withdrawals (this repo)

**`cycle-profits.json`** (written when **`closeCycle`** succeeds or via **`npm run profit:export`**) attributes each cycle’s **profit pool** to ballot participants **∝ trust_before × shares** at the vote snapshot. The pool is **`NAV_end − NAV_start`** from the **`closeCycle`** boundary (or a **synthetic** uniform draw when **`TESTGAINS`** is set for testnet demos).

- **Not Tier B:** the pool is **not** adjusted for **net deposits and withdrawals** mid-cycle (§6.2 “deposit/withdraw adjustments” remain backlog). Treat the JSON as **transparent attribution math** for governance/trust demos, not a regulated P&L statement.
- **Redeem:** users still exit via **shares vs live vault balances** (§4); **illiquid** assets or failed swaps are **revert / user `minOut`**, not silent haircuts in this MVP.

---

## 7 — Access control summary

| Role | Capabilities |
|------|----------------|
| **Anyone** | `deposit` (when not paused) |
| **Share holders** | `redeem` / `withdraw` (when not paused for exits) |
| **Executor** | Swap / rebalance routes **only** as encoded (no blanket `transfer` of arbitrary vault tokens to arbitrary addresses unless via approved router paths) |
| **Governance** | Set allowlist, caps, fee params, pause flags, executor address |
| **Admin (bootstrap)** | May exist only for hackathon deploy — **document** and aim to renounce or transfer to governance |

---

## 8 — Pause semantics

**Preferred MVP pattern:**

- **`pauseTrading`** — blocks executor swaps and possibly deposits if needed; **does not** block **user redemptions** if vault is solvent.
- **`pauseAll`** — emergency only; acknowledge **users cannot exit** while active — avoid unless absolutely necessary.

Exact flags are implementation details; this spec requires **documenting** which operations each pause affects.

---

## 9 — Security & invariants (targets)

1. **No infinite mint / inflation bugs** — use OZ ERC-4626 math or audited patterns.
2. **Reentrancy** — guard external calls (router callbacks).
3. **Oracle / price manipulation** — MVP may use **TWAP** or **simplified** pricing; document attack surface.
4. **Router / token allowlist** — executor cannot send funds to arbitrary addresses outside swap paths.
5. **Solvency** — `redeem` must not succeed beyond **actual** balances + swap capacity; document behavior when illiquid.

---

## 10 — Stack & network

- **Chain:** Base (mainnet MVP or **Base Sepolia** for demo — document in deploy README).
- **DEX:** Uniswap v3 (addresses via governance/config — [`config/dex/uniswap.yaml`](../config/dex/uniswap.yaml)).
- **Tooling:** Foundry (recommended) or Hardhat; tests for deposit/redeem/pause/executor rejection cases.

---

## 11 — Deliverables checklist (vault track)

- [x] `contracts/` implementation matching §3–7, §8–11 (Tier A §6); **on-chain caps** (`maxSlippageBps` / weight) still optional backlog
- [x] Unit tests + optional **mainnet fork** test ([`UniswapBaseFork.t.sol`](../contracts/test/UniswapBaseFork.t.sol); requires `BASE_MAINNET_RPC_URL`)
- [x] Deploy / configure scripts + **[`docs/DEPLOY.md`](../docs/DEPLOY.md)**; **you** paste addresses into README + `.env`
- [ ] User-facing **“How to redeem”** judge paragraph in root README *(partially covered in [`contracts/README.md`](../contracts/README.md))*
- [x] Explicit **trust assumptions** — [`VAULT_ORACLE_AND_GOVERNANCE.md`](../docs/VAULT_ORACLE_AND_GOVERNANCE.md) + spec §9
- [x] **Cycle P&L** surface — `CycleClosed` + Tier A off-chain splits ([`PROJECT_SPEC`](../docs/PROJECT_SPEC.md) §2.2)
- [ ] **Profit distribution v0:** Tier A CSV fully demo’d *(formula documented; automation optional)*

---

## 12 — Open implementation choices (resolve in `BUILD_LOG`)

- ERC-4626 **inheritance** vs **custom** vault — **custom** multi-asset (`DAOVault`)
- Exact **`totalAssets`** definition for multi-token (oracle vs reserves-only for MVP)
- Whether **`deposit` allowed** when `pauseTrading` is on
- **`redeem` path:** single multicall-style swap vs per-asset iterate (gas limit)
