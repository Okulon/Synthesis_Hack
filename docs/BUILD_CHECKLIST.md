# Build checklist — DAO Agent (Synthesis)

Use this as the **order of operations**. Check boxes as you go. Details live in [`PROJECT_SPEC.md`](./PROJECT_SPEC.md); governance params in [`GOVERNANCE_VOTING.md`](./GOVERNANCE_VOTING.md); session narrative in [`BUILD_LOG.md`](./BUILD_LOG.md).

_Last reviewed: 2026-03-19._

---

## P — Planning & docs (foundation)

- [x] **Product spec** — [`PROJECT_SPEC.md`](./PROJECT_SPEC.md) (MVP, rebalance bands §2.1, backlog)
- [x] **Governance model** — [`GOVERNANCE_VOTING.md`](./GOVERNANCE_VOTING.md) (param registry, vote streams, MVP recommendation)
- [x] **Build log** — [`BUILD_LOG.md`](./BUILD_LOG.md) (cross-session handoff + **Current state**)
- [x] **Config scaffold** — [`config/`](../config/) (`agent/`, `chain/`, `dex/`, `rebalancing/`, `governance/`, `trust/`, `telegram/`, `integrations/`, `logging/`, `security/`)
- [x] **`.gitignore`** — root (`.env`, `config/local/`, common artifacts)
- [x] **`.env.example`** — secret **names** only; `cp .env.example .env` documented there
- [x] `git add` / **commit** + **push** current docs + config (ongoing; use submodules for `contracts/lib`)

---

## 0 — Hackathon & identity

- [x] **Initial registration** — web form submitted (confirm email / Telegram for follow-ups: [`BUILD_LOG.md`](./BUILD_LOG.md))
- [ ] Obtain **`sk-synth-…`** (or documented web-only submission path) and **team UUID** when available
- [ ] `GET https://synthesis.devfolio.co/catalog` — save **track UUIDs** you will claim (refresh before submit)
- [ ] Wallet ready for **self-custody transfer** before publish (all team members — solo = you)

---

## 1 — Repo & hygiene

- [x] Root **README**: problem, MVP demo steps, env vars (names only), links to docs
- [x] `.gitignore` (node, forge, `.env`, keys, `out/`, `cache/`, etc.)
- [x] **No secrets in git** — `.env.example` + [`config/README.md`](../config/README.md)
- [x] License file — [`LICENSE`](../LICENSE) (MIT)
- [x] **First commit** on repo (`Initial Commit`); **follow-up commit** needed for latest files (see **§ P**)

---

## 2 — MVP freeze (before heavy code)

- [x] **MVP scope** documented — [`PROJECT_SPEC.md`](./PROJECT_SPEC.md) §2 + §2.1 (+ architecture §3)
- [x] Lock **chain** — **Base** (`config/chain/base.yaml`, spec)
- [ ] Lock **custody model** (vault vs smart account — still open in spec §7; decide & log in `BUILD_LOG`)
- [x] Lock **2–3 allowlisted tokens** + **Uniswap** for v0 (spec + `config/chain/contracts.yaml` hints + `config/dex/uniswap.yaml`)
- [x] Lock **rebalance band defaults** — spec §2.1 + `config/rebalancing/bands.yaml`
- [x] **Telegram** direction — `config/telegram/bot.yaml` (polling MVP); refine notify-only vs vote UX when building §5

---

## 3 — Smart contracts / on-chain

- [ ] Vault (or equivalent): **deposit / withdraw / share** accounting for MVP assumptions
- [ ] **Governance knobs** minimal set: allowlist, max slippage (or executor caps), **rebalance drift thresholds** (`ε` / optional per-asset), optional **min trade notional**, optional pause
- [ ] **Rebalancer permission**: address or contract with **hard bounds** (fits **delegations** story)
- [ ] Tests (Foundry/Hardhat): deposits, withdraw, unauthorized paths, cap enforcement
- [x] **Testnet deploy path documented** — [`DEPLOY.md`](./DEPLOY.md) + `DeployConfigureDAOVault` (you still run `--broadcast` + paste addresses)
- [ ] At least one **real swap / rebalance path** demo on testnet (or mainnet if you accept risk) for Uniswap track credibility

---

## 4 — Off-chain agent & integrations

- [x] **Dry-run planner** — [`apps/agent`](../apps/agent/README.md) (`npm run plan`): RPC + [`config/rebalancing/bands.yaml`](../config/rebalancing/bands.yaml) + local targets JSON; prints skip / would_trade (no txs yet)
- [ ] **Vote ingestion**: signed payloads / bot commands / mini-app — source of truth = DB +/or chain, not chat alone
- [ ] **Aggregation**: weighted target portfolio (`trust × share` or MVP simplification)
- [ ] **Trust v0**: one benchmark, one update rule, logged per cycle (even if “manual cycle” for demo)
- [ ] **Execution worker**: compares current vs target weights, **applies band rules** (no micro-swaps), logs skips; builds swap plan, respects caps, submits txs (or proposes + human confirm until delegation is wired)
- [ ] **Uniswap API** (if targeting track): real **API key**, **real tx hashes**, no mocks on critical path
- [ ] **MetaMask Delegations** (if targeting track): delegation as **core pattern**, not decoration — link docs + demo flow

---

## 5 — Telegram (if shipping)

- [ ] Bot created; token only in **env**
- [ ] **Idempotent** handlers, basic `/status`, vote or deep-link flow
- [ ] Failure modes: downtime, duplicate messages, user correction path
- [ ] README: how a judge spins up bot (or use hosted demo instance)

---

## 6 — Demo & proofs

- [ ] **Deployed URL** and/or **recorded video** (2–5 min): problem → vote → rebalance (and ideally **one “below ε, no swap”** clip) → governance / thresholds visible
- [x] **Architecture / trust / limits** — partially covered in `docs/` (README still needed for judge quickstart)
- [ ] Explorer links for **key txs** in README or demo script

---

## 7 — Submission package

- [ ] **Public `repoURL`**
- [ ] **Draft project** via API: name, description, `problemStatement`, `trackUUIDs`, `conversationLog` (from `BUILD_LOG` + polish)
- [ ] **Moltbook** post + `moltbookPostURL`
- [ ] **Honest `submissionMetadata`**: `cursor`, `other`/framework truth, **Cursor Auto** for model, real **skills** / **tools** / **helpfulResources`
- [ ] **Self-custody** complete for everyone on team
- [ ] **Publish** + verify `GET /projects/:uuid` → `publish` and public listing

---

## 8 — Post-submit (before deadline)

- [ ] Small fixes only; no scope creep
- [ ] `BUILD_LOG.md` caught up through final push
