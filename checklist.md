# Hackathon checklist — Synthesis

**Tracks:** Open + Uniswap (agentic finance) + Base (Autonomous Trading Agent)

**How to use:** Tick boxes as you go (`[ ]` → `[x]` in your editor). **Done** = finished in repo or explicitly N/A. **To do** = remaining work.

**About the open count:** The **17** unchecked rows are **not** 17 unrelated tasks. Several describe the **same** human work (e.g. filling **[`docs/PROOF.md`](docs/PROOF.md)** appears under **B**, **C2**, **C3**). **Three** rows are **optional backlog** (Tier B, on-chain knobs, ENS). See **[`docs/HUMAN_ONLY.md`](docs/HUMAN_ONLY.md)** for what’s **minimum** vs **optional**.

| | Items | Status |
|--|------|--------|
| **Checked off** | ~46 | see **Done** blocks below |
| **Still open** | ~8 | see **To do** blocks below |

---

## A — Submission (Synthesis / Devfolio)

### Done

- [x] **Submission metadata template** — [`docs/SUBMISSION_METADATA.md`](docs/SUBMISSION_METADATA.md) (tools, model, skills path, pitch — **paste into Devfolio**; set public repo URL there)
- [x] **Synthesis API** — `SYNTHESIS_API_KEY` in `.env`; project UUID `038081098f4a4a758268ad23834672bd`
- [x] **Catalog / tracks** — Open + Base + Uniswap agentic finance ([`docs/PROOF.md`](docs/PROOF.md) §7); **MetaMask** track removed on project (deferred)
- [x] **Self-custody** — completed before publish (**2026-03-23**)
- [x] **Public `repoURL`** — `https://github.com/Okulon/Synthesis_Hack`
- [x] **Draft → publish** + **`conversationLog`** — **published** **2026-03-23**; see [`docs/SUBMIT.md`](docs/SUBMIT.md)
- [x] **`deployedURL`** — https://synthesis-hack.vercel.app/
- [x] **`videoURL`** — [YouTube](https://www.youtube.com/watch?v=pBa5DHpLs5M) (`npm run synthesis:set-video`, **2026-03-23**)

### To do

- [ ] **Moltbook** post + `moltbookPostURL` — if rules require
- [ ] Final pass on [`docs/BUILD_LOG.md`](docs/BUILD_LOG.md) **Current state** vs ship (optional polish)

---

## B — Demo proof (what judges see)

### Done

- [x] **Where addresses go** — [`config/chain/contracts.yaml`](config/chain/contracts.yaml); [`docs/PROOF.md`](docs/PROOF.md) §1; [**README**](README.md#judge-facing-synthesis)
- [x] **Evidence index scaffold** — [`docs/PROOF.md`](docs/PROOF.md) (fill placeholders for txs / URL)
- [x] **README disclosures** — [**Judge-facing**](README.md#judge-facing-synthesis) + **Disclaimer**
- [x] **One reproducible cycle** — [**README — Reproducible demo cycle**](README.md#reproducible-demo-cycle)
- [x] **Dashboard judge links** — optional **`VITE_SOURCE_REPO_URL`** in [`frontend/.env.example`](frontend/.env.example) → footer links to **PROOF**, **BUILD_LOG**, **checklist**, [`HUMAN_ONLY.md`](docs/HUMAN_ONLY.md)

### Done (evidence)

- [x] **Explorer links** in [`docs/PROOF.md`](docs/PROOF.md): **deposit**, **`rebalance`**, optional **redeem**
- [x] **Production** URL — https://synthesis-hack.vercel.app/ (on submission)
- [x] **Video** — [YouTube](https://www.youtube.com/watch?v=pBa5DHpLs5M) (problem → Basescan txs per [`docs/DEMO_VIDEO.md`](docs/DEMO_VIDEO.md))

---

## C — Top three tracks

### C1 — Synthesis Open Track

#### Done

- [x] **One-page story** — [**README — Judge-facing**](README.md#judge-facing-synthesis) + [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md)
- [x] **Repo map** — [`STRUCTURE.md`](STRUCTURE.md) + [`docs/BUILD_LOG.md`](docs/BUILD_LOG.md) **Current state** + [`docs/PROOF.md`](docs/PROOF.md)
- [x] **No overclaim** — [`vault/spec.md`](vault/spec.md) **§6.6** + Tier A in README
- [x] **Innovation + impact** — [**README**](README.md#judge-facing-synthesis)

#### To do

_(nothing — C1 complete)_

### C2 — Uniswap (agentic finance)

#### Done

- [x] **Execution quality** — Quoter + slippage: **`rebalance`**, redeem, TEST ([`uniswapQuote.ts`](frontend/src/lib/uniswapQuote.ts))
- [x] **Explicit stack** — [**README — Uniswap stack**](README.md#judge-facing-synthesis)
- [x] **Uniswap API on critical path** — **N/A** (not claiming; router + Quoter only)
- [x] **Optional depth (Permit2 / quote API)** — **N/A** for this submit
- [x] **Proof pack** — [`docs/PROOF.md`](docs/PROOF.md) §2: **`rebalance`** + user-path swap hashes

### C3 — Base (Autonomous Trading Agent)

#### Done

- [x] **Autonomy** — [`apps/agent/README.md`](apps/agent/README.md) + [**README**](README.md#judge-facing-synthesis)
- [x] **Demo knobs** — labeled in README; repeat in **video**
- [x] **Risk bounds** — README + [`vault/spec.md`](vault/spec.md) §5 / §7
- [x] **Testnet / liquidity caveat text** — [`docs/PROOF.md`](docs/PROOF.md) §4 (edit if needed; say in **video** too)
- [x] **Live outcomes proof** — [`docs/PROOF.md`](docs/PROOF.md) §3–4 + [`frontend/public/cycle-profits.json`](frontend/public/cycle-profits.json)

### C4 — MetaMask Delegations

#### Done

- [x] **Decision: defer** — no load-bearing Delegation Framework; **omit** MetaMask track UUID unless you add it

#### To do

_(nothing)_

### C5 — Other sponsors

#### Done

- [x] **Locus** — **N/A** (not claiming)

#### To do

_(nothing)_

---

## D — Product gaps (backlog)

### Done

- [x] **Executor path** — `rebalance.mjs` + [`docs/BUILD_LOG.md`](docs/BUILD_LOG.md)
- [x] **Band policy** — [`docs/BAND_POLICY.md`](docs/BAND_POLICY.md)
- [x] **Single-asset exit** — [`redeemSwapSteps.ts`](frontend/src/lib/redeemSwapSteps.ts)
- [x] **Verify procedure in docs** — [`docs/DEPLOY.md`](docs/DEPLOY.md) §10 (`forge verify-contract` or Basescan UI; `BASESCAN_API_KEY` only in `.env`)
- [x] **Trust / ballot RPC** — [`docs/TRUST_RPC_AND_BALLOTS.md`](docs/TRUST_RPC_AND_BALLOTS.md) (`AGENT_STAMP_PRICES`, rollover sync — see [`apps/agent/README.md`](apps/agent/README.md))
- [x] **Telegram judge path** — [`apps/bot/README.md`](apps/bot/README.md) (stub; config [`config/telegram/bot.yaml`](config/telegram/bot.yaml); **dashboard** is primary UX)

### To do

- [ ] **Profits Tier B** — deposit/withdraw-adjusted P&L; optional Merkle *(large)*
- [ ] **On-chain risk knobs** — e.g. `maxSlippageBps` *(contract work)*
- [ ] **Run contract verify** on your deployment — follow [`docs/DEPLOY.md`](docs/DEPLOY.md) §10; mark **verified** in [`docs/PROOF.md`](docs/PROOF.md) §1

---

## E — Spec / docs

### Done

- [x] [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md) **§7** + [`docs/BAND_POLICY.md`](docs/BAND_POLICY.md) + BUILD_LOG
- [x] Vault P&L notes — [`vault/spec.md`](vault/spec.md) **§6.6** + oracle/solvency pointers
- [x] **Docs map** — [`STRUCTURE.md`](STRUCTURE.md) + [`docs/BUILD_CHECKLIST.md`](docs/BUILD_CHECKLIST.md) points at **`checklist.md`**; [`TRACKS.md`](TRACKS.md) aligned with shipped stack
- [x] **Human-only close-out** — [`docs/HUMAN_ONLY.md`](docs/HUMAN_ONLY.md) (what you must do after automation)

### To do

_(nothing)_

---

## F — Nice-to-have

### Done

- [x] Profits UI — **`testGainsRawSample1e18`** ([`ProfitsTab.tsx`](frontend/src/components/ProfitsTab.tsx))
- [x] **Fork test (optional)** — [`contracts/test/UniswapBaseFork.t.sol`](contracts/test/UniswapBaseFork.t.sol); [`contracts/README.md`](contracts/README.md)
- [x] **Slither (optional)** — one-liner in [`contracts/README.md`](contracts/README.md) (not CI-gated)
- [x] **`npm run proof:hints`** — [`scripts/print-broadcast-hints.mjs`](../scripts/print-broadcast-hints.mjs) (local `run-latest.json` → PROOF §1 hints)

### To do

- [ ] **ENS** / **MCP** polish — if time

---

## Next up (priority)

1. **Moltbook** — only if hackathon rules require it ([`docs/SUBMIT.md`](docs/SUBMIT.md)).
2. Optional: **`forge verify`** ([`docs/DEPLOY.md`](docs/DEPLOY.md) §10), **`VITE_SOURCE_REPO_URL`** on Vercel, **BUILD_LOG** polish, **D6** plan-skip capture, **Tier B** / backlog in §D–F.
