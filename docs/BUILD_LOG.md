# Build log — Synthesis Hackathon

## How this file works

- **Chronological sessions:** Each time you make a meaningful pass (planning, coding, pivots), add a **new section** with heading `## YYYY-MM-DD — Short title` (add `(pm)` or a second date if you log twice in one day).
- **Order:** **Oldest at the top**, **newest just above** [`Current state`](#current-state-update-every-session). Do **not** reorder or delete past sections—this is a timeline.
- **Handoff:** **Start** each work session by reading **Current state** (bottom). **End** by (1) appending a new dated section and (2) rewriting **Current state**.
- **Rules:** No secrets (API keys, tokens, private keys). Summarize decisions and commits—don’t paste full model dumps.

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
- **Registration:** Completed via **web form** (confirmation received). API key (`sk-synth-…`) / Devfolio next steps TBD from email or Telegram (`https://nsb.dev/synthesis-updates`).
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
- Confirm path to **`sk-synth-…`** / team UUID if web registration doesn’t expose API automatically.
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
- `sk-synth-…` / team UUID / track UUIDs unchanged vs prior sessions.

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
- Same as earlier: **`sk-synth-…`**, team UUID, **track UUIDs** from `/catalog`.
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
- **On-chain:** `DeployConfigureDAOVault.s.sol` completed; **`DAOVault`** at **`0xc738Fd6CD6CDe70e30F979fe62a0332ad37a5543`** (confirm in `contracts/broadcast/.../run-latest.json` / Basescan); mock aggregators deployed in same sequence.
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

## Current state (update every session)

- **Branch / commit:** `main` — sync `origin` after your latest commit.
- **Shipped in repo:** **`DAOVault`** + unit tests; **DeployConfigure** / **Configure** + **`BaseSepolia`** libs; **mock oracles** for testnet configure; **agent:** `plan`, `aggregate`, `trust`, `quote`, **`npm run rebalance`**; **[`DEPLOY.md`](./DEPLOY.md)**; **`config/chain/base.yaml`** + **`base_sepolia.yaml`**; **CI:** Foundry + [`agent.yml`](../.github/workflows/agent.yml).
- **Agent skills:** [`apps/agent/skills/rebalancing/`](../apps/agent/skills/rebalancing/), [`apps/agent/skills/execution/`](../apps/agent/skills/execution/) + **`poolMidPrice`** helper; **rebalance** preflight: **oracle vs pool** guard + **minOut** from mid (env-tunable; testnet bypass flag documented).
- **Frontend (Vite):** **`frontend/`** @ **http://localhost:1337** — dashboard + **Users** + **`DepositPanel`** + **`TestSwapDepositPanel`**, **Tracked assets** show **NAV weight %** (warn color) before asset name. See [`frontend/README.md`](../frontend/README.md).
- **On-chain (Base Sepolia):** **DAOVault** deployed; **addresses** only in **local `.env`** / **`contracts/broadcast`** — not in this log. **Two** executor **`rebalance`** txs executed (WETH→USDC **SwapStep**); vault holds mixed WETH/USDC with **NAV** driven by **oracle** marks.
- **Config:** [`config/rebalancing/bands.yaml`](../config/rebalancing/bands.yaml) — **1 pp** epsilon floor, **min notional 0** (dollar gate off for now); **`config/local/targets.json`** gitignored — created from **aggregate** for **`plan`**.
- **Tests:** **14** pass + **1** fork **skipped** unless `BASE_MAINNET_RPC_URL` is set (CI-safe).
- **Blocked / polish:** optional **contract verify**; **target-aware** rebalance sizing + **Quoter**; align **oracle** vs **pool** for coherent testnet NAV or lean on **guard** narrative; **Synthesis** draft update with demo artifacts.
- **Scope locks (provisional):** **Base** + **Uniswap** + **delegations** narrative; rebalance bands in config; **Tier A** P&L bias unless upgraded.
- **Tracks (provisional):** Open + Uniswap + MetaMask Delegations + Autonomous Trading Agent (see live catalog UUIDs).
- **Synthesis status:** registration + team access verified; **project draft** online (**draft** status), **four** tracks attached; **`draft.md`** in repo root holds payload template — refine before publish (self-custody, video, etc.).
