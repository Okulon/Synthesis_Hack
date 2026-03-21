# Build log — Synthesis Hackathon

## How this file works

- **Chronological sessions:** Each time you make a meaningful pass (planning, coding, pivots), add a **new section** with heading `## YYYY-MM-DD — Short title`. Same calendar day twice: use **another distinct title** (keep **oldest → newest** order in the file).
- **Order:** **Oldest at the top**, **newest just above** [`Current state`](#current-state-update-every-session). Do **not** reorder or delete past sections—this is a timeline.
- **Handoff:** **Start** each work session by reading **Current state** (bottom). **End** by (1) appending a new dated section and (2) rewriting **Current state**.
- **Rules:** **Never paste secret values** — no API keys, bearer tokens, JWTs, **private keys** (hex or seed), **RPC URLs with embedded credentials**, or **`.env` contents**. Env **names** only (e.g. `BASESCAN_API_KEY`) are fine. Do not use **`sk-…`-style strings** even as fake examples (some scanners flag them). Refer generically to “Synthesis/Devfolio credential” or “team API access.” Summarize decisions and commits—don’t paste full model dumps.

<details>
<summary><strong>Template — copy when adding a session</strong></summary>

```markdown
## YYYY-MM-DD — Title

### Goal
-

### Human decisions
-

### Agent / automation
-

### Reality checks
-

### Open questions / risks
-

### Next session
1.
```

Insert the filled block **immediately above** `## Current state`, then update **Current state**.

</details>

---

## Chronological sessions

*(Read top → bottom for history; latest session is the last `##` block before Current state.)*

---

## 2026-03-19 — Session (planning + logistics)

### Goal
- Clarify Synthesis submission expectations, tracks/prizes, and how to maintain continuity across Cursor chats for judged collaboration evidence.

### Context
- **Hackathon:** [The Synthesis](https://synthesis.md/) — agentic × Ethereum; building starts March 13, 2026.
- **Registration:** Completed via **web form** (confirmation received). **Synthesis/Devfolio API access** and next steps TBD from email or Telegram (`https://nsb.dev/synthesis-updates`).
- **Team:** Solo human; **Cursor** is the dev agent. Model routing: **Cursor Auto** (note accurately in submission metadata later).
- **Judged fields (for later):** `conversationLog` (this file feeds that), honest `submissionMetadata`, public `repoURL`, tracks via `GET https://synthesis.devfolio.co/catalog`, Moltbook post URL when submitting, self-custody for all team members before publish.

### Human decisions
- Prefer **one log file** in-repo for cross-window continuity; bottom **Current state** block is the handoff surface.
- **Product direction (draft):** “DAO Agent” — pooled treasury with share accounting, monthly (or cyclic) **allocation votes** (target weights), **trust** updated from vote performance, agent **rebalances** toward aggregate target under governance caps; **Telegram** as UX channel with chain/DB as source of truth (not chat as authority).
- **Track interest (not final):** Strong thematic fit — **Synthesis Open Track** + likely **Uniswap (agentic finance)** + **MetaMask delegations** (capped agent execution); **Locus** only if agent spend rails are genuinely built on Locus (Base, USDC). Avoid committing to tracks until MVP scope is fixed.

### Agent / automation
- Assistant helped map **catalog tracks** to the idea; recommended ruthless **MVP** (single chain, allowlisted tokens, real swaps, delegation story) vs full Sections 3–5 of the spec in one hackathon.
- Telegram: treat as **message bus** — idempotent handlers, retries; **funds / votes** authoritative on-chain or in DB + verified intents.

### Reality checks
- Full spec (profit skew, trust math, mid-cycle deposits) is **large**; ship a **narrow vertical slice** with real txs and clear problem/governance story.
- At time of this entry: implementation not started; repo was early-stage only.

### Open questions / risks
- Confirm path to **Synthesis API access** / team UUID if web registration doesn’t expose credentials automatically.
- Pick **chain** (e.g. Base) and **custody model** (vault vs smart account) early.
- Legal/regulatory: pooled capital + performance narrative — document as **hackathon prototype**; no legal advice captured here.

### Next session
1. Confirm hackathon account / API access (email, Devfolio, or Telegram ask).
2. Freeze **MVP scope** (one paragraph + diagram).
3. Stub repo layout (`contracts/`, `apps/`, `docs/`) and toolchain (e.g. Foundry + bot runtime).
4. Add `.gitignore` and secrets handling; never commit env files.

---

## 2026-03-19 — Docs, governance, YAML config, checklist

### Goal
- Codify MVP and governance; add agent/config layout; make build checklist reflect progress; prepare for implementation.

### Human decisions
- **Rebalance bands:** no micro-swaps; thresholds governable; defaults in `config/rebalancing/bands.yaml`.
- **Governance:** separate doc for voting on params vs allocation — [`GOVERNANCE_VOTING.md`](./GOVERNANCE_VOTING.md).
- **Tracks (still provisional):** Open + Uniswap + MetaMask delegations until build proves integrations.

### Agent / automation
- Added [`PROJECT_SPEC.md`](./PROJECT_SPEC.md), [`GOVERNANCE_VOTING.md`](./GOVERNANCE_VOTING.md), [`BUILD_CHECKLIST.md`](./BUILD_CHECKLIST.md), [`config/`](../config/) tree, [`.env.example`](../.env.example), [`.gitignore`](../.gitignore) updates per plan.
- Checklist gains **§ P** for planning done vs build remaining.

### Reality checks
- **Custody model** still undecided (vault vs smart account).
- Root **README** and **license** still TODO for judges.

### Open questions / risks
- Same as prior session for API key / team UUID / self-custody timing.

### Next session
1. Root **README** (problem, demo outline, links to `docs/`).
2. Decide **vault vs smart account**; log here + spec §7.
3. **Foundry (or Hardhat) scaffold** + first vault contract + Base Sepolia deploy path.

**Commit:** `a2710d8` — *add DAO Agent docs, YAML config scaffold, and env template*

---

## 2026-03-19 — README, STRUCTURE, vault spec, cycle P&L + trust profit split

### Goal
- Make the repo judge-friendly at a glance; lock **on-chain vault intent** (including how **shares**, **per-cycle profit**, and **trust-weighted upside** fit together).

### Human decisions
- **Custody for implementation:** vault **contract** holds pooled assets; **scoped executor** for rebalances — documented in [`vault/spec.md`](../vault/spec.md) (not “smart account only” as primary design).
- **Profit vs shares:** users keep **share = pro-rata NAV** on redeem; **cycle profit** (if any) allocated with weights `ŵ ∝ share × g(trust)`; **losses** flow **by share only** (no extra downside from trust).
- **MVP for profit distribution:** prefer **Tier A** — on-chain `CycleClosed` + **NAV** snapshot fields + off-chain **CSV** of computed splits (Merkle/claim later if time).

### Agent / automation
- Added root [`README.md`](../README.md), [`STRUCTURE.md`](../STRUCTURE.md) (Mermaid diagrams), [`vault/spec.md`](../vault/spec.md) (deposits, redeem-to-one-asset, rebalancing, **§6 P&L/trust**, pause, deliverables).
- Updated [`PROJECT_SPEC.md`](./PROJECT_SPEC.md): **§2.2** profit/trust summary, vault row, backlog items for cycle P&L + split; clarified out-of-scope vs **documented** profit logic.
- Linked vault spec from README, STRUCTURE, PROJECT_SPEC; [`BUILD_CHECKLIST.md`](./BUILD_CHECKLIST.md) README item checked earlier (still commit pending).

### Reality checks
- **No Solidity yet** — `contracts/` still absent.
- Working tree **ahead of** `a2710d8`: README, STRUCTURE, `vault/`, PROJECT_SPEC/BUILD_CHECKLIST/BUILD_LOG edits **uncommitted** until user runs `git commit`.

### Open questions / risks
- Implement **Tier A vs B/C** for profit (time vs elegance); exact **`g(trust)`** and **snapshot set** (all holders vs cycle voters only).
- Synthesis credential / team UUID / track UUIDs unchanged vs prior sessions.

### Next session
1. **`git add` / commit / push** — README, STRUCTURE, `vault/`, spec + log updates.
2. **Foundry scaffold** + minimal vault (`deposit` / `redeem` / share) + Base Sepolia.
3. Optional **LICENSE** file.

---

## 2026-03-19 — Foundry `DAOVault` (multi-asset + calldata exits)

### Goal
- Ship a **first on-chain vault** matching [`vault/spec.md`](../vault/spec.md): deposits, single-asset redeem with **user-supplied router calldata**, executor rebalance hook, allowlists, pause flags, Tier A **cycle close** event.

### Human decisions
- **Withdrawal routing:** confirm **off-chain / any client** builds `SwapStep[]`; vault only **approves the redeemer’s slice** of `tokenIn` and **`call`s** allowlisted routers — **no** on-chain “best path” search.
- **NAV for mint/burn math (MVP):** **governance-set** `navPricePerFullToken1e18` per token until oracle work; document tradeoff in code/README.

### Agent / automation
- Added [`contracts/`](../contracts/) Foundry project: [`src/DAOVault.sol`](../contracts/src/DAOVault.sol), unit tests (mock router), [`script/DeployDAOVault.s.sol`](../contracts/script/DeployDAOVault.s.sol), [`contracts/README.md`](../contracts/README.md); **`lib/`** vendors OpenZeppelin **v5.0.2** + **forge-std** (clone / `forge install`-style).
- **Forge:** `forge build` / `forge test` — **6 tests** passing locally.
- Docs touch-up: root **README** / **STRUCTURE**, **`.env.example`** (`PRIVATE_KEY` hint), [`vault/spec.md`](../vault/spec.md) §4.2 implementation note, [`vault/checklist.md`](../vault/checklist.md) §0.

### Reality checks
- **Not yet:** Base Sepolia **deploy + verify**, fork smoke against real Uniswap; **on-chain** `maxSlippageBps` / max single-asset weight (only **`minAmountOut`** + allowlists so far).
- **Vendoring:** nested `.git` under `contracts/lib/*` — normalize (submodule vs strip `.git`) before a clean **public** push.
- **`git`:** `contracts/` **untracked**; several prior doc files still **modified** vs `origin/main` — **commit + push** pending.

### Open questions / risks
- Same as earlier: **Synthesis API access**, team UUID, **track UUIDs** from `/catalog`.
- **Profit Tier A:** `closeCycle` trusts **owner-posted** `navStart`/`navEnd` — document honest operator / future constraints.

### Next session
1. **`git add` `contracts/` + doc updates; commit; push.**
2. **Base Sepolia** deploy, Basescan verify, drop addresses into README + [`config/chain/contracts.yaml`](../config/chain/contracts.yaml).
3. **Fork test** (or scripted) one real Uniswap swap path; tighten vault (**slippage caps**, router validation) as time allows.

---

## 2026-03-19 — Oracles, vote-gated params, guardian emergency pause

### Goal
- Add **trust-minimized pricing** (Chainlink-style feeds + optional secondary + deviation bounds + staleness) while keeping **governance** as the only long-term control plane.
- Align with **community votes** for **all** parameter changes (`GOVERNANCE_ROLE` → timelock), **except** fast **one-way** pause from **guardians**.

### Human decisions
- **No separate “operator admin”** for oracles vs pause: **one** `GOVERNANCE_ROLE` (timelock after votes) for **full** `setPause` (including **unpause**), executor, cycle close, allowlists, oracle config, manual price, legacy nav.
- **`GUARDIAN_ROLE`** (1–N multisig): **`guardianPauseTrading` / `guardianPauseDeposits` / `guardianPauseAll`** only — **cannot** unpause; **unpause** only via governance after a vote.
- **Feed discontinued / no fallback:** deposits **`OracleUnavailable`** until governance votes a new config or **time-bounded `setManualPrice`** as a bridge.

### Agent / automation
- [`DAOVault.sol`](../contracts/src/DAOVault.sol): `IAggregatorV3` reads, **`pricePerFullToken1e18`**, `AssetOracleConfig`, `setManualPrice` / `clearManualPrice`, errors `OracleUnavailable` / `OracleDeviation`.
- **`AccessControl`**: `GOVERNANCE_ROLE`, `GUARDIAN_ROLE`; constructor **`(governance, guardian, name, symbol)`** — `guardian` optional (`address(0)`).
- **Tests:** [`contracts/test/DAOVault.t.sol`](../contracts/test/DAOVault.t.sol) — **13** Forge tests (oracle stale, secondary fallback, deviation, manual bridge, guardian vs governance pause, access control).
- **Docs:** [`VAULT_ORACLE_AND_GOVERNANCE.md`](./VAULT_ORACLE_AND_GOVERNANCE.md); README + [`contracts/README.md`](../contracts/README.md); **`.env.example`** (`GUARDIAN_ADDRESS`); deploy script **`GUARDIAN_ADDRESS`** via `vm.envOr`.
- [`vault/checklist.md`](../vault/checklist.md) synced earlier with implementation status.

### Reality checks
- **Governor + `ERC20Votes` + timelock** not deployed yet — **docs** describe wiring; vault is **role-ready**.
- **TWAP** as secondary source still **not** in-contract (future adapter).
- **Commit/push** still pending for `contracts/` + new docs (see Current state).

### Open questions / risks
- Same as prior: **`sk-synth-…`**, team UUID, **track UUIDs** from `/catalog`.
- **Emergency pause** without vote: **guardian griefing** — mitigate with **multisig**, **policy**, optional **social** removal of `GUARDIAN_ROLE` via governance.

### Next session
1. **`git commit` + `git push`** (full repo delta including `contracts/`).
2. **Deploy + verify** Base Sepolia; fill addresses in README + `config/chain/contracts.yaml`.
3. **Optional:** `Governor` + `ERC20Votes` on vault shares + timelock as governance address.

---

## 2026-03-19 — Submodules, fork smoke, CI, docs

### Goal
- Make **`contracts/lib/`** reproducible for clones; add **Base + Uniswap** fork coverage; refresh README / BUILD_LOG / checklist; **MIT** license.

### Human decisions
- **Fork test:** assert **Uniswap V3 factory + pool** liquidity on Base fork (router `exactInputSingle` ABI differs on Base deployments; vault uses **off-chain calldata** anyway).

### Agent / automation
- **`forge install`** → **git submodules** (`contracts/lib/openzeppelin-contracts`, `contracts/lib/forge-std`); root [`.gitmodules`](../.gitmodules).
- **`test/UniswapBaseFork.t.sol`:** factory `getPool` + `slot0` / `liquidity` on USDC/WETH **0.3%** pool.
- **`test_pause_trading_blocks_rebalance_but_not_redeem`** in [`DAOVault.t.sol`](../contracts/test/DAOVault.t.sol).
- [`.github/workflows/foundry.yml`](../.github/workflows/foundry.yml) — `forge build` + `forge test` with `submodules: recursive`.
- [`LICENSE`](../LICENSE) (MIT); README clone + deploy **`--verify`**; [`.env.example`](../.env.example) `BASESCAN_API_KEY` / `BASE_MAINNET_RPC_URL`; [`vault/spec.md`](../vault/spec.md) §3 mid-cycle default; [`vault/checklist.md`](../vault/checklist.md) synced.

### Reality checks
- **Forge:** **15** tests (14 unit + 1 fork; fork uses public Base RPC by default).
- **Deploy + verify** still **owner action** (needs keys + `BASE_SEPOLIA_RPC_URL`).

### Commit
- **`c3f8c11`** — *submodules, Base/Uniswap fork test, Foundry CI, MIT license* (includes `.gitmodules`, [`contracts/lib/`](../contracts/lib/) submodules, CI, fork + pause tests, LICENSE, doc touch-ups).

### Next session
1. **Base Sepolia** deploy, Basescan verify, **`VAULT_ADDRESS`** in README + `config/chain/contracts.yaml`.
2. Off-chain **agent** stub: read vault + apply **bands** + optional `rebalance` calldata.
3. Optional: **`Governor` + `ERC20Votes` + timelock** or document bootstrap EOA.

---

## 2026-03-19 — Off-chain agent CLI (bands + RPC)

### Goal
- First **vertical slice** for the executor path: load **band policy** from YAML, read **vault weights** + **NAV** from chain via RPC, compare to **local target weights**, print **skip vs would-trade** (dry-run; no txs).

### Human decisions
- **Node (ESM) + viem** under [`apps/agent/`](../apps/agent/) — small surface, no Python env; matches typical web3 tooling.
- **Targets** live in gitignored [`config/local/targets.json`](../config/local/) (copy from example) so judges don’t need DB for the demo.

### Agent / automation
- [`apps/agent/`](../apps/agent/): `npm run plan` — loads `.env`, [`config/rebalancing/bands.yaml`](../config/rebalancing/bands.yaml), optional `config/local/targets.json`.
- **Drift** metric: `absolute_pp` from config; **min notional** gate vs `drift * NAV` (USDC-scale rough).

### Reality checks
- **Superseded** by **2026-03-20** session: `aggregate` / `trust` / `quote` + [`DEPLOY.md`](./DEPLOY.md) landed; remaining gap is **`SwapStep[]` builder + signed `rebalance`**, not the dry-run planner itself.

### Next session
*(Handled in 2026-03-20 log — see below.)*

---

## 2026-03-20 — Deploy scripts, agent aggregate/trust/quote, DEPLOY.md

### Goal
- Everything **except** broadcasting with user keys: **one-shot Base Sepolia deploy+configure**, **vote/trust CLI**, **Uniswap pool read**, **deploy doc**, **CI** for agent.

### Human decisions
- **Mock oracles** on testnet (`MockAggregatorV3` in [`contracts/src/mocks/`](../contracts/src/mocks/)) — not production feeds.
- **Fork test** skips when `BASE_MAINNET_RPC_URL` unset (CI-safe).

### Agent / automation
- **Foundry:** [`DeployConfigureDAOVault.s.sol`](../contracts/script/DeployConfigureDAOVault.s.sol), [`ConfigureDAOVault.s.sol`](../contracts/script/ConfigureDAOVault.s.sol), [`BaseSepolia.sol`](../contracts/script/BaseSepolia.sol); mock moved to `src/mocks` for script reuse.
- **Config:** [`config/chain/base_sepolia.yaml`](../config/chain/base_sepolia.yaml); [`config/chain/base.yaml`](../config/chain/base.yaml) gains Uniswap factory + mainnet USDC/WETH for `quote`.
- **Agent:** `npm run aggregate`, `trust`, `quote`; [`lib/env.mjs`](../apps/agent/src/lib/env.mjs); fixtures for votes + CSV.
- **Docs:** [`DEPLOY.md`](./DEPLOY.md); README + [`contracts/README.md`](../contracts/README.md) updated.
- **CI:** [`.github/workflows/agent.yml`](../.github/workflows/agent.yml) — `npm ci` + aggregate + trust.

### Reality checks
- **You** run `forge script … --broadcast` with `PRIVATE_KEY` + verify; then paste **`VAULT_ADDRESS`**.
- **`SwapStep[]` / rebalance tx** still to implement (next coding increment).

### Commit
- **`e22a254`** — *feat: Base Sepolia deploy/configure scripts, agent aggregate/trust/quote, DEPLOY.md*

### Next session
1. **`forge script … --broadcast`** on Base Sepolia → paste **`VAULT_ADDRESS`** → `npm run plan` + `npm run quote`.
2. **`SwapStep[]`** preview + executor **`rebalance`** (or delegations narrative).
3. Optional: **Governor** stack or keep **EOA governance** + honest README.

---

## 2026-03-20 — Base Sepolia broadcast, agent smoke, Foundry gitignore

### Goal
- Run **`DeployConfigureDAOVault`** with **`--broadcast`** on **Base Sepolia (84532)**; confirm **`npm run plan`** against **`VAULT_ADDRESS`**; keep **Foundry** script artifacts out of git.

### Human decisions
- Use **repo-root** `set -a && source .env && set +a` before **`forge script`** so **`PRIVATE_KEY`** is visible to Forge (Forge does not auto-load `.env`).
- Treat **`contracts/cache/`** (sensitive JSON) and **`contracts/broadcast/`** as **never commit** — scope **`.gitignore`** to **`contracts/cache/`** + **`contracts/broadcast/`** with an explicit comment (replaces broad **`cache/`** / **`broadcast/`** at repo root for clarity).

### Agent / automation
- **On-chain:** `DeployConfigureDAOVault.s.sol` completed; **`DAOVault`** deployed (confirm address in **`contracts/broadcast/.../run-latest.json`** / explorer — **do not paste addresses in this log**); mock aggregators deployed in same sequence.
- **Agent:** `npm run plan` with **`VAULT_ADDRESS`** set — **`totalNAV` `0`**, **`rows` []** (empty vault / nothing to rebalance yet); targets file was example/fixture path as printed by CLI.
- **Repo:** [`.gitignore`](../.gitignore) updated for Foundry paths + comment.

### Reality checks
- **Verify** on Basescan still optional (**`BASESCAN_API_KEY`** + **`--verify`**); addresses not yet necessarily mirrored in README / **`config/chain/contracts.yaml`** (do when polishing for judges).
- **Next build step** unchanged: **`SwapStep[]`** + **`rebalance`** tx (or delegations story) for a **real** explorer hash.

### Open questions / risks
- If a **testnet private key** was ever pasted into committed files, **rotate** the key; **`cache/`** JSON must stay untracked.

### Next session
1. Fill **`VAULT_ADDRESS`** into README + **`config/chain/contracts.yaml`** when ready; optional **contract verify**.
2. **Deposit / NAV > 0** (or configured targets) so **`plan`** returns non-empty **`rows`**; then **`quote`** / **`rebalance`** path.
3. **`SwapStep[]`** builder + signed **`rebalance`** for Uniswap track evidence.

---

## 2026-03-20 — Frontend dashboard (Vite, wagmi, reads + deposits)

### Goal
- Ship a **browser dashboard** for **`DAOVault`**: public RPC reads, explorer links, and **wallet deposits** on **Base Sepolia** — complementing the agent CLI and deploy path.

### Human decisions
- **Vite + React + TypeScript**, dev server on port **1337**; env only via **`VITE_*`** in **`frontend/.env.local`** (no implicit read of repo-root **`.env`** — document duplicate **`VITE_VAULT_ADDRESS`** / **`VITE_RPC_URL`**).
- **wagmi** + injected connector for writes; **TanStack Query** for snapshot polling + refetch after deposits.

### Agent / automation
- New app under [`frontend/`](../frontend/): [`App.tsx`](../frontend/src/App.tsx) — setup / bad-address panels, **Dashboard** vs **Users** toggle, Basescan links, refresh.
- **Reads:** [`lib/vault.ts`](../frontend/src/lib/vault.ts) (`fetchVaultSnapshot` — NAV, share supply, pause flags, per-asset balances/oracles, `RoleGranted`/`RoleRevoked` members, share **`Transfer`** log scan + holder **`balanceOf`**); [`lib/client.ts`](../frontend/src/lib/client.ts), [`lib/abi.ts`](../frontend/src/lib/abi.ts), [`lib/contracts.ts`](../frontend/src/lib/contracts.ts), [`lib/tokens.ts`](../frontend/src/lib/tokens.ts), [`lib/env.ts`](../frontend/src/lib/env.ts).
- **Deposits:** [`DepositPanel.tsx`](../frontend/src/components/DepositPanel.tsx) — **USDC** / **WETH** (approve + `deposit`); **ETH** path wraps via **WETH `deposit{value}`** then same flow; receipts checked for **`success`**.
- **UX:** [`index.css`](../frontend/src/index.css) + [`main.tsx`](../frontend/src/main.tsx) / [`wagmi-config.ts`](../frontend/src/wagmi-config.ts); [`frontend/README.md`](../frontend/README.md), [`frontend/.env.example`](../frontend/.env.example).

### Reality checks
- **Read-only** except user-initiated **deposit** txs; no executor / **`rebalance`** in the UI yet.
- Optional **`VITE_ROLE_LOGS_FROM_BLOCK`** / **`VITE_HOLDER_LOGS_FROM_BLOCK`** if default log windows are too heavy for the RPC.

### Next session
1. Fund vault via UI or cast; confirm **NAV** / **Users** / **`plan`** rows update.
2. Optional **hackathon TEST** path: swap into a second asset before **`deposit`** (see **2026-03-21** session).

---

## 2026-03-21 — Frontend TEST swap-deposit (WETH→USDC) + docs pass

### Goal
- **Hackathon-only TEST path** in the dashboard: user supplies **ETH**, app **wraps → swaps WETH→USDC** (Uniswap v3 `SwapRouter02`) → **`deposit(USDC)`** into **`DAOVault`**, to validate multi-token / NAV behavior without expecting the vault to accept native ETH directly.
- Sync **markdown** (README, `frontend/README`, checklist, `STRUCTURE`, `vault/*`, `STEP_BY_STEP`) and this log.

### Human decisions
- Label the flow **TEST** with explicit **not production** / **`amountOutMinimum: 0`** warnings; keep normal **Deposit** panel for straight ERC-20 / ETH→WETH paths.

### Agent / automation
- **Adds on top of the prior “Frontend dashboard (Vite…)” session (2026-03-20):** [`TestSwapDepositPanel.tsx`](../frontend/src/components/TestSwapDepositPanel.tsx) in [`App.tsx`](../frontend/src/App.tsx) below **`DepositPanel`**; [`swapRouter02Abi.ts`](../frontend/src/lib/swapRouter02Abi.ts); router + fee tier aligned with [`BaseSepolia.sol`](../contracts/script/BaseSepolia.sol) (`SWAP_ROUTER02`, **3000** WETH/USDC).
- **Styles:** `btn-warn` + `test-swap-panel` in [`index.css`](../frontend/src/index.css).
- **Docs:** Root README status line; [`frontend/README.md`](../frontend/README.md); [`BUILD_CHECKLIST.md`](./BUILD_CHECKLIST.md); [`STRUCTURE.md`](../STRUCTURE.md); [`vault/spec.md`](../vault/spec.md) §3 UX note; [`vault/checklist.md`](../vault/checklist.md); [`STEP_BY_STEP.md`](./STEP_BY_STEP.md) dashboard section.

### Reality checks
- **Vault** still only receives **ERC-20**; swap + wrap happen **outside** `deposit`.
- Swap can **revert** on testnet if the **WETH/USDC** pool at the chosen fee tier is missing or illiquid — panel messaging documents that.

### Open questions / risks
- Replace **`minOut = 0`** with a real quote/slippage cap before any mainnet-style use.

### Next session
1. **`rebalance`** / **`SwapStep[]`** tx path for Uniswap track evidence.
2. Optional: promote TEST into a guarded “advanced” flow or remove post-demo.

---

## 2026-03-20 — Synthesis registration + online draft submission

### Goal
- Register the agent on Synthesis, verify access, and create an online project draft that can be iterated during build-out.

### Human decisions
- Proceed with **email OTP** verification for registration.
- Keep model metadata explicit as **`auto (Cursor automatic model selection)`**.
- Create draft now (instead of waiting for final polish) and update incrementally.
- Expand submission tracks from 3 to 4 by adding **Autonomous Trading Agent**.

### Agent / automation
- Completed registration flow: `/register/init` → `/register/verify/email/send` → `/register/verify/email/confirm` → `/register/complete`.
- Validated authenticated API access via team endpoint.
- Added local env wiring for Synthesis API usage in `.env` and placeholders in `.env.example`.
- Pulled live catalog and prepared track UUID shortlist.
- Saved project payload to [`draft.md`](../draft.md), created online draft via `/projects`, then updated `trackUUIDs` to include a fourth track.

### Reality checks
- Project exists online in **draft** state and is editable.
- Draft metadata is intentionally MVP-accurate and not final (video/deployed URL can be added later).
- No secrets are logged in this file.

### Next session
1. Generate one real **rebalance/swap tx hash** and add proof links.
2. Tighten `conversationLog`, `description`, and `problemStatement` after latest implementation work.
3. Add `videoURL`, optional `deployedURL`, and finalize publish checklist (including self-custody requirement).

---

## 2026-03-20 — Agent skills, targets cadence, on-chain rebalance, NAV vs pool, UI asset weights, execution guards

### Goal
- Ship an **executor `rebalance` path** with clear docs; align **`plan`** with real target files; explain **NAV** behavior vs **DEX** prices; harden the **agent** with preflight-style protections.

### Human decisions
- Use **`config/local/targets.json`** (gitignored) populated from **`npm run aggregate`** output instead of fixture placeholder addresses.
- Rebalance **band policy:** keep **both** gates — **`global_epsilon_pp`** (percentage-point drift) and **`min_trade_notional_quote`** — with notional set to **0** for now so **%-only** thresholding applies; documented AND semantics in [`config/rebalancing/bands.yaml`](../config/rebalancing/bands.yaml).
- Frontend: show **NAV share %** beside each tracked asset name; style the **%** in the theme **warn** (yellow/gold) color.

### Agent / automation
- **Skills:** added [`apps/agent/skills/`](../apps/agent/skills/) — [`rebalancing/SKILL.md`](../apps/agent/skills/rebalancing/SKILL.md) (plan/aggregate/quote flow), [`execution/SKILL.md`](../apps/agent/skills/execution/SKILL.md) (`SwapStep[]`, `rebalance`, safety); index in [`skills/README.md`](../apps/agent/skills/README.md); linked from [`apps/agent/README.md`](../apps/agent/README.md) and [`STRUCTURE.md`](../STRUCTURE.md).
- **`plan` / targets:** clarified that **`fixtures/targets.example.json`** uses placeholder token addresses so **`wTgt`** was effectively **0** for real assets until **`config/local/targets.json`** existed; after copying aggregated targets, **`plan`** showed real drift vs targets; **`notionalRough`** vs **`min_trade_notional`** documented in session.
- **Bands:** lowered **`global_epsilon_pp`** to **1.0** and **`min_trade_notional_quote`** to **0** so small test portfolios can get **`would_trade`** without a dollar floor (notional can be re-enabled later).
- **`rebalance.mjs` + `npm run rebalance`:** executor-only script builds **Uniswap v3 `SwapRouter02`** **`exactInputSingle`** (WETH→USDC, **recipient = vault**), **`vault.rebalance(steps)`**; default sells **`REBALANCE_BPS`** of vault WETH (default half). Documented in agent README and `.env.example`.
  - **Two successful testnet `rebalance` txs** (sequential halving of remaining WETH slice) — proof on chain explorer; **hashes not pasted here** (see explorer / wallet history).
- **Post-trade investigation (read-only):** **`totalNAV()`** equals **sum of balances × `pricePerFullToken1e18`**; **`slot0`** on WETH/USDC v3 pool gives **mid** USDC-per-ETH far below **oracle WETH USD** on testnet → selling WETH at **pool** prices while NAV marks WETH at **oracle** explains **large reported NAV drops** when converting to USDC at **~$1** NAV units — **not** primarily swap dust fees.
- **Execution guards (agent-side, before `writeContract`):** **`rebalance.mjs`** now optionally **compares vault oracle ETH/USD to pool-implied mid** and **aborts** if deviation exceeds **`REBALANCE_ORACLE_POOL_MAX_DEVIATION_BPS`** (default **2000**); **`REBALANCE_DISABLE_ORACLE_POOL_GUARD=1`** bypasses for rough testnet; sets **`amountOutMinimum`** from mid + **997/1000** one-hop fee fudge minus **`REBALANCE_SLIPPAGE_BPS`** (still not a full **Quoter** — noted in README). Shared math helper [`apps/agent/src/lib/poolMidPrice.mjs`](../apps/agent/src/lib/poolMidPrice.mjs).
- **Frontend:** [`formatAssetWeightPct`](../frontend/src/lib/vault.ts) + **Tracked assets** table shows **`XX.XX%`** left of name; styles in [`index.css`](../frontend/src/index.css) (`.asset-weight` uses **`var(--warn)`**).

### Reality checks
- **`rebalance` script** is a **nudge** (fixed BPS of WETH → USDC), **not** target-closing-to-completion in one shot; **target-aware sizing** remains a follow-up.
- **Oracle vs pool** divergence on **thin / odd-testnet** pools is expected; **mainnet** liquidity usually aligns better, but **NAV is oracle-based** and **fills are pool-based** — document for judges.
- **No secrets** (private keys, API keys) and **no raw chain addresses / tx hashes** in this log entry — those stay in **local `.env`**, **broadcast artifacts**, or **explorer**.

### Next session
1. Optional: **target-aware** `amountIn` from **`plan`** gap + **QuoterV2** for tighter **`amountOutMinimum`**.
2. **Tune mock oracles** toward pool-mid on testnet **or** keep **guard on** and document intentional **refusal** to trade on bad prints.
3. **Submission polish:** refresh **`draft.md`** / Devfolio draft with **rebalance evidence**, **`conversationLog`**, video when ready.

---

## 2026-03-20 — Ballot registry vs allowlist, legacy UI, pies, env hygiene, cycle/target semantics

### Goal
- Let holders vote across **governance-allowlisted** assets (not only **tracked** vault balances) on **current** `DAOVault` bytecode.
- Keep the **dashboard** working against **pre-upgrade** vaults (no `ballotAssets` selector).
- Clarify what **does / does not** happen at **cycle end** and where **targets** live — **without** storing secrets or chain addresses in this file.

### Contracts
- **`ballotAssets`:** order follows **first** `setAssetAllowed(asset, true)`; removed on disallow. **`castAllocationBallot(weightsBps)`** requires `weightsBps.length == ballotAssets.length`, per-asset allowlist guard, sum **10_000** bps, **`MinShares`**, no **`pauseAll`**.
- **`ballotAssetsLength()`** for RPC clients.
- **Foundry:** [`DAOVault.t.sol`](../contracts/test/DAOVault.t.sol) covers multi-slot ballots (e.g. two allowlisted assets, deposit only one); **18** tests in that suite (see `forge test` locally). **Redeploy** is required for this behavior — **paste new `VAULT_ADDRESS` / `VITE_VAULT_ADDRESS` only in local env**, not in git or this log.

### Frontend
- **`fetchVaultSnapshot`:** probe **`ballotAssetsLength`** in a **multicall** with **`allowFailure: true`**; on failure → **legacy** mode: ballot rows = **tracked** only; expose **`ballotRegistryOnChain`**.
- **`governanceAllowedAssets`:** derived from **`AssetAllowed`** logs + **`isAssetAllowed`**; **legacy banner** when the allowlist is **wider than** ballot slots (“redeploy for full on-chain ballot set”).
- **`AllocationPieChart`:** dependency-free SVG **donut** + legend — **Cast ballot** “Preview” and **Aggregate targets** “On-chain blend” ([`AllocationPieChart.tsx`](../frontend/src/components/AllocationPieChart.tsx)).
- **`AllocationBallotPanel`:** **`ballotAssetsLength`** wagmi read gated on **`ballotRegistryOnChain`**; **“Reset to on-chain”** = refill **local % fields** from latest **`AllocationBallotCast`** for the snapshot **`cycleId`** (**no tx**).

### Env / repo hygiene (patterns only)
- **Root `.env`:** single canonical **`VAULT_ADDRESS`** + chain vars (no duplicate blocks).
- **Mirror** in **`frontend/.env.local`** (and optional **`frontend/.env`**): **`VITE_VAULT_ADDRESS`**, **`VITE_RPC_URL`**, **`VITE_CHAIN_ID`**; optional **`VITE_*_LOGS_FROM_BLOCK`** from **vault deploy block** in **`contracts/broadcast/.../run-latest.json`** so **`AssetAllowed`** / roles aren’t truncated by default lookback.
- **[`.env.example`](../.env.example)** / **[`frontend/.env.example`](../frontend/.env.example):** document sync; **no real addresses or keys**.

### Cycle / targets / rebalance (product truth)
- **Off-chain wall-clock “cycle end”** (`cycle:sync` / **`cycle:daemon`**) updates **`vote-store`** / exports — **does not** auto-**`rebalance`** or auto-**`closeCycle`**.
- **On-chain:** **`closeCycle`** (governance) only **increments `cycleId`** + **`CycleClosed`** — **no** aggregate targets written to storage.
- **Targets:** **`castAllocationBallot`** → **events only**; aggregate weights are **off-chain** (**logs / indexer / UI math**, **`npm run aggregate`**, **`votes:export`** → **`frontend/public/allocation-votes.json`**); **`plan`** uses **`config/local/targets.json`** (operator copy). **`config/agent/runtime.yaml`** `on_cycle_close` is **aspirational** — **not** implemented as an auto-trigger in code.
- **Future (optional):** on-chain **`setCycleTargets`** / commitment hash if **trust-minimized executor** or **dispute** surface needs it — **not required** for current MVP narrative.

### Reality checks
- Legacy vault: **cannot** submit a longer weights vector than **tracked** length without **contract upgrade / redeploy**.
- **Rotate** any deploy key if it ever appeared in a **shared** terminal log.

### Next session
1. Optional: wire **post-frozen** export → **`targets.json`** or a small **cron** that runs **`rebalance`** when drift > band (still operator-owned).
2. Optional: **target-aware** swap sizing from **`plan`** output.
3. Polish **README / judge table** with **public** contract links only (no secrets).

---

## 2026-03-20 — Unified agent, wall-clock SSOT, trust pipeline, rebalance hardening, voting UI

### Goal
- One long-running **agent** process for wall-clock sync, exports, optional **`closeCycle`**, trust, aggregate → targets, and rebalance convergence — without duplicating manual **`cycle:clock-init`** / stale dashboard JSON.
- **Single source of truth** for wall-clock **schedule** vs pinned **genesis**; align **frontend** with live operator behavior (no dev-only instructions in the UI).

### Human decisions
- **Schedule:** [`config/agent/cycles.yaml`](../config/agent/cycles.yaml) is authoritative for **duration + voting/frozen**; [`config/local/cycle-clock.json`](../config/local/cycle-clock.json) stores **genesis unix only** (v2 schema), migrated from legacy rows that duplicated seconds.
- **Trust:** portfolio / time-weighted path uses [`config/trust/scoring.yaml`](../config/trust/scoring.yaml) **`update_rule: time_weighted_portfolio_return`** (with **`portfolio_trust.linear_scale`**) when finalizing windows from stamped ballot prices — **no CSV secrets**; keys stay in **local `.env`** only.
- **Rebalance:** executor script supports **Base** and **Base Sepolia** via **`CHAIN_ID`** + per-chain YAML; **oracle vs pool** guard remains configurable — on **Sepolia**, guard defaults **off** when the env toggle is **unset** (rough pools), **on** when explicitly forced — **documented in code**, not credential-related.

### Agent / automation
- **Root / worker:** [`package.json`](../package.json) **`npm run agent`** → [`apps/agent/src/agent.mjs`](../apps/agent/src/agent.mjs) — tick: **`cycle:sync`** (auto **`ensureCycleClockReady`** in [`cycleClock.mjs`](../apps/agent/src/lib/cycleClock.mjs)), rollover handling (**`closeCycle`** when governance key + env allow), **`trust:stamp-prices`** in voting, **`aggregate` → `targets.json`**, **`votes:export`**, optional **`trust:export`**, **`plan` → `rebalance`** loop (`AGENT_REBALANCE_TO_TARGET`, step cap, optional frozen-only).
- **`votes-export-frontend.mjs`:** runs **`cycle:sync`** before resolve when **not** invoked from an agent tick (**`AGENT_SKIP_VOTES_EXPORT_SYNC=1`** skips duplicate sync); **`activeVoteCycleKey` / `managedWindowIndex`** taken from **`computeManagedCycle()`** at export time so JSON matches live wall-clock index.
- **`trust:export`:** default **on** each tick (`AGENT_TRUST_EXPORT` defaults true) so **`frontend/public/trust-scores.json`** tracks CSV + scoring changes.
- **`rebalance.mjs`:** loads factory / **SwapRouter02** / WETH / USDC from **`config/chain/base.yaml`** or **`base_sepolia.yaml`**; **`base.yaml`** gained **`swap_router02`** for mainnet-shaped config.
- **`trust-finalize-window.mjs`:** calls **`ensureCycleClockReady()`** before finalize.
- **`cycle-daemon`:** passes **`AGENT_SKIP_VOTES_EXPORT_SYNC`** when chaining sync → export.
- **Docs / config samples:** [`.env.example`](../.env.example) and [`docs/CYCLES_AND_VOTING.md`](./CYCLES_AND_VOTING.md) updated for agent + clock semantics (no secrets).

### Frontend
- **Voting:** removed operator-facing “run **`cycle:sync`** / **`npm run agent`**” copy; short fallbacks for missing schedule JSON; **Cast ballot** header shows **Voted** / **Pending** (on-chain ballot for current **`cycleId`**); **`allocation-votes.json`** query **polls** on an interval so exports propagate without hard refresh.
- **Users / trust:** trust hint text no longer instructs CLI regeneration — describes behavior only.

### Reality checks
- **`rebalance.mjs`** remains **WETH → USDC** one-hop MVP; **not** full multi-asset target completion in one tx — convergence is **multi-tick** **`plan` → `rebalance`** when enabled.
- **Trust** updates on **closed** windows when stamp + finalize + export pipelines succeed; **on-chain `cycleId`** still advances only via **`closeCycle`** (governance).
- **No secrets** in this entry — **private keys**, **RPC URLs with embedded tokens**, and **deployed addresses / tx hashes** stay in **local env**, **explorer**, or **gitignored broadcast/cache**.

### Next session
1. Optional: **target-aware** swap sizing + **Quoter** for production-grade **`minOut`**.
2. Optional: **USDC → WETH** (or multi-hop) when targets require buying risk assets — beyond current script.
3. **Synthesis** draft: refresh **`conversationLog`** / demo links when stable.

---

## 2026-03-20 — Trust pipeline fixes, WETH oscillator, quorum, on-chain ballot sync

### Goal
- Make **trust scores actually move** off default 1.0 after a cycle closes — end-to-end, no manual steps.
- Add **allocation quorum** gating on `targets.json` so executor only acts on sufficient participation.
- Harden the **agent rollover pipeline** (sync → stamp → finalize → trust → export) to survive dead testnet pools and on-chain-only ballots.

### Human decisions
- **`TESTWETHOCCILATOR`** env var: synthetic oscillating WETH/USDC price for dev/demo (Base Sepolia pool is dead — price never moves, making trust returns always 0).
- **`TESTBOOSTTRUST`**: amplify tiny effective returns before bps rounding so trust visibly moves in short demo cycles.
- **Quorum gate**: `AGENT_REQUIRE_QUORUM_FOR_TARGETS` (default on) — agent only writes `targets.json` when allocation participation meets threshold; executor keeps previous targets otherwise.

### Agent / automation
- **New files:**
  - `apps/agent/src/lib/testWethOscillator.mjs` — sine wave + random noise WETH/USDC price generator (configurable base, amplitude, period, noise bps).
  - `apps/agent/src/lib/testBoostTrust.mjs` — `TESTBOOSTTRUST` multiplier on effective return before bps rounding.
  - `apps/agent/src/lib/quorumAlloc.mjs` — allocation quorum math (holder power vs participated power).
  - `apps/agent/src/lib/quorumChain.mjs` — on-chain `AllocationBallotCast` log reader + ballot weights decoder.
  - `apps/agent/src/check-quorum-for-targets.mjs` — quorum check script (`npm run quorum:check`).
  - `apps/agent/src/sync-allocation-ballots-from-chain.mjs` — merges on-chain `AllocationBallotCast` events into `vote-store.json` for a given cycle key (trust finalize reads vote-store only).

- **Bug fixes:**
  - **`sync-allocation-ballots-from-chain`** was **replacing** `cycle.ballots` wholesale, **dropping `priceMarksUsdc`** (vote-time price marks). Fixed: now preserves existing marks per voter when merging chain ballots.
  - **`trust-stamp-prices`** at rollover filled missing marks at close-time prices, making start ≈ end → `portfolioReturnFull: 0`. With the sync merge fix + oscillator, stamp and finalize now see different prices.
  - **`agent.mjs`**: added `localTargetsWeightSum()` guard — skips `plan`/`rebalance` when `targets.json` has empty weights (instead of crashing `cli.mjs` with "targets must sum to > 0"). Prints stderr on `plan` failure.
  - **`trustCore.mjs`**: stopped silently falling back to `trust_cycle.example.csv` when local CSV is missing (was hiding that real voters had no rows). Returns empty rows with a warning instead.
  - **`close-cycle.mjs`**: receipt status check (`status === "success"`) + `AGENT_CLOSE_CYCLE_RETRIES` in agent.

- **Trust pipeline in agent rollover** (`runTrustPipelineForClosedWindow`):
  1. **Sync on-chain ballots** → vote-store (preserves existing priceMarksUsdc)
  2. **Stamp prices** for closed window (fills only missing marks — uses oscillator when `TESTWETHOCCILATOR` is set)
  3. **Finalize** — reads stamped marks as start, fetches live (oscillating) prices as end → non-zero return
  4. **Trust scoring** (`trust.mjs`) + **export** to `frontend/public/trust-scores.json`

- **WETH oscillator** wired into `fetchUsdcPricesForTokens` in `assetPrices.mjs`: when `TESTWETHOCCILATOR=true`, WETH price bypasses Uniswap pool and uses synthetic sine + noise (configurable via `TESTWETH_OSCILLATOR_BASE_USDC`, `_AMP`, `_PERIOD_SEC`, `_NOISE_BPS`). Other assets still use real pools.

- **Frontend**: trust from `allocation-votes.json` when `trust-scores.json` lacks a row; **†** / **◆** markers for off-chain vote status.

- **`.env.example`**: documented `TESTWETHOCCILATOR`, `TESTBOOSTTRUST`, `TRUST_MIN_TIME_WEIGHT_FLOOR`, oscillator tuning vars.

### Reality checks
- **Trust moved**: after fixes, manual re-finalize of cycle 12 produced `vote_return_bps: -220541888` → trust clamped to floor **0.1** (from default 1.0). Pipeline confirmed working.
- **Oscillator is dev-only** — unset `TESTWETHOCCILATOR` for production; real pool liquidity would provide natural price movement.
- **`TESTBOOSTTRUST=10000000`** is extreme — trust will slam to floor (0.1) or ceiling (3.0) each cycle. Reduce for gradual movement.
- Dead testnet pool (`413.42 USDC/WETH` static) was the root cause of zero returns on all prior cycles — not a code logic error in the trust math itself.

### Open questions / risks
- On-chain-only ballots still don't get vote-time price marks during voting phase (only at rollover via stamp). For accurate P&L on real pools, agent should sync on-chain ballots during voting ticks too (heavy on RPC — deferred).
- `TESTBOOSTTRUST` at extreme values makes trust binary (floor or ceiling). Consider tuning down or using `TRUST_MIN_TIME_WEIGHT_FLOOR` for smoother behavior.

### Next session
1. Tune `TESTBOOSTTRUST` to a moderate value so trust moves gradually (e.g. 100–1000).
2. Optional: sync on-chain ballots during voting phase (not just rollover) so vote-time marks are accurate.
3. Submission polish: refresh draft, video, conversation log.

---

## 2026-03-21 — History tab: voting + trust over cycles

### Goal
- New **frontend** tab so a connected wallet (or pasted address) can see **voting / trust history**: per-cycle **trust gained or lost**, **vote vs benchmark return (bps)**, **ballot weights**, and a **chart** of **trust over wall-clock windows**.

### Human decisions
- **Data source:** extend **`npm run trust:export`** to emit a second static JSON (no new server) — judges clone repo and run the agent export like **`trust-scores.json`**.
- **Chart:** inline **SVG** (no new npm dependency) — line through **trust_after** per finalized cycle.

### Agent / automation
- **[`trustCore.mjs`](../apps/agent/src/lib/trustCore.mjs):** **`applyTrustRow()`** (single CSV step, shared with **`buildTrustByVoter`**) + **`buildPerVoterHistory()`** — sorted by **`cycle_id`**, emits **`trust_before` / `trust_after` / `delta_trust`** per step.
- **[`trust-export-frontend.mjs`](../apps/agent/src/trust-export-frontend.mjs):** after **`trust-scores.json`**, writes **`frontend/public/trust-history.json`**: scoring metadata (default/floor/ceiling/rule), **`byVoter[addr][]`** with **`vote_return_bps`**, **`benchmark_return_bps`**, trust deltas, optional **`weights`** merged from **`vote-store`** per cycle (last ballot per voter).

### Frontend
- **[`VotingHistoryTab.tsx`](../frontend/src/components/VotingHistoryTab.tsx):** **History** nav; **`useAccount`** + optional **manual `0x…`**; **`fetchTrustHistory()`** → table + SVG chart; asset labels via existing **`ballotAssets` / tracked** snapshot.
- **[`App.tsx`](../frontend/src/App.tsx):** fourth view **`history`**.
- **[`index.css`](../frontend/src/index.css):** history table + chart layout.

### Docs
- **[`frontend/README.md`](../frontend/README.md)**, **[`apps/agent/README.md`](../apps/agent/README.md)** (`trust:export` writes both JSON files), **[`docs/CYCLES_AND_VOTING.md`](./CYCLES_AND_VOTING.md)** (artifacts table), **[`STRUCTURE.md`](../STRUCTURE.md)** (public JSON list).

### Reality checks
- **`trust-history.json`** is **empty / missing** until **`npm run trust:export`** (or agent trust export on rollover) — UI explains.
- Large **`vote_return_bps`** (e.g. with **`TESTBOOSTTRUST`**) shows as **scientific %** in the formatter when needed.

### Next session
1. Optional: sparkline in **Users** row linking to **History**.
2. Optional: export **portfolio narrative** fields from finalize JSON into CSV/history (not only bps).

---

## 2026-03-21 — Profit split after closeCycle + Profits tab

### Goal
- Show **per-cycle profit distribution** by **trust × shares** (voting power) after each **`closeCycle`**; optional **`TESTGAINS`** for synthetic profit pools in demos (random draw semantics in **TESTGAINS random pool + cycle-profits metadata**, below).

### Human decisions
- **Tier A off-chain:** append **`closeCycle`** NAV bounds to **`config/local/cycle-close-log.json`**; export **`frontend/public/cycle-profits.json`** for the UI (no Merkle / no on-chain distribution in this pass).
- **`TESTGAINS`:** NAV-scale (**1e18** units); when set, synthetic pool instead of **`max(0, navEnd − navStart)`** (per-cycle draw documented in later session).

### Agent / automation
- **`close-cycle.mjs`:** logs **`onChainCycleId` before/after**, optional **`CLOSE_CYCLE_WALL_KEY`**; appends close log; runs **`writeCycleProfitsArtifact()`**.
- **`agent.mjs`:** passes **`CLOSE_CYCLE_WALL_KEY=<closed window>`** into **`close-cycle`** on rollover.
- **`lib/profitExportCore.mjs` + `profit-export-frontend.mjs`:** **`npm run profit:export`**; weights **∝ trust_before × shares** (trust-only if no snapshot), **BigInt** split with remainder sweep; maps manual closes via **`onChainCycleId`** ↔ vote-store when wall key absent.
- **Frontend:** **`ProfitsTab.tsx`** + **`/cycle-profits.json`** — “Your share” + per-cycle cards with bars/charts (full UI polish in **Trust leaderboard, dashboard layout, voting visual parity, Profits tab v2**, below); **`.env.example`** **`TESTGAINS`**; docs (**`CYCLES_AND_VOTING`**, READMEs, **STRUCTURE**).

### Reality checks
- **Principal / NAV** still follows share redemption on-chain; this JSON is **attribution / demo accounting** until a claim path exists.
- **`cycle-close-log.json`** is gitignored like other **`config/local/`** — fresh clones need at least one **`closeCycle`** (or hand-built log) to populate the tab.

### Next session
1. Optional: on-chain **yield accrual** or **Merkle claim** if scope allows.
2. Optional: distribute remainder to **treasury** when there are no ballots.

---

## 2026-03-21 — Trust leaderboard, dashboard layout, voting visual parity, Profits tab v2

### Goal
- **Leaderboard:** graphical **trust / share / power** ranking with **you** highlighted and readable formatting for huge **trust × shares** values.
- **Dashboard:** less noise — drop **Pause** / **Contract** blocks; pair **Access control** with a **NAV allocation** donut.
- **Voting:** **Cast ballot** vs **Aggregate targets** use the **same asset order** as on-chain **`ballotAssets`** and **consistent pie slice colors** per slot.
- **Profits:** tighter UX — real **charts / stats**, less wall-of-text, remove confusing **podium**-style duplicate bars, **compact Power**; **[`cycleProfits.ts`](../frontend/src/lib/cycleProfits.ts)** types aligned with exported JSON (including later **`testGainsRange`** fields).

### Human decisions
- **Order:** aggregate display follows **`ballotAssets` enumeration** (including zero-weight slots) so the UI matches **`castAllocationBallot(weightsBps)`** indexing.
- **Colors:** donut segments use explicit **`colorIndex`** (ballot slot) so preview and aggregate pies don’t diverge after sorting.

### Frontend
- **[`TrustLeaderboardTab.tsx`](../frontend/src/components/TrustLeaderboardTab.tsx)** + **[`App.tsx`](../frontend/src/App.tsx)** **`leaderboard`** view — sort toggles (**Trust / Share % / Power**), bar chart, row highlight for connected or pasted **`0x…`** address.
- **[`App.tsx`](../frontend/src/App.tsx)** dashboard: **`navPieSegments`** + **[`AllocationPieChart.tsx`](../frontend/src/components/AllocationPieChart.tsx)** beside access control (~half-width layout); removed dashboard **Pause flags** and **Contract** sections from the main surface.
- **Voting:** **`ballotOrderedTargets`** in **`App.tsx`** — aggregate table + pie in **`ballotAssets`** order; **`colorIndex: slot`** on segments. **[`AllocationPieChart.tsx`](../frontend/src/components/AllocationPieChart.tsx)** maps **`colorIndex`** → **`DEFAULT_COLORS[ci % n]`**. **[`AllocationBallotPanel.tsx`](../frontend/src/components/AllocationBallotPanel.tsx)** preview passes per-row **`colorIndex`**.
- **Profits:** **[`ProfitsTab.tsx`](../frontend/src/components/ProfitsTab.tsx)** — charts/stats, copy trim, podium removal, compact power strings; bar heights computed in **`Number`** space for **`tsc`**.

### Agent / data
- Builds on **Profit split after closeCycle + Profits tab** (**`cycle-profits.json`** / **`close-cycle`** wiring); **`TESTGAINS`** random pool + JSON metadata in **TESTGAINS random pool + cycle-profits metadata** (below).

### Reality checks
- Legacy vaults without **`ballotAssets`** still fall back to **tracked**-only ballots; ordering parity applies when the registry is on-chain.

### Next session
1. Optional: show per-cycle **`testGainsRawSample1e18`** in Profits rows (JSON already has it).

---

## 2026-03-21 — TESTGAINS random pool + cycle-profits metadata

### Goal
- Vary demo profit pools **per close**: uniform draw in **`[-T/2, T]`** (**T** = **`TESTGAINS`**, NAV **1e18** scale), then **`profit pool = max(0, draw)`**; document and expose the range in the UI.

### Human decisions
- Keep **NAV Δ** path unchanged when **`TESTGAINS`** is unset; synthetic path is **export-time** (re-run **`profit:export`** → new draws).

### Agent / automation
- **`apps/agent/src/lib/profitExportCore.mjs`:** `node:crypto` **`randomBytes`** → **`randomBigIntInclusive`** / **`sampleTestGainsPool1e18`** per exported cycle row; JSON top-level **`testGainsRange`** (`min1e18` / `max1e18` / `poolClamp` note) plus per-row **`testGainsRawSample1e18`** and **`profitPool1e18`** (clamped pool).

### Frontend
- **`ProfitsTab.tsx`:** **TESTGAINS** badge **`title`** tooltip built from **`testGainsRange`** when present.

### Docs
- **`.env.example`**, **`frontend/README.md`**, **`STRUCTURE.md`**, **`docs/BUILD_CHECKLIST.md`**, **`docs/CYCLES_AND_VOTING.md`** — align wording with random draw + clamp; **`BUILD_LOG`**: **Profit split after closeCycle + Profits tab** bullets corrected for **`TESTGAINS`**; **Trust leaderboard, dashboard layout, voting visual parity, Profits tab v2** documents the same day’s **dashboard / voting / leaderboard / Profits UI** so it is not only implied by **Current state**.

### Reality checks
- **`testGains1e18`** in JSON remains **T** (the bound); actual pool per cycle is the clamped draw.

### Next session
1. Optional: show per-cycle **raw sample** in the Profits UI (data already in JSON).

---

## 2026-03-21 — Frontend Withdraw tab (`redeemProRata` + `redeemToSingleAsset`)

### Goal
- Let connected wallets **exit** the vault from the dashboard: burn **shares** and receive underlying tokens using existing **`DAOVault`** redeem entrypoints (no contract changes).

### Human decisions
- **Two modes:** **Basket (pro-rata)** = one tx, no swaps (**`redeemProRata`** + **`assetsHint`** in **`trackedAssets`** order). **Single asset** = **`redeemToSingleAsset`** with **`SwapStep[]`** built in the browser.
- **Auto swap path (MVP):** only **Base Sepolia** vaults whose **tracked** set is exactly **canonical WETH + USDC** — single **`SwapRouter02` `exactInputSingle`** (fee **3000**), **`recipient = vault`**, **`minAmountOut = 0`** (testnet / demo parity with the existing TEST deposit swap). Other compositions: UI directs users to **basket** redeem or future extension of **[`redeemSwapSteps.ts`](../frontend/src/lib/redeemSwapSteps.ts)**.
- **`pauseAll`** blocks redeem (matches contract **`whenRedeemOpen`**).

### Frontend
- **[`WithdrawPanel.tsx`](../frontend/src/components/WithdrawPanel.tsx)** — share amount + **Max**, slice preview, wagmi **`redeemProRata`** / **`redeemToSingleAsset`**; friendly reverts via **`formatContractRevert`**.
- **[`redeemSwapSteps.ts`](../frontend/src/lib/redeemSwapSteps.ts)** — **`computeRedeemSlices`** (floor math aligned with vault) + **`buildSingleAssetRedeemSteps`**.
- **[`App.tsx`](../frontend/src/App.tsx)** — nav view **`withdraw`**; footer copy **deposit / withdraw**.
- **[`abi.ts`](../frontend/src/lib/abi.ts)** — **`redeemProRata`**, **`redeemToSingleAsset`** (tuple steps as **`(address,address,bytes)[]`** for **`parseAbi`**); redeem-related **errors** for decode.
- **[`vaultWriteErrors.ts`](../frontend/src/lib/vaultWriteErrors.ts)** — **`MinOut`**, **`IncompleteRedeem`**, **`BadStep`**, **`ZeroAmount`**, **`AssetNotAllowed`**, **`RouterNotAllowed`** messages.
- **[`index.css`](../frontend/src/index.css)** — withdraw layout (mode radios, preview, inputs).

### Docs
- **[`frontend/README.md`](../frontend/README.md)** — **Withdraw tab** section (behavior + limits).

### Reality checks
- **`redeemToSingleAsset`** is still **hard** for arbitrary multi-asset baskets without route building; the checklist item “reliable route + calldata for every vault shape” is **not** fully solved — only the **WETH/USDC** shortcut + **pro-rata** path.
- Production would need **Quoter**-driven **`minOut`**, more pools / hops, and optional **WETH → ETH** unwrap as a follow-up wallet step.

### Next session
1. Optional: slippage UI + **`minAmountOut`** for single-asset redeem.
2. Optional: generalize swap routing beyond **WETH↔USDC** (or document agent-side **`redeem`** helper).

---

## 2026-03-22 — History tab: switchable charts (trust, profits, balance)

### Goal
- One **History** surface with **three metrics over the same trust cycle order**, toggled by buttons (not all charts at once): **trust**, per-close **profit attribution**, and **cumulative attributed “balance”**.

### Human decisions
- **Profits / balance** series come from **`frontend/public/cycle-profits.json`** (same **`fetchCycleProfits`** as **Profits** tab). Join each **`trust-history.json`** step’s **`cycle_id`** to a profit row via **`voteStoreCycleKey`** or **`wallClockIndex`**.
- **“Balance”** = **running sum** of the viewer’s **`allocation1e18`** slices (Tier A off-chain accounting). **Not** live vault **share balance** or wallet token balance — caption + README say so explicitly (avoids confusion with **deposits** / **NAV**).

### Frontend
- **[`VotingHistoryTab.tsx`](../frontend/src/components/VotingHistoryTab.tsx)** — **`HistoryLineChart`** (shared SVG); **`buildTrustChartSeries`**, **`buildProfitChartSeries`**, **`buildBalanceChartSeries`**; **`history-chart-tabs`** (**Trust** / **Profits** / **Balance**) with **`role="tab"`**; **`useQuery`** for **`cycle-profits`**; loading/error + “no match / no allocation” hints.
- **[`index.css`](../frontend/src/index.css)** — **`.history-chart-tabs`**, **`.voting-card__header--wrap`**.

### Docs
- **[`frontend/README.md`](../frontend/README.md)** — **History** section updated (toggle behavior, data sources, balance semantics).

### Reality checks
- If **trust** **`cycle_id`** and **profit** keys drift, matched rows can be sparse — UI warns. **NAV** on the dashboard is **on-chain**; **TESTGAINS** / profit JSON do not move **`totalNAV()`**.

### Next session
1. Optional: **share balance over time** (logs/indexer) if judges need “deposits only” narrative on a chart.

---

## 2026-03-23 — Vercel hosting (frontend) + shareable URL

### Goal
- Host the **Vite dashboard** on **Vercel (Hobby)** so judges can open a **public URL** without running `pnpm dev`.

### Human decisions
- **GitHub → Vercel:** import monorepo with **Root Directory** = **`frontend`**; set **`VITE_*`** env vars in the Vercel project (mirror **`frontend/.env.example`** / local **`frontend/.env`** — **never** commit secrets).
- **Billing:** stay on **Hobby** without a card unless upgrading intentionally — no metered overage charges without payment on file.
- **Link to share:** use the **production** **`<project>.vercel.app`** domain from the project **Overview**, **not** long **per-deployment** hostnames (those are often **Preview** URLs).

### Agent / automation
- **`frontend/vercel.json`:** **`pnpm install --frozen-lockfile`** + SPA **`rewrites`** → **`index.html`** for client routing fallback.
- **Root `.gitignore`:** **`.pnpm-store/`** so the pnpm content store is never committed.

### Reality checks
- **Preview** deployments may require **Vercel login** (**Deployment Protection** / team defaults). **Incognito** hits that wall — fix via **Settings → Deployment Protection** (public production) and/or share **production** only.
- **Hobby** is **non-commercial** per Vercel fair-use wording; fine for typical hackathon demo framing.

### Next session
1. Confirm **production** URL works signed-out; add that URL to **README** / submission when ready.
2. Re-copy **`VITE_*`** if RPC or vault address changes.

---

## 2026-03-21 — Executor: QuoterV2 minOut, target-aware WETH sizing, band docs

### Goal
- Ship **Uniswap QuoterV2**-based **`amountOutMinimum`** on **`rebalance`**, **target-aware** swap sizing aligned with **`plan`**, **`PROJECT_SPEC` §7** closure in docs, and **band policy** edge-case documentation + tests.

### Human decisions
- **Drift / ε:** document **absolute_pp** as canonical; **relative** remains unimplemented (warn-only).
- **Executor:** keep **EOA `executor`** + vault role; **Quoter** is off-chain read for minOut only.
- **Sizing:** superseded — see **2026-03-21 (follow-up)** below (no **`REBALANCE_SIZING`** / **`REBALANCE_BPS`** split).

### Agent / automation
- **[`apps/agent/src/lib/bandPolicy.mjs`](../apps/agent/src/lib/bandPolicy.mjs)** + **[`planState.mjs`](../apps/agent/src/lib/planState.mjs)** — shared **`plan`** rows; **[`bandPolicy.test.mjs`](../apps/agent/src/lib/bandPolicy.test.mjs)** (`npm test` in `apps/agent`).
- **[`rebalance.mjs`](../apps/agent/src/rebalance.mjs)** — **`quoteExactInputSingle`** via **`uniswap.quoter_v2`** in **`config/chain/base.yaml`** / **`base_sepolia.yaml`**; fallback to mid + fee fudge; target sizing + clear errors for underweight WETH / non-WETH **`would_trade`**.
- **[`docs/BAND_POLICY.md`](./BAND_POLICY.md)**; **[`PROJECT_SPEC.md`](./PROJECT_SPEC.md) §7** updated; **[`apps/agent/README.md`](../apps/agent/README.md)** + execution skill refreshed.

### Reality checks
- Superseded — bidirectional **`rebalance`** shipped same day (see below).

### Next session
1. Optional: **contract verify** on Basescan.

---

## 2026-03-21 — Rebalance: WETH↔USDC (no sizing env)

### Goal
- **`rebalance.mjs`** follows **`plan`** for **both** directions: sell **overweight WETH** (→ USDC) or **overweight USDC** (→ WETH). Remove **`REBALANCE_SIZING`** / **`REBALANCE_BPS`** / **`REBALANCE_EXCESS_BPS`** as user-facing controls.

### Agent / automation
- **[`rebalance.mjs`](../apps/agent/src/rebalance.mjs)** — NAV excess vs target per leg; **QuoterV2** + mid fudge for **either** `tokenIn`; errors if drift is only on **non–WETH/USDC** tracked assets.

### Reality checks
- Multi-token vaults still need **extra routes** beyond this pool.

---

## 2026-03-21 — Hub rebalance: optional third token (cbETH) on Base mainnet

### Goal
- Hackathon **minimum** for “more tokens”: **USDC hub** + **two-hop** `exactInput` (Quoter `quoteExactInput`), single-hop for **TOKEN/USDC** and **WETH/USDC**.

### Agent / automation
- **[`apps/agent/src/lib/uniswapPath.mjs`](../apps/agent/src/lib/uniswapPath.mjs)** (path encode), **[`rebalanceRoutes.mjs`](../apps/agent/src/lib/rebalanceRoutes.mjs)**; **[`rebalance.mjs`](../apps/agent/src/rebalance.mjs)** — pick **max overweight** vs **most underweight** among **`would_trade`** rows; **[`config/chain/base.yaml`](../config/chain/base.yaml)** adds **`cbETH`** + **`usdc_pool_fee: 500`**.

### Reality checks
- **Vault** must **allowlist** cbETH and have a **price**; **Base Sepolia** has no third token in yaml by default (add a pool + yaml when ready).

---

## 2026-03-21 — Session summary: rebalance stack (handoff)

### Goal
- One place to read how **`rebalance`** works after this session: **plan**-driven **overweight → underweight**, **QuoterV2** for **`minOut`**, optional **USDC hub** + third token on **Base mainnet**, without legacy **`REBALANCE_SIZING`** / **`REBALANCE_BPS`** knobs.

### Human decisions
- **Sizing:** always derived from **`npm run plan`** + **`bands.yaml`** (largest overweight vs most underweight among **`would_trade`**).
- **Third token:** **cbETH** in **[`config/chain/base.yaml`](../config/chain/base.yaml)** with **`usdc_pool_fee: 500`**; **Sepolia** stays **WETH + USDC** until a real **TOKEN/USDC** pool + yaml block exist.
- **Oracle guard:** only when the route touches the **WETH/USDC 0.3%** pool; other legs rely on **Quoter** (mid fallback **only** for **WETH↔USDC** single-hop).

### Agent / automation
- **[`rebalance.mjs`](../apps/agent/src/rebalance.mjs)** — **`exactInputSingle`** or **`exactInput`** (two-hop path); **`quoteExactInput`** / **`quoteExactInputSingle`**; **[`uniswapPath.mjs`](../apps/agent/src/uniswapPath.mjs)**, **[`rebalanceRoutes.mjs`](../apps/agent/src/lib/rebalanceRoutes.mjs)**.
- **Shared plan:** **[`planState.mjs`](../apps/agent/src/lib/planState.mjs)** + **[`bandPolicy.mjs`](../apps/agent/src/lib/bandPolicy.mjs)**; **`npm test`** in **`apps/agent`** covers band + path encoding.
- **Docs:** **[`BAND_POLICY.md`](./BAND_POLICY.md)**, **[`PROJECT_SPEC.md`](./PROJECT_SPEC.md) §7**, **[`apps/agent/README.md`](../apps/agent/README.md)**, execution skill; **CI** runs **`npm test`** in agent workflow.

### Reality checks
- **Governance** must **allowlist** any third token and wire **oracles**; multi-hop **reverts** if **Quoter** fails (no unsafe **`minOut`** on path).
- **Four** separate **`2026-03-21`** sections above capture the same work in smaller steps; this block is the **consolidated** pointer.

### Next session
1. Optional: **contract verify** on Basescan; **Sepolia** third token when a pool + addresses are fixed.
2. Submission / demo proof (explorer links, video) when ready — out of scope for this build log entry.

---

## 2026-03-22 — Single-asset redeem: QuoterV2 + vault `minAmountOut`

### Goal
- Close checklist **D — single-asset exit** / **C2 execution quality** on the **highest-traffic user path**: **Withdraw → single asset** no longer hardcodes **`minOut = 0`** when **QuoterV2** succeeds.

### Agent / automation
- **[`frontend/src/lib/redeemSwapSteps.ts`](../frontend/src/lib/redeemSwapSteps.ts)** — **`getSingleAssetRedeemPlan`**, **`quoteSingleAssetRedeem`** (RPC **QuoterV2** `quoteExactInputSingle`, **`DEFAULT_REDEEM_SLIPPAGE_BPS`** = 100); swap **`amountOutMinimum`** + vault **`minAmountOut`** = `sliceOut +` slippage-adjusted quoted output; quoter failure → **0** fallback (legacy demo).
- **[`frontend/src/lib/contracts.ts`](../frontend/src/lib/contracts.ts)** — **`QUOTER_V2`**, **`DEFAULT_REDEEM_SLIPPAGE_BPS`**.
- **[`WithdrawPanel.tsx`](../frontend/src/components/WithdrawPanel.tsx)** — async quote before **`redeemToSingleAsset`**.
- **[`checklist.md`](../checklist.md)** — D items updated; **[`frontend/README.md`](../frontend/README.md)** withdraw section.

### Reality checks
- Superseded — **TEST** swap now uses the same Quoter pattern (see **2026-03-22 — TEST swap: QuoterV2 + shared `uniswapQuote`** below).

### Next session
1. **Proof pack** tx hashes for submission (**B / C2**).

---

## 2026-03-22 — TEST swap: QuoterV2 + shared `uniswapQuote`

### Goal
- Remove **`minOut = 0`** as the default on the **TEST** ETH → WETH → USDC → deposit path when **QuoterV2** succeeds (checklist **C2**).

### Agent / automation
- **[`frontend/src/lib/uniswapQuote.ts`](../frontend/src/lib/uniswapQuote.ts)** — **`quoteExactInputSingleOrZero`**, **`applySlippageFloor`**; used by **[`redeemSwapSteps.ts`](../frontend/src/lib/redeemSwapSteps.ts)** and **[`TestSwapDepositPanel.tsx`](../frontend/src/components/TestSwapDepositPanel.tsx)**.
- **[`contracts.ts`](../frontend/src/lib/contracts.ts)** — **`DEFAULT_SWAP_SLIPPAGE_BPS`** (100); **`DEFAULT_REDEEM_SLIPPAGE_BPS`** alias.
- **[`frontend/README.md`](../frontend/README.md)** TEST section updated.

### Reality checks
- Quoter **revert** → **`minOut = 0`** (same as before).

### Next session
1. **Proof pack** / explorer links for judges.

---

## 2026-03-22 — Proof pack scaffold + Profits raw draw column

### Goal
- **`docs/PROOF.md`:** single fill-in surface for **B / C2 / C3 / A** (explorer txs, URLs, submission fields) so evidence is gathered without hunting README threads.
- **Process:** keep **`BUILD_LOG`** **Current state** + dated sessions updated as work lands (this entry).
- **Functional:** **Profits** tab surfaces per-cycle **`testGainsRawSample1e18`** when **`TESTGAINS`** is active (checklist **F**).

### Human decisions
- **`PROOF.md`** lives under **`docs/`** (with **`BUILD_LOG`**, **`DEPLOY.md`**); root [**`README.md`**](../README.md) links it; [**`checklist.md`**](../checklist.md) **B / C2** point here.

### Agent / automation
- **[`docs/PROOF.md`](./PROOF.md)** — placeholders for chain, contracts, Uniswap proof pack (U1–U3), demo story txs, autonomy, hosting, video, Devfolio fields, disclosures, optional verify/delegations.
- **[`frontend/src/components/ProfitsTab.tsx`](../frontend/src/components/ProfitsTab.tsx)** — **You** table column **Raw draw** when **`testGainsActive`**; **Everyone** → **Per cycle (TESTGAINS)** table (pool + raw pre-clamp) so judges see draws without connecting a wallet.
- **[`frontend/README.md`](../frontend/README.md)** — Profits bullet updated.

### Next session
1. Fill **`PROOF.md`** with real hashes/URLs; optional **contract verify**; further product gaps from [**`checklist.md`**](../checklist.md) **D**.

---

## 2026-03-23 — Judge-facing README, autonomy doc, vault §6.6 (Tier A vs Tier B)

### Goal
- Close more **Synthesis checklist** items without new contracts: **C1** repo map + story, **C2** explicit Uniswap stack, **C3** autonomy + risk + demo-knob labeling, **B** disclosures, **E** vault P&L notes.
- Keep **`BUILD_LOG`** as the handoff surface (this session + **Current state** below).

### Agent / automation
- **[`README.md`](../README.md)** — **Judge-facing (Synthesis)** section: table (**STRUCTURE**, **BUILD_LOG** Current state, **`PROOF.md`**, **`checklist.md`**), one-screen story, **SwapRouter02 + QuoterV2** stack and **not-claimed** paths (Permit2 / API / v4), **`npm run agent`** autonomy summary, risk bounds, testnet knobs, disclosures (Tier A vs Tier B pointer). Sponsor line: Uniswap **API** only if claimed.
- **[`apps/agent/README.md`](../apps/agent/README.md)** — **Autonomy (Base / Synthesis)** — **`AGENT_INTERVAL_SEC`**, executor vs governance keys, **`AGENT_REBALANCE_FROZEN_PHASE_ONLY`**, pointer to **`agent.mjs`** header comment.
- **[`vault/spec.md`](../vault/spec.md)** — **§6.6** — **`cycle-profits.json`** vs **Tier B** deposit/withdraw adjustments; redeem / illiquidity clarity.
- **[`checklist.md`](../checklist.md)** — **C1 / C2 / C3 / B / E** items updated to match (submission **innovation** one-liner + **live** explorer proof still open).

### Next session
1. **`docs/PROOF.md`** — real txs + deployed URL; **C1** innovation copy; **video**.

---

## 2026-03-23 — Checklist as status + README reproducible cycle + innovation copy

### Goal
- Turn **[`checklist.md`](../checklist.md)** into a **single source of truth**: legend, **N/A** / **Decision** rows, unchecked only for real remaining work.
- Ship **C1** innovation paragraph + **B** reproducible cycle + address wiring in root [**`README.md`**](../README.md).

### Agent / automation
- **[`README.md`](../README.md)** — **Innovation / impact** bullets; **Deployed addresses** line; **`### Reproducible demo cycle`** (numbered `aggregate` → `plan` → `votes:export` → `rebalance` + `npm run agent` note).
- **[`package.json`](../package.json)** — root shims: **`npm run plan`**, **`aggregate`**, **`quorum:check`**, **`votes:export`**, **`rebalance`**, **`cycle:snapshot`** (delegate to **`apps/agent`**).
- **[`checklist.md`](../checklist.md)** — rewritten sections **A–F**; **C4** defer, **C5** N/A, **C2** API N/A; **Next implementation targets** at bottom.

### Next session
1. Human: **A**, **B** explorer/video/**PROOF** fills; optional **D** verify / Telegram / Tier B.

---

## 2026-03-23 — Checklist: Done vs To do columns

### Goal
- **[`checklist.md`](../checklist.md)** reads as a **real checklist**: each section has **## Done** / **### Done** (all `- [x]`) and **## To do** / **### To do** (all `- [ ]`), plus a **summary** count (22/20).

### Next session
1. Tick items as **PROOF** / **Devfolio** land; keep counts in sync.

---

## Current state (update every session)

- **Branch / commit:** `main` — sync `origin` after your latest commit.
- **Shipped in repo:** **`DAOVault`** (+ **`ballotAssets`**); **DeployConfigure** / **Configure** + **`BaseSepolia`** libs; **mock oracles**; **agent:** `plan`, `aggregate`, `trust`, `quote`, **`rebalance`**, **`npm run agent`** (orchestrator), **quorum check**, **on-chain ballot sync**, **trust finalize pipeline**; **[`DEPLOY.md`](./DEPLOY.md)**; **`config/chain/base.yaml`** + **`base_sepolia.yaml`**; **CI:** Foundry + [`agent.yml`](../.github/workflows/agent.yml).
- **Trust pipeline (working end-to-end):** On rollover: **sync on-chain ballots** (preserves vote-time `priceMarksUsdc`) → **stamp prices** (fills missing; uses **WETH oscillator** on testnet when `TESTWETHOCCILATOR` set) → **finalize** (time-weighted portfolio return × `TESTBOOSTTRUST` amplifier) → **trust scoring** (`trust.mjs` applies `scoring.yaml` rule) → **export** (`trust-scores.json`). Trust confirmed moving off 1.0 (e.g. 0.1 floor or 3.0 ceiling depending on oscillator direction).
- **Dev knobs:** `TESTWETHOCCILATOR` (synthetic WETH/USDC for dead testnet pools), `TESTBOOSTTRUST` (amplify bps), `TRUST_MIN_TIME_WEIGHT_FLOOR` (clamp late-vote time weight), `TESTGAINS` (**T** = NAV-scale bound; each exported close draws **uniform in `[-T/2, T]`**, pool **`max(0,·)`** instead of NAV Δ; **`cycle-profits.json`** carries **`testGainsRange`** + per-row raw sample).
- **Allocation quorum:** `check-quorum-for-targets.mjs` gates `targets.json` writes; `AGENT_REQUIRE_QUORUM_FOR_TARGETS` (default on). Plan/rebalance skip cleanly when targets are empty.
- **Wall-clock:** **[`config/agent/cycles.yaml`](../config/agent/cycles.yaml)** = schedule source; **[`config/local/cycle-clock.json`](../config/local/cycle-clock.json)** = genesis unix (v2); see [`cycleClock.mjs`](../apps/agent/src/lib/cycleClock.mjs).
- **Agent skills:** [`apps/agent/skills/rebalancing/`](../apps/agent/skills/rebalancing/), [`apps/agent/skills/execution/`](../apps/agent/skills/execution/) + **`poolMidPrice`** helper; **rebalance** preflight: **oracle vs pool** guard when route touches **WETH/USDC 0.3%** + **`minOut` from QuoterV2** (`quoteExactInput` / `quoteExactInputSingle`; mid fallback for **WETH↔USDC** only); **`plan`**-aligned **overweight → underweight** with optional **USDC-hub** third token (e.g. **cbETH** in [`config/chain/base.yaml`](../config/chain/base.yaml)); [`docs/BAND_POLICY.md`](./BAND_POLICY.md) for band edge cases.
- **Frontend (Vite):** **`frontend/`** @ **http://localhost:1337** — **dashboard** (access control ~half width + **NAV allocation** donut; **no** main-surface **Pause flags** / **Contract** blocks) + **Withdraw** tab (**`redeemProRata`** basket exit + **`redeemToSingleAsset`** with auto **WETH↔USDC** **`SwapRouter02`** steps on Base Sepolia; **QuoterV2** + slippage for **`minOut`** when quote succeeds; **`minOut = 0`** fallback if quoter fails) + **TEST** swap-to-deposit (**`TestSwapDepositPanel`**, shared **`uniswapQuote.ts`**, same Quoter / fallback) + **Trust leaderboard** tab (sort **Trust / Share % / Power**, bar chart, **you** highlight, compact power formatting) + **History** tab (**`/trust-history.json`** + table; **toggle charts** — **Trust** / **Profits** / **Balance** with **`/cycle-profits.json`** join by cycle id; **Balance** = cumulative **attributed** profit slices, not on-chain share balance) + **Profits** tab (**`/cycle-profits.json`** — per-**`closeCycle`** split **∝ trust_before × shares**, charts/stats, compact power, **TESTGAINS** tooltip + per-cycle **`testGainsRawSample1e18`** in **You** / **Everyone** tables when synthetic pools are on) + **Voting**: **Cast** vs **Aggregate** in **`ballotAssets`** order with **shared `colorIndex` pie colors**; **Voted/Pending** ballot status; trust scores **†/◆**; legacy **allowlist** banner; **NAV weight %** on tracked assets; schedule JSON **polls**. **Optional deploy:** **Vercel** — **Root Directory** **`frontend`**, **`VITE_*`** in project env, **`frontend/vercel.json`** (frozen lockfile + SPA rewrites); share **production** **`.vercel.app`** (avoid login-gated **preview** deployment URLs / adjust **Deployment Protection**).
- **Allocation voting (end-to-end):** **`vote-store`** + **`cycle:sync`** → **`cycle:snapshot`** → trust-weighted **`aggregate`** + **`votes:export`** → **`allocation-votes.json`**; **`trust:export`** writes **`trust-scores.json`** + **`trust-history.json`**; **`castAllocationBallot`** on **`DAOVault`**. **Rollover:** **`closeCycle`** + full trust pipeline when keys + env allow.
- **On-chain:** deploy + executor **`rebalance`** evidence on explorer — **hashes and contract addresses stay out of this log**.
- **Config:** [`config/rebalancing/bands.yaml`](../config/rebalancing/bands.yaml); **`config/local/targets.json`** gitignored — from **aggregate** for **`plan`**; **[`config/trust/scoring.yaml`](../config/trust/scoring.yaml)** drives trust multipliers.
- **Tests:** **`DAOVault.t.sol`** **18** tests; fork test optional.
- **Submission evidence:** **[`docs/PROOF.md`](./PROOF.md)** — placeholder tables for explorer txs, deployed URLs, autonomy notes, video/Devfolio fields; fill as you gather proof (**B / C2**). Update **`BUILD_LOG`** each meaningful pass (dated section + **Current state**). **Judge-facing** summary: **[`README.md`](../README.md#judge-facing-synthesis)** (story, Uniswap stack, autonomy, disclosures, **innovation**, **reproducible cycle**); **Tier A vs B:** [`vault/spec.md`](../vault/spec.md) **§6.6**. **Checklist status:** **[`checklist.md`](../checklist.md)** — **Done** vs **To do** + summary counts (keep counts in sync when ticking).
- **Blocked / polish:** optional **contract verify**; **multi-asset** vaults need more **routes** than WETH/USDC; **Synthesis** draft update with demo artifacts.
- **Tracks (provisional):** Open + Uniswap + MetaMask Delegations + Autonomous Trading Agent.
- **Synthesis status:** registration + team access verified; **project draft** online (**draft** status), **four** tracks attached; **`draft.md`** in repo root — refine before publish.
