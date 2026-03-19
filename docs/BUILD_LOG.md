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

## Current state (update every session)

- **Branch / commit:** `main` @ `a2710d8` locally; **pending commit** adds README, STRUCTURE, `vault/spec.md`, PROJECT_SPEC (§2.2 + backlog), BUILD_CHECKLIST/LOG.
- **Now building:** **Design complete** for vault + cycle P&L/trust profit path; **implementation** (contracts) not started.
- **Blocked on:** Devfolio/API identity (`sk-synth-…`) for submit automation only.
- **Next 3 tasks:**
  1. **Commit & push** current docs + vault spec.
  2. **Foundry** project + first vault contracts + tests + Base Sepolia deploy notes.
  3. Confirm **Synthesis** account + cache **track UUIDs** from `/catalog`.
- **Scope locks (provisional):** **Base** + **Uniswap** + **delegations** narrative; rebalance bands in config; **Tier A** profit split bias unless upgraded.
- **Tracks (provisional):** Open Track + Uniswap + MetaMask Delegations.
