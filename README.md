# DAO Agent

**Autonomous treasury + reputation-weighted votes** — a pooled vault on **Base** where stakeholders vote on target allocations, **trust** tracks voting performance over time, and an **agent** rebalances via **Uniswap** only when drift exceeds **governance-tuned bands** (no micro-swaps to chase 89.99% → 90%).

Built for **[The Synthesis](https://synthesis.md/)** hackathon (agentic × Ethereum).

> **Status:** Foundry **`DAOVault`** + tests (incl. **`ballotAssets`**-indexed **`castAllocationBallot`** on current bytecode); **[`docs/DEPLOY.md`](docs/DEPLOY.md)** (Base Sepolia **DeployConfigure** one-shot); **agent** [`plan` / `aggregate` / `trust` / `quote` / `rebalance`](apps/agent/README.md); **frontend** ([`frontend/README.md`](frontend/README.md)) — **Deposit**, **Voting** (on-chain ballots + **pie** previews, trust-weighted aggregate table, legacy-vault fallback when bytecode predates **`ballotAssets`**), hackathon **TEST** swap path. **Aggregate targets** for **`plan`** stay **off-chain** (JSON / events), not written into vault storage. Session details: [`docs/BUILD_LOG.md`](docs/BUILD_LOG.md).

---

## Why it exists

| Pain | Direction |
|------|-----------|
| Crowds are noisy; dollar-votes don’t reward **track record** | Voting power blends **share** and **trust** |
| People want collective exposure without blind automation | **Governance** caps risk (allowlist, slippage, rebalance thresholds) |
| On-chain agents shouldn’t churn dust trades | **Band policy** — swap only above configurable **ε** / min notional ([spec §2.1](docs/PROJECT_SPEC.md#21--rebalance-bands-threshold-policy)) |

Full problem/solution and MVP scope: [**docs/PROJECT_SPEC.md**](docs/PROJECT_SPEC.md).

---

## Judge-facing (Synthesis)

| Need | Where |
|------|--------|
| **Repo map + diagram** | [**STRUCTURE.md**](STRUCTURE.md) |
| **What ships now** | [**docs/BUILD_LOG.md**](docs/BUILD_LOG.md) — section **Current state** (bottom) |
| **Explorer txs / URLs (fill in)** | [**docs/PROOF.md**](docs/PROOF.md) |
| **Open tasks** | [**checklist.md**](checklist.md) |

**Story (one screen):** Pooled **DAOVault** on **Base**; holders vote on **target weights**; **trust** updates from ballot performance; only the **executor** may **`rebalance`**, and only when drift exceeds **governance bands** ([§2.1](docs/PROJECT_SPEC.md#21--rebalance-bands-threshold-policy)). **Tier A** per-cycle profit splits live in **off-chain JSON** (`cycle-profits.json` / Profits tab) — **not** a separate on-chain profit claim in this MVP ([`vault/spec.md`](vault/spec.md) §6).

**Uniswap stack:** **Uniswap v3** on Base — **`SwapRouter02`** with **`exactInputSingle`** / **`exactInput`** calldata from the agent and frontend; **QuoterV2** sets **`minOut`** on **`rebalance`** and user-side swap/redeem paths. **Not** on the critical path here: **Permit2**, **Uniswap v4**, **Uniswap Developer Platform API** (say so in submission if you add any).

**Autonomy:** From repo root, **`npm run agent`** ([`apps/agent/README.md`](apps/agent/README.md)) runs a tick loop: **`AGENT_INTERVAL_SEC`** (default 60s), optional **`EXECUTOR_PRIVATE_KEY`** for **`plan → rebalance`**, optional **`GOVERNANCE_PRIVATE_KEY`** for **`closeCycle`** on rollover. **`cycle:daemon`** alone does **not** broadcast **`rebalance`** — see **Autonomy** in the agent README.

**Risk bounds (what code enforces):** **Allowlisted** routers and tokens; **executor-only** **`rebalance`**; band policy from [`config/rebalancing/bands.yaml`](config/rebalancing/bands.yaml). **Oracle vs pool** can diverge on thin testnet pools — [`docs/BAND_POLICY.md`](docs/BAND_POLICY.md).

**Testnet / demo knobs** (`TESTWETHOCCILATOR`, `TESTGAINS`, …): for **demos**, not production alpha — label them in recordings.

**Disclosures:** Pooled **prototype**; **oracle / manipulation** caveats in [`docs/VAULT_ORACLE_AND_GOVERNANCE.md`](docs/VAULT_ORACLE_AND_GOVERNANCE.md) and [`vault/spec.md`](vault/spec.md) §9; **trust** benchmark and ε semantics in [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md) §7 + **BUILD_LOG**. **Profits** UI = **Tier A attribution** (not deposit-adjusted Tier B — [`vault/spec.md`](vault/spec.md) §6.6).

**Innovation / impact (submission copy):** This is **not** a fixed-threshold multisig: **trust** updates from **measurable ballot performance**, and the **executor** only moves the vault when **band policy** says drift is large enough — reducing noise and dust trades. **Targets** for **`plan`** are produced from the **same vote-store → aggregate** pipeline judges can inspect, without writing aggregate weights into vault storage in the MVP. **Tier A** profit attribution is **transparent JSON** tied to **`closeCycle`**, so the **governance + agent** story is **auditable** from the repo and static exports.

**Deployed addresses:** After deploy, put public **`0x`** values in [**docs/PROOF.md**](docs/PROOF.md) §1 and mirror env names from [`config/chain/contracts.yaml`](config/chain/contracts.yaml) in root **`.env`** and **`frontend/.env.local`** — do not commit secrets.

### Reproducible demo cycle

One full **off-chain → plan → (optional) on-chain** loop you can run locally (needs **`CHAIN_RPC_URL`**, **`VAULT_ADDRESS`** in **`.env`**; install agent deps once: **`cd apps/agent && npm install`**; see [`apps/agent/README.md`](apps/agent/README.md)). Commands below work from **repo root** via [`package.json`](package.json) scripts (same as `cd apps/agent && npm run …`).

1. **Votes** — `cp apps/agent/fixtures/vote-store.example.json config/local/vote-store.json` and edit ballot weights; optional **`npm run cycle:snapshot`** to refresh snapshot shares.
2. **Aggregate → targets** — **`npm run aggregate`** → writes **`config/local/targets.json`** when quorum passes (or set **`AGENT_REQUIRE_QUORUM_FOR_TARGETS=0`** once to force write — dev only).
3. **Quorum (optional)** — **`npm run quorum:check`** — exit **`0`** if allocation quorum is met.
4. **Plan** — **`npm run plan`** — prints **`would_trade` / `skip`** vs bands ([`config/rebalancing/bands.yaml`](config/rebalancing/bands.yaml)).
5. **Dashboard JSON** — **`npm run votes:export`** → **`frontend/public/allocation-votes.json`** for the Voting tab.
6. **Rebalance (executor key)** — **`npm run rebalance`** — broadcasts **`DAOVault.rebalance`** when **`EXECUTOR_PRIVATE_KEY`** is set and **`plan`** says trade.

**Live rollover** (gov + trust + profits JSON): use **`npm run agent`** from repo root when **`GOVERNANCE_PRIVATE_KEY`** / pipeline envs are configured — see [`apps/agent/README.md`](apps/agent/README.md).

---

## Repository layout

```
contracts/      # Foundry: DAOVault + tests (see contracts/README.md)
apps/agent/     # Node: **`npm run agent`** (repo root) or plan | aggregate | trust | quote — see apps/agent/README.md
frontend/       # Vite React dashboard @ localhost:1337 (see frontend/README.md)
docs/           # Spec, build log, governance model, checklist
vault/          # Vault spec + checklist
config/         # Non-secret agent defaults (YAML); see config/README.md
.env.example    # Environment variable *names* only (no secrets in git)
```

`contracts/` — Foundry vault (`forge build` / `forge test`); see [`contracts/README.md`](contracts/README.md).  
`apps/agent/` — [`apps/agent/README.md`](apps/agent/README.md). Optional Telegram bot later.  
`frontend/` — read-only vault UI: [`frontend/README.md`](frontend/README.md).

---

## Quick start (contributors)

1. Clone the repo **with submodules** (OpenZeppelin + `forge-std` live under `contracts/lib/`):
   ```bash
   git clone --recurse-submodules <URL>
   # or after a plain clone:
   git submodule update --init --recursive
   ```
2. Copy env template — **never commit real secrets**:
   ```bash
   cp .env.example .env
   ```
3. Fill in `.env` once you deploy contracts or run RPC (see comments inside `.env.example`).
4. Read [**config/README.md**](config/README.md) for how YAML and env vars combine.

### Commands

```bash
cd contracts && forge build && forge test
```

Dry-run rebalance planner (needs `CHAIN_RPC_URL`, `VAULT_ADDRESS` in `.env`; install agent deps once: `cd apps/agent && npm install`):

```bash
npm run plan
```

**Vault dashboard** (set `VITE_RPC_URL` + `VITE_VAULT_ADDRESS` in `frontend/.env.local`; see [`frontend/.env.example`](frontend/.env.example)):

```bash
cd frontend && npm install && npm run dev
```

→ **http://localhost:1337**

Copy [`apps/agent/fixtures/targets.example.json`](apps/agent/fixtures/targets.example.json) to `config/local/targets.json` and set real token addresses.

**Synthesis track catalog** (needs network): `npm run synthesis:catalog` — use for **`trackUUIDs`** before submit (see [`TRACKS.md`](TRACKS.md)).

**Deploy on Base Sepolia:** step-by-step [`docs/DEPLOY.md`](docs/DEPLOY.md) (recommended: `DeployConfigureDAOVault` one-shot). Then set `VAULT_ADDRESS` in `.env` and document addresses in [`config/chain/contracts.yaml`](config/chain/contracts.yaml). Contract commands: [`contracts/README.md`](contracts/README.md).

**New to this?** Follow the hand-holding guide: [**`docs/STEP_BY_STEP.md`**](docs/STEP_BY_STEP.md).

---

## Documentation

| Doc | Purpose |
|-----|---------|
| [STRUCTURE.md](STRUCTURE.md) | Repo layout + Mermaid architecture (links to `DEPLOY`, specs) |
| [apps/agent/README.md](apps/agent/README.md) | `plan` / `aggregate` / `trust` / `quote` (dry-run) |
| [frontend/README.md](frontend/README.md) | Read-only vault dashboard (`npm run dev` → port 1337) |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Base Sepolia deploy + configure + agent wiring |
| [docs/STEP_BY_STEP.md](docs/STEP_BY_STEP.md) | **Start here** if you’re new: wallet, RPC, deploy, `npm run plan` |
| [vault/spec.md](vault/spec.md) | On-chain vault design (shares, redeem-to-one-asset, executor, pause) |
| [TRACKS.md](TRACKS.md) | Synthesis prize tracks + fit (`npm run synthesis:catalog` for UUIDs) |
| [docs/PROJECT_SPEC.md](docs/PROJECT_SPEC.md) | MVP, rebalance bands, backlog |
| [docs/GOVERNANCE_VOTING.md](docs/GOVERNANCE_VOTING.md) | Parameter vs allocation votes, registry ideas |
| [docs/BUILD_LOG.md](docs/BUILD_LOG.md) | Chronological human ↔ agent work log |
| [docs/BUILD_CHECKLIST.md](docs/BUILD_CHECKLIST.md) | Ordered checklist toward submission |
| [checklist.md](checklist.md) | **Current status** — what’s done vs open (A–F); start here for submit |
| [docs/PROOF.md](docs/PROOF.md) | **Judge proof pack** — explorer txs, URLs, submission placeholders (fill as you gather evidence) |
| [docs/SUBMIT.md](docs/SUBMIT.md) | **Synthesis submit** — published project status, **`videoURL`** one-liner, last steps |
| [docs/DEMO_VIDEO.md](docs/DEMO_VIDEO.md) | **Hackathon demo video** — step-by-step record → Basescan → `npm run plan` → upload + PROOF §6 |
| [docs/SUBMISSION_METADATA.md](docs/SUBMISSION_METADATA.md) | **Devfolio paste** — tools, model, skills, repo URL (edit `YOUR_*`; no secrets) |
| [docs/HUMAN_ONLY.md](docs/HUMAN_ONLY.md) | **What only you can do** after automation (PROOF, publish, video) |
| [docs/TRUST_RPC_AND_BALLOTS.md](docs/TRUST_RPC_AND_BALLOTS.md) | Ballot stamps + sync (agent env) |
| [docs/VAULT_ORACLE_AND_GOVERNANCE.md](docs/VAULT_ORACLE_AND_GOVERNANCE.md) | Oracle stack, roles, feed sunset / manual override |

---

## Intended sponsor alignment (provisional)

- **Synthesis Open Track**
- **Uniswap** — agentic finance; **SwapRouter02 + QuoterV2** txs on Base ([Judge-facing](#judge-facing-synthesis)); Uniswap **API** only if you add it and claim that path
- **MetaMask** — **delegations** as the core “capped executor” story, if claimed

Refresh prize/track UUIDs via `GET https://synthesis.devfolio.co/catalog` before submitting.

---

## Disclaimer

This repository is an **experimental hackathon prototype**. It is **not** investment, legal, or security advice. Pooling assets and automated trading carry **total loss** risk. Do **not** use production keys or substantial funds without professional review.

---

## License

[MIT](LICENSE)
