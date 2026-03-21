# Proof pack — Synthesis / judges

**Purpose:** Single place to collect **explorer links**, **tx hashes**, **deployed URLs**, and **submission metadata** as you gather them. Replace every `_TODO_` / placeholder below; keep **private keys and API secrets out of git** (use env + local notes).

**Local deploy artifact → address hints** (after `forge script … --broadcast`, `contracts/broadcast/` is gitignored):  
`npm run proof:hints -- contracts/broadcast/<YourScript>/<chainId>/run-latest.json`

**Related:** [`checklist.md`](../checklist.md) **§A–B, C2–C3**, [`docs/BUILD_LOG.md`](BUILD_LOG.md) **Current state**, [`TRACKS.md`](../TRACKS.md), [`HUMAN_ONLY.md`](HUMAN_ONLY.md) (what’s left for you).

### Suggested fill order

1. **§0–1** — Chain ID, explorer base, **public** contract addresses (from deploy / Basescan).
2. **§2** — Uniswap proof txs (**U1** `rebalance`, **U2** user swap).
3. **§3** — Demo story txs (deposit, ballot, `closeCycle`, rebalance, redeem).
4. **§4** — Agent command + **live outcomes** links; edit testnet caveat if needed.
5. **§5–6** — Production app URL + **video** link.
6. **§7** — Repo URL, track UUIDs (`npm run synthesis:catalog` from repo root), paste from [`SUBMISSION_METADATA.md`](SUBMISSION_METADATA.md).
7. **§8–10** — Reproducible artifacts, disclosure scratchpad, verify status.

---

## 0 — Chain & explorer

| Field | Value |
|--------|--------|
| **Chain** | Base Sepolia _(or Base mainnet if you switch)_ |
| **Chain ID** | `_TODO_` |
| **Explorer base URL** | `https://sepolia.basescan.org` _(Sepolia)_ — use this pattern for links: `{EXPLORER}/tx/{HASH}` |

---

## 1 — Deployed contracts & roles

Paste **public** addresses (from deploy / `.env` / Basescan). Names align with [`config/chain/contracts.yaml`](../config/chain/contracts.yaml) env vars.

| Role / contract | Address | Basescan (read contract) | Verified on explorer? |
|-----------------|--------|---------------------------|------------------------|
| **DAOVault** (`VAULT_ADDRESS`) | `_TODO_` | `_TODO_` | `_TODO_` yes / no / n/a |
| **Governance** (`GOVERNANCE_ADDRESS`) | `_TODO_` | `_TODO_` | `_TODO_` |
| **Executor** (vault `executor` / `EXECUTOR_ADDRESS`) | `_TODO_` | `_TODO_` | `_TODO_` |
| **SwapRouter02** (v3 router used by vault) | `_TODO_` | `_TODO_` | _(canonical contract — note address)_ |
| **QuoterV2** (off-chain quotes; frontend + agent) | `_TODO_` | `_TODO_` | _(canonical — note)_ |
| **WETH** (canonical on chain) | `_TODO_` | `_TODO_` | |
| **USDC** | `_TODO_` | `_TODO_` | |
| **Uniswap v3 pool** WETH/USDC _(fee tier used, e.g. 3000)_ | Pool address `_TODO_` | `_TODO_` | |

**Notes (optional):** deploy tx, proxy admin, timelock — `_TODO_`

---

## 2 — Uniswap track — mandatory tx proof ([`checklist.md`](../checklist.md) **C2**)

| # | What | Tx hash | Explorer link | Notes |
|---|------|---------|-----------------|-------|
| **U1** | **Agent `rebalance`** — real `DAOVault.rebalance` with ≥ one **Uniswap** `SwapStep` | `_TODO_0x…` | `_TODO_` | Log line or `plan` snapshot path: `_TODO_` |
| **U2** | **User-path swap** — e.g. **TEST** panel ETH→USDC→deposit **or** **single-asset redeem** with router swap | `_TODO_0x…` | `_TODO_` | Which UI: `_TODO_` |
| **U3** | _(Optional)_ Second rebalance or different leg (e.g. USDC→WETH) | `_TODO_` | `_TODO_` | |

**Stack disclosure (README / submission):**

- Router: **Uniswap v3 SwapRouter02** on Base — `_TODO_ confirm address`
- **QuoterV2** used for `minOut` / quotes in agent + frontend — `_TODO_`
- **Not** claiming unless implemented: Permit2 `_TODO_`, Uniswap **API** on critical path `_TODO_`, v4 hooks `_TODO_`

---

## 3 — Demo story — txs to show in video / README ([`checklist.md`](../checklist.md) **B**)

Fill as many as you have; **B** asks at minimum deposit + ≥1 rebalance.

| Step | Story beat | Tx hash | Link |
|------|------------|---------|------|
| **D1** | First **deposit** (user wallet → vault) | `_TODO_` | `_TODO_` |
| **D2** | **Cast allocation ballot** (on-chain vote) | `_TODO_` | `_TODO_` |
| **D3** | **`closeCycle`** (governance — if shown) | `_TODO_` | `_TODO_` |
| **D4** | **`rebalance`** (executor) | `_TODO_` _(can duplicate U1)_ | `_TODO_` |
| **D5** | **Redeem** — pro-rata basket **or** single-asset with swap | `_TODO_` | `_TODO_` |
| **D6** | **“Below ε, no swap”** — `plan` output / log showing skip _(tx optional)_ | N/A or `_TODO_` | Screenshot or log: `_TODO_` |

---

## 4 — Autonomous agent — Base track ([`checklist.md`](../checklist.md) **C3**)

| Field | Value |
|--------|--------|
| **Command** | e.g. `npm run agent` from repo root — `_TODO_` |
| **Schedule / daemon** | cron, GitHub Action, manual — `_TODO_` |
| **Env vars** (names only; no secrets) | `AGENT_*`, `CHAIN_RPC_URL`, `VAULT_ADDRESS`, … `_TODO_` |
| **What runs without UI clicks** | e.g. plan → rebalance when bands say so — `_TODO_` |
| **Evidence** | log excerpt, CI run URL, or screen recording timestamp — `_TODO_` |

**Live outcomes (not a backtest):**

| Field | Value |
|--------|--------|
| **CycleClosed** / NAV — link or block range | `_TODO_` |
| **Testnet liquidity caveat** (paste into video/README if using Base Sepolia) | **Default:** Pools on Base Sepolia can be thin or mispriced vs oracles; **NAV** uses governance oracles while **fills** use Uniswap — large divergence is expected on testnet. **Not** mainnet PnL. Edit if your run differs. |

**Demo-only knobs** (label in video/README — not production alpha):

| Knob | Purpose | Shown in demo? |
|------|---------|----------------|
| `TESTWETHOCCILATOR` | `_TODO_` | `_TODO_` |
| `TESTGAINS` | `_TODO_` | `_TODO_` |
| _(other)_ | `_TODO_` | `_TODO_` |

---

## 5 — Frontend & hosting

| Field | Value |
|--------|--------|
| **Production app URL** (judges, no login wall) | `_TODO_https://…_` |
| **Host** (e.g. Vercel production, not preview) | `_TODO_` |
| **Chain** the UI targets | Base Sepolia `_TODO_` |
| **Env** documented for judges | see [`frontend/.env.example`](../frontend/.env.example) — `_TODO_ note if custom_` |

---

## 6 — Media & social proof

| Field | Value |
|--------|--------|
| **Video** (2–5 min; BaseScan tabs visible) | URL `_TODO_` |
| **Video** outline / timestamps | `_TODO_` problem → vote → rebalance → (optional) skip |
| **Moltbook** `moltbookPostURL` | `_TODO_` |

---

## 7 — Synthesis / Devfolio submission fields ([`checklist.md`](../checklist.md) **A**)

| Field | Value |
|--------|--------|
| **Public `repoURL`** | `_TODO_` |
| **`conversationLog`** pointer | e.g. [`docs/BUILD_LOG.md`](BUILD_LOG.md) — `_TODO_ confirm_` |
| **Track UUIDs** (from `GET https://synthesis.devfolio.co/catalog`) | Open `_TODO_`, Uniswap `_TODO_`, Base `_TODO_`, MetaMask `_TODO_` _(omit if not claiming)_ |
| **Honest `submissionMetadata`** — tools / model / agent | Start from [`docs/SUBMISSION_METADATA.md`](SUBMISSION_METADATA.md); paste into Devfolio |
| **Self-custody** completed | `_TODO_` date / confirm |
| **Draft → publish** | `_TODO_` |

---

## 8 — Reproducible cycle (one loop)

Judges can replay:

| Artifact | Path / command | Notes |
|----------|----------------|-------|
| Targets / aggregate | `config/local/targets.json` (gitignored) — example [`apps/agent/fixtures/targets.example.json`](../apps/agent/fixtures/targets.example.json) | `_TODO_` |
| Plan | `npm run plan` — `_TODO_` | |
| Trust export | `npm run trust:export` — `_TODO_` | |
| Static JSON served by UI | `trust-scores.json`, `trust-history.json`, `cycle-profits.json` — `_TODO_ where hosted_` | |

---

## 9 — Disclosures for README / video ([`checklist.md`](../checklist.md) **B**)

Canonical judge copy lives in the root [**`README.md` — Judge-facing**](../README.md#judge-facing-synthesis) section + **Disclaimer**. Below is a scratchpad / submission paste area:

- **Prototype / pooled capital** — `_TODO_ ok / needs edit_`
- **Oracle vs pool / manipulation** — `_TODO_`
- **Contract risk / not audited** — `_TODO_`
- **Trust v0** — benchmark + sources + known gaps — see [`docs/PROJECT_SPEC.md`](PROJECT_SPEC.md) §7 + [`docs/BAND_POLICY.md`](BAND_POLICY.md) — `_TODO_ pointer_`

---

## 10 — Optional / deferred

| Item | Status |
|------|--------|
| **Contract verify** — [`docs/DEPLOY.md`](DEPLOY.md) §10 | Run after deploy; paste explorer “verified” status in §1 above |
| **MetaMask Delegations** — tx or omit track | `_TODO_` |
| **Telegram** bot demo URL | `_TODO_` |
| **Uniswap API** on critical path | `_TODO_ only if claiming_` |

---

## Changelog

| Date | Note |
|------|------|
| `_TODO_` | Initial placeholder scaffold |
