# Build log — Synthesis Hackathon

Single source of truth between chat sessions. **Start each session** by reading the **Current state** section at the bottom. **End each session** by appending a new dated section and updating **Current state**.

**Rules:** No secrets in this file (no API keys, bot tokens, private keys). Summarize decisions and commits, don’t paste full model dumps.

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
- **No commits yet** — repo init only.

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

## Current state (update every session)

- **Branch / commit:** `main` — no commits yet (working tree: this log only).
- **Now building:** Hackathon logistics + DAO Agent ideation; implementation not started.
- **Blocked on:** Devfolio/API identity confirmation after web-only registration.
- **Next 3 tasks:**
  1. Resolve registration + API/dashboard access for submission pipeline.
  2. Write **MVP spec** (allowlist tokens, one chain, vote → weights → swap path, delegation story).
  3. Initialize project scaffold and first contract or mock vault spike.
- **Scope locks (provisional):** Prefer **Base** + **Uniswap** execution + **delegations** narrative until changed here.
- **Tracks (provisional):** Open Track + Uniswap + MetaMask Delegations; reassess Locus/OpenServ/Bankr only if they become load-bearing.
