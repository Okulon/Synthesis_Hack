# Build checklist — DAO Agent (Synthesis)

Use this as the **order of operations**. Check boxes as you go. Details live in [`PROJECT_SPEC.md`](./PROJECT_SPEC.md); session narrative in [`BUILD_LOG.md`](./BUILD_LOG.md).

---

## 0 — Hackathon & identity

- [ ] Confirm **Synthesis** account: email / Devfolio / Telegram follow-ups (`https://nsb.dev/synthesis-updates`)
- [ ] Obtain **`sk-synth-…`** (or documented web-only submission path) and **team UUID** when available
- [ ] `GET https://synthesis.devfolio.co/catalog` — save **track UUIDs** you will claim (refresh before submit)
- [ ] Wallet ready for **self-custody transfer** before publish (all team members — solo = you)

---

## 1 — Repo & hygiene

- [ ] Root **README**: problem, MVP demo steps, env vars (names only), links to docs
- [ ] `.gitignore` (node, forge, `.env`, keys, `out/`, `cache/`, etc.)
- [ ] **No secrets in git** — document `cp .env.example .env` pattern
- [ ] License file (if required by hackathon / your preference)
- [ ] First commits early (judges correlate timeline with `submissionMetadata` / GitHub stats)

---

## 2 — MVP freeze (before heavy code)

- [ ] One-paragraph **MVP** + diagram (vote → aggregate → execute within caps) — matches [`PROJECT_SPEC.md`](./PROJECT_SPEC.md) § MVP
- [ ] Lock **chain** (target: **Base** unless changed in `BUILD_LOG`)
- [ ] Lock **custody model** (vault contract vs smart account — document choice)
- [ ] Lock **2–3 allowlisted tokens** + one DEX path (**Uniswap**) for v0
- [ ] Lock **rebalance band defaults** (global `ε`, optional min-notional) — see [`PROJECT_SPEC.md`](./PROJECT_SPEC.md) §2.1
- [ ] Decide **Telegram** scope for hackathon (notify only vs structured vote capture + links to wallet flows)

---

## 3 — Smart contracts / on-chain

- [ ] Vault (or equivalent): **deposit / withdraw / share** accounting for MVP assumptions
- [ ] **Governance knobs** minimal set: allowlist, max slippage (or executor caps), **rebalance drift thresholds** (`ε` / optional per-asset), optional **min trade notional**, optional pause
- [ ] **Rebalancer permission**: address or contract with **hard bounds** (fits **delegations** story)
- [ ] Tests (Foundry/Hardhat): deposits, withdraw, unauthorized paths, cap enforcement
- [ ] **Testnet deploy** + verified contract addresses in README
- [ ] At least one **real swap / rebalance path** demo on testnet (or mainnet if you accept risk) for Uniswap track credibility

---

## 4 — Off-chain agent & integrations

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
- [ ] `docs/` or README: **architecture** (what runs where), **trust assumptions**, **known limitations**
- [ ] Explorer links for **key txs** in README or demo script

---

## 7 — Submission package

- [ ] **Public `repoURL`**
- [ ] **Draft project** via API: name, description, `problemStatement`, `trackUUIDs`, `conversationLog` (from `BUILD_LOG` + polish)
- [ ] **Moltbook** post + `moltbookPostURL`
- [ ] **Honest `submissionMetadata`**: `cursor`, `other`/framework truth, **Cursor Auto** for model, real **skills** / **tools** / **helpfulResources**
- [ ] **Self-custody** complete for everyone on team
- [ ] **Publish** + verify `GET /projects/:uuid` → `publish` and public listing

---

## 8 — Post-submit (before deadline)

- [ ] Small fixes only; no scope creep
- [ ] `BUILD_LOG.md` caught up through final push
