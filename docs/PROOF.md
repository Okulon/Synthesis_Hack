# Proof pack — Synthesis / judges

**Purpose:** Single place to collect **explorer links**, **tx hashes**, **deployed URLs**, and **submission metadata** as you gather them. Replace every `_TODO_` / placeholder below; keep **private keys and API secrets out of git** (use env + local notes).

**Reconstruction (2026-03-24):** On-chain rows below were filled from **Blockscout** `txlist` on the deployed vault (deploy block **39039142**), **Base Sepolia** RPC `eth_getTransactionByHash` / `cast call` (factory `getPool`), **`forge inspect DAOVault` selectors**, and committed exports **[`frontend/public/cycle-profits.json`](../frontend/public/cycle-profits.json)** (`closeCycle` hashes). **Filled from repo / API (2026-03-24):** `git remote` → **`repoURL`**; paginated **`GET /catalog`** → **track UUIDs** (§7); **[`.github/workflows/agent.yml`](../.github/workflows/agent.yml)** → CI vs daemon; **`cycle-profits.json`** → **`TESTGAINS`** row. **Submit status (2026-03-23):** Devfolio draft **updated** + **published** via API (`status: publish`); **`deployedURL`** set; **MetaMask** track removed from project (deferred); **conversationLog** restored on server. **`videoURL`** — [YouTube demo](https://www.youtube.com/watch?v=pBa5DHpLs5M) **set 2026-03-23** (`npm run synthesis:set-video`). **Optional:** **Moltbook**; **`forge verify`**; **D6** plan-skip if not captured; re-fetch **catalog** if organizers require fresh **UUIDs**.

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
| **Chain** | Base Sepolia |
| **Chain ID** | `84532` |
| **Explorer base URL** | `https://sepolia.basescan.org` — link pattern: `{EXPLORER}/tx/{HASH}` |

---

## 1 — Deployed contracts & roles

Paste **public** addresses (from deploy / `.env` / Basescan). Names align with [`config/chain/contracts.yaml`](../config/chain/contracts.yaml) env vars.

| Role / contract | Address | Basescan (read contract) | Verified on explorer? |
|-----------------|--------|---------------------------|------------------------|
| **DAOVault** (`VAULT_ADDRESS`) | `0xAaaEE1162a544f4207ac694b7aa55ac7b3B5C9b1` | [address](https://sepolia.basescan.org/address/0xAaaEE1162a544f4207ac694b7aa55ac7b3B5C9b1) | **No** verified source on Blockscout as of reconstruction — run [`DEPLOY.md`](DEPLOY.md) **§10** and set **yes** here |
| **Governance** (`GOVERNANCE_ADDRESS`) | `0x7FB7BF5dCecc731aCA64f8431c5dFcfA3aDfdB92` _(EOA `GOVERNANCE_ROLE`; hackathon bootstrap)_ | [address](https://sepolia.basescan.org/address/0x7FB7BF5dCecc731aCA64f8431c5dFcfA3aDfdB92) | n/a (EOA) |
| **Executor** (vault `executor` / `EXECUTOR_ADDRESS`) | `0x7FB7BF5dCecc731aCA64f8431c5dFcfA3aDfdB92` _(on-chain `executor()` matches this EOA)_ | same as governance | n/a (EOA) |
| **SwapRouter02** (v3 router used by vault) | `0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4` | [address](https://sepolia.basescan.org/address/0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4) | Canonical Uniswap deployment ([docs](https://docs.uniswap.org/contracts/v3/reference/deployments/base-deployments)) |
| **QuoterV2** (off-chain quotes; frontend + agent) | `0xC5290058841028F1614F3A6F0F5816cAd0df5E27` | [address](https://sepolia.basescan.org/address/0xC5290058841028F1614F3A6F0F5816cAd0df5E27) | Canonical |
| **WETH** (canonical on chain) | `0x4200000000000000000000000000000000000006` | [address](https://sepolia.basescan.org/address/0x4200000000000000000000000000000000000006) | |
| **USDC** (Base Sepolia test USDC) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | [address](https://sepolia.basescan.org/address/0x036CbD53842c5426634e7929541eC2318f3dCF7e) | |
| **Uniswap v3 pool** WETH/USDC **fee 3000** | `0x46880b404CD35c165EDdefF7421019F8dD25F4Ad` | [address](https://sepolia.basescan.org/address/0x46880b404CD35c165EDdefF7421019F8dD25F4Ad) | From `UniswapV3Factory.getPool(WETH, USDC, 3000)` on Base Sepolia |

**Notes (optional):** Contract creation / configure txs are in Blockscout history for the vault from block **39039142**; full **`run-latest.json`** stays local under `contracts/broadcast/` (gitignored) — use `npm run proof:hints` after deploy.

---

## 2 — Uniswap track — mandatory tx proof ([`checklist.md`](../checklist.md) **C2**)

| # | What | Tx hash | Explorer link | Notes |
|---|------|---------|-----------------|-------|
| **U1** | **Agent `rebalance`** — `DAOVault.rebalance` with Uniswap **`SwapRouter02`** calldata (`rebalance((address,address,bytes)[])` selector `0x177f59d0`) | `0x8d48f3cf97456923b55beffa4dfb349a90a521b6d4ab5fff318de198dbca0f0f` | [tx](https://sepolia.basescan.org/tx/0x8d48f3cf97456923b55beffa4dfb349a90a521b6d4ab5fff318de198dbca0f0f) | First `rebalance` to vault after deploy sequence (block **39135730**); many follow in same burst — same method |
| **U2** | **User-path swap** — EOA **`exactInputSingle`** on **SwapRouter02** (TEST / manual WETH→USDC path) | `0xa75922161c13cb1d31029f215d6fb6ce829fc2a210b579528c447aeef41c3e08` | [tx](https://sepolia.basescan.org/tx/0xa75922161c13cb1d31029f215d6fb6ce829fc2a210b579528c447aeef41c3e08) | `from` **`0xCEa4095E6036c22c7530b52C34ffcEC0E36949c1`** → router; selector **`0x04e45aaf`** = `exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))` (7-field `params`; **SwapRouter02** on Base — no `deadline` in tuple) |
| **U3** | _(Optional)_ Second rebalance | `0x072a99cd7594482a8c8c6b3dfefd68eda58a98968c8aa72bdc716120ab19c907` | [tx](https://sepolia.basescan.org/tx/0x072a99cd7594482a8c8c6b3dfefd68eda58a98968c8aa72bdc716120ab19c907) | Next `rebalance` after U1 (same block range) |

**Stack disclosure (README / submission):**

- Router: **Uniswap v3 SwapRouter02** on Base Sepolia — `0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4`
- **QuoterV2** — `0xC5290058841028F1614F3A6F0F5816cAd0df5E27` (agent + frontend `minOut` / quotes)
- **Not** claiming unless implemented: Permit2 **N/A**, Uniswap **API** on critical path **N/A**, v4 hooks **N/A**

---

## 3 — Demo story — txs to show in video / README ([`checklist.md`](../checklist.md) **B**)

| Step | Story beat | Tx hash | Link |
|------|------------|---------|------|
| **D1** | First **deposit** (`deposit(address,uint256,address)` — selector `0xf45346dc`) | `0x3449f3201eb035ec252a55829fa2cfcc07d1b99ed51c6e2be84b0e22cef95a18` | [tx](https://sepolia.basescan.org/tx/0x3449f3201eb035ec252a55829fa2cfcc07d1b99ed51c6e2be84b0e22cef95a18) |
| **D2** | **Cast allocation ballot** (`castAllocationBallot(uint256[])` — `0xd87de598`) | `0x905f692ed8651616e95d4a7b60a5dc4644c41a70fa1e2e68fecb3b758f38da49` | [tx](https://sepolia.basescan.org/tx/0x905f692ed8651616e95d4a7b60a5dc4644c41a70fa1e2e68fecb3b758f38da49) |
| **D3** | **`closeCycle`** (governance) | `0x92b28f032e1c6f226962ec26e6e59a2940a70ee09124d34b54ecd5c8042322d7` | [tx](https://sepolia.basescan.org/tx/0x92b28f032e1c6f226962ec26e6e59a2940a70ee09124d34b54ecd5c8042322d7) |
| **D4** | **`rebalance`** (executor) | `0x8d48f3cf97456923b55beffa4dfb349a90a521b6d4ab5fff318de198dbca0f0f` | [tx](https://sepolia.basescan.org/tx/0x8d48f3cf97456923b55beffa4dfb349a90a521b6d4ab5fff318de198dbca0f0f) _(same as **U1**)_ |
| **D5** | **Redeem** — **`redeemToSingleAsset`** with swap steps (`0x2de4aa3b`) | `0xc448eb3c06d8be6fd2f2805c7a82d93150d811303c5c65fb05376fb70603c8d2` | [tx](https://sepolia.basescan.org/tx/0xc448eb3c06d8be6fd2f2805c7a82d93150d811303c5c65fb05376fb70603c8d2) |
| **D5b** | **Redeem** — **`redeemProRata`** (basket, no router) | `0xe8c7c85649245012c9e1432c9700fd6293245f37a5eb6588db5aa039182ec8de` | [tx](https://sepolia.basescan.org/tx/0xe8c7c85649245012c9e1432c9700fd6293245f37a5eb6588db5aa039182ec8de) |
| **D6** | **“Below ε, no swap”** — `plan` output / log showing skip _(tx optional)_ | N/A | Screenshot or log: `_TODO_` (capture `npm run plan` when `would_trade` empty / skip) |

**Additional `closeCycle` txs (Tier A export):** [`frontend/public/cycle-profits.json`](../frontend/public/cycle-profits.json) lists **12** `closeCycle` transactions with **`navStart` / `navEnd`** / splits (e.g. latest hash `0x24c92b4f8acd1e61490129c6fbd301d629489e39949d23f552c137fd25bde273`). Use any row in the video for **CycleClosed** + profits narrative.

---

## 4 — Autonomous agent — Base track ([`checklist.md`](../checklist.md) **C3**)

| Field | Value |
|--------|--------|
| **Command** | `npm run agent` from repo root (orchestrator: plan → rebalance when configured; `closeCycle` when governance key + schedule allow) — see [`apps/agent/README.md`](../apps/agent/README.md) |
| **Schedule / daemon** | **CI (no on-chain executor loop):** [`.github/workflows/agent.yml`](../.github/workflows/agent.yml) runs **`aggregate`**, **`votes-export`**, **`trust`** on push/PR to `apps/agent/**` — **does not** broadcast **`rebalance`**. **Daemon:** **`npm run agent`** from repo root when keys + env are set ([`apps/agent/README.md`](../apps/agent/README.md)); hackathon demos are typically **manual / local** unless you add cron or a hosted worker. |
| **Env vars** (names only; no secrets) | `AGENT_INTERVAL_SEC`, `CHAIN_RPC_URL`, `VAULT_ADDRESS`, `EXECUTOR_PRIVATE_KEY`, `GOVERNANCE_PRIVATE_KEY`, `TESTGAINS`, `TESTWETHOCCILATOR`, … — see [`.env.example`](../.env.example) |
| **What runs without UI clicks** | Off-chain **`plan`** + on-chain **`rebalance`** when bands say trade; rollover **`closeCycle`** + trust pipeline when enabled |
| **Evidence** | Explorer history for vault + executor EOA; [`BUILD_LOG.md`](BUILD_LOG.md) **Current state** |

**Live outcomes (not a backtest):**

| Field | Value |
|--------|--------|
| **CycleClosed** / NAV — link or block range | On-chain: `closeCycle` txs above + committed **[`cycle-profits.json`](../frontend/public/cycle-profits.json)** (per-close `navStart1e18` / `navEnd1e18` / `txHash`); example latest: [tx](https://sepolia.basescan.org/tx/0x24c92b4f8acd1e61490129c6fbd301d629489e39949d23f552c137fd25bde273) |
| **Testnet liquidity caveat** (paste into video/README if using Base Sepolia) | **Default:** Pools on Base Sepolia can be thin or mispriced vs oracles; **NAV** uses governance oracles while **fills** use Uniswap — large divergence is expected on testnet. **Not** mainnet PnL. **`TESTGAINS`** / **`TESTWETHOCCILATOR`** may perturb demo P&L — label in video. |

**Demo-only knobs** (label in video/README — not production alpha):

| Knob | Purpose | Shown in demo? |
|------|---------|----------------|
| `TESTWETHOCCILATOR` | Synthetic WETH/USDC marks when testnet pools are dead | **Unknown in git** — only in deployer **`.env`**; [`BUILD_LOG.md`](BUILD_LOG.md) **Current state** documents it for testnet **trust** demos — **say in video** if your run had it set |
| `TESTGAINS` | Random bounded NAV delta for Tier A profit rows in `cycle-profits.json` | **Yes** — committed [`cycle-profits.json`](../frontend/public/cycle-profits.json) has **`testGainsActive`: true** |
| `TESTBOOSTTRUST` | Amplify trust deltas in finalize | **Unknown in git** — **`.env`** only; mention in video if you used it for trust finalize |

---

## 5 — Frontend & hosting

| Field | Value |
|--------|--------|
| **Production app URL** (judges, no login wall) | [https://synthesis-hack.vercel.app/](https://synthesis-hack.vercel.app/) |
| **Host** | **Vercel** — production hostname **`synthesis-hack.vercel.app`** (not a per-deployment **preview** URL; see [`BUILD_LOG.md`](BUILD_LOG.md) **Current state** / Vercel notes) |
| **Chain** the UI targets | Base Sepolia **`84532`** |
| **Env** documented for judges | [`frontend/.env.example`](../frontend/.env.example) — `VITE_VAULT_ADDRESS` = table §1 vault; optional `VITE_ROLE_LOGS_FROM_BLOCK=39039142` |

---

## 6 — Media & social proof

**How to record:** step-by-step guide → [`docs/DEMO_VIDEO.md`](DEMO_VIDEO.md).

| Field | Value |
|--------|--------|
| **Video** (2–5 min; BaseScan tabs visible) | [YouTube — VaultDao demo](https://www.youtube.com/watch?v=pBa5DHpLs5M) — **`videoURL`** on published project **set 2026-03-23** |
| **Video** outline / timestamps | See [`docs/DEMO_VIDEO.md`](DEMO_VIDEO.md) §2–3 (problem → Basescan txs → optional plan skip) |
| **Moltbook** `moltbookPostURL` | `_TODO_` if rules require; optional **`submissionMetadata.moltbookPostURL`** on project update |

---

## 7 — Synthesis / Devfolio submission fields ([`checklist.md`](../checklist.md) **A**)

| Field | Value |
|--------|--------|
| **Public `repoURL`** | `https://github.com/Okulon/Synthesis_Hack` _(from `git remote origin`; confirm repo stays **public**)_ |
| **`conversationLog`** pointer | [`docs/BUILD_LOG.md`](BUILD_LOG.md) |
| **Track UUIDs** | Fetched **`GET https://synthesis.devfolio.co/catalog?page=1&limit=50`** on **2026-03-24** — **re-run before publish** (IDs can change). **Synthesis Open Track** — `fdb76d08812b43f6a5f454744b66f590`. **Agentic Finance (Best Uniswap API Integration)** — `020214c160fc43339dd9833733791e6b` _(prize name says **API**; this repo’s proof is **SwapRouter02 + QuoterV2** txs — state that honestly in metadata, same as [README](../README.md#judge-facing-synthesis))_. **Autonomous Trading Agent** (Base) — `bf374c2134344629aaadb5d6e639e840`. **MetaMask / Best Use of Delegations** — **omit** (`0d69d56a8a084ac5b7dbe0dc1da73e1d`) — deferred ([`checklist.md`](../checklist.md) **C4**). |
| **Honest `submissionMetadata`** — tools / model / agent | Start from [`docs/SUBMISSION_METADATA.md`](SUBMISSION_METADATA.md); paste into Devfolio |
| **Self-custody** completed | **Yes** — **2026-03-23**; agent **#34825** → `0xCea4095e6036C22c7530b52c34FfCec0E36949C1`; on-chain transfer [tx](https://basescan.org/tx/0x6163eaa79fb800d2c10bc0b041878d754b23dd2d109dbfdefa1dc4e2109dea98) _(Base mainnet ERC-8004 registry — verify network in explorer if link differs)_ |
| **Draft → publish** | **Published** **2026-03-23** — project UUID `038081098f4a4a758268ad23834672bd`, slug `vaultdao-governance-bounded-treasury-agent-9164` |

---

## 8 — Reproducible cycle (one loop)

Judges can replay:

| Artifact | Path / command | Notes |
|----------|----------------|-------|
| Targets / aggregate | `config/local/targets.json` (gitignored) — example [`apps/agent/fixtures/targets.example.json`](../apps/agent/fixtures/targets.example.json) | After `npm run aggregate` |
| Plan | `npm run plan` | Needs `VAULT_ADDRESS` + `CHAIN_RPC_URL` |
| Trust export | `npm run trust:export` | Writes `trust-scores.json` / `trust-history.json` under `config/local/` (see agent README) |
| Static JSON served by UI | [`frontend/public/trust-scores.json`](../frontend/public/trust-scores.json), [`trust-history.json`](../frontend/public/trust-history.json), [`cycle-profits.json`](../frontend/public/cycle-profits.json) | Committed demo exports |

---

## 9 — Disclosures for README / video ([`checklist.md`](../checklist.md) **B**)

Canonical judge copy lives in the root [**`README.md` — Judge-facing**](../README.md#judge-facing-synthesis) section + **Disclaimer**. Below is a scratchpad / submission paste area:

- **Prototype / pooled capital** — ok — see README Disclaimer
- **Oracle vs pool / manipulation** — see [`docs/VAULT_ORACLE_AND_GOVERNANCE.md`](VAULT_ORACLE_AND_GOVERNANCE.md)
- **Contract risk / not audited** — ok — hackathon scope
- **Trust v0** — [`docs/PROJECT_SPEC.md`](PROJECT_SPEC.md) §7 + [`docs/BAND_POLICY.md`](BAND_POLICY.md)

---

## 10 — Optional / deferred

| Item | Status |
|------|--------|
| **Contract verify** — [`docs/DEPLOY.md`](DEPLOY.md) §10 | **Recommended** — Blockscout had no verified Solidity source for the vault at reconstruction time |
| **MetaMask Delegations** — tx or omit track | Deferred — omit track UUID unless implemented |
| **Telegram** bot demo URL | Stub — [`apps/bot/README.md`](../apps/bot/README.md) |
| **Uniswap API** on critical path | **Not** claimed |

---

## Changelog

| Date | Note |
|------|------|
| 2026-03-24 | Reconstructed §0–4, §1 addresses, Uniswap + demo txs from Blockscout + RPC + `cycle-profits.json` |
| 2026-03-24 | §5 production URL: **https://synthesis-hack.vercel.app/** |
| 2026-03-24 | §4 schedule + demo knobs; §7 `repoURL` + catalog UUIDs (paginated fetch); SUBMISSION_METADATA repo line |
| 2026-03-23 | Devfolio: **deployedURL**, **tracks** (Open + Base + Uniswap agentic finance; MetaMask removed), **publish** + **conversationLog** restore; **`videoURL`** → [YouTube](https://www.youtube.com/watch?v=pBa5DHpLs5M) |
| 2026-03-20 | Initial placeholder scaffold |
