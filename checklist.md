# Hackathon checklist — Synthesis

**Tracks:** Open + Uniswap (agentic finance) + Base (Autonomous Trading Agent)

**How to use:** Tick boxes as you go (`[ ]` → `[x]` in your editor). **Done** = finished in repo or explicitly N/A. **To do** = remaining work.

| | Items | Status |
|--|------|--------|
| **Checked off** | 22 | see **Done** blocks below |
| **Still open** | 20 | see **To do** blocks below |

---

## A — Submission (Synthesis / Devfolio)

### Done

_(nothing yet)_

### To do

- [ ] Confirm **`sk-synth-…`**, **team UUID**, and submission path if anything is still TBD
- [ ] Refresh catalog: `GET https://synthesis.devfolio.co/catalog` — align **track UUIDs** (**Open + Uniswap + Base**)
- [ ] **Self-custody** for everyone on the team before **publish**
- [ ] **Public `repoURL`**
- [ ] Draft → **publish**; polish **`conversationLog`** / metadata from [`docs/BUILD_LOG.md`](docs/BUILD_LOG.md)
- [ ] **Moltbook** post + `moltbookPostURL`
- [ ] Honest **`submissionMetadata`** (tools, model, skills / resources)
- [ ] Final pass on [`docs/BUILD_LOG.md`](docs/BUILD_LOG.md) **Current state** vs what you ship

---

## B — Demo proof (what judges see)

### Done

- [x] **Where addresses go** — [`config/chain/contracts.yaml`](config/chain/contracts.yaml); [`docs/PROOF.md`](docs/PROOF.md) §1; [**README**](README.md#judge-facing-synthesis)
- [x] **Evidence index scaffold** — [`docs/PROOF.md`](docs/PROOF.md) (fill placeholders for txs / URL)
- [x] **README disclosures** — [**Judge-facing**](README.md#judge-facing-synthesis) + **Disclaimer**
- [x] **One reproducible cycle** — [**README — Reproducible demo cycle**](README.md#reproducible-demo-cycle)

### To do

- [ ] **Explorer links** in [`docs/PROOF.md`](docs/PROOF.md): **deposit**, ≥1 **`rebalance`**, optional **redeem**
- [ ] **Production** deployed URL on submission (not preview-only / login-gated)
- [ ] **Video** (2–5 min): problem → vote/aggregate → rebalance → (optional) “below ε, no swap”; **BaseScan** tabs

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

#### To do

- [ ] **Proof pack** — [`docs/PROOF.md`](docs/PROOF.md) §2: tx hashes for **`rebalance`** + user-path swap
- [ ] **Optional depth** — Permit2 or quote-API feeding agent *(skip unless time)*

### C3 — Base (Autonomous Trading Agent)

#### Done

- [x] **Autonomy** — [`apps/agent/README.md`](apps/agent/README.md) + [**README**](README.md#judge-facing-synthesis)
- [x] **Demo knobs** — labeled in README; repeat in **video**
- [x] **Risk bounds** — README + [`vault/spec.md`](vault/spec.md) §5 / §7

#### To do

- [ ] **Live outcomes proof** — **`CycleClosed`**, NAV, explorer links — [`docs/PROOF.md`](docs/PROOF.md); testnet liquidity caveat in video/README

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

### To do

- [ ] **Profits Tier B** — deposit/withdraw-adjusted P&L; optional Merkle *(large)*
- [ ] **On-chain risk knobs** — e.g. `maxSlippageBps` *(contract work)*
- [ ] **Contract verify** — [`docs/DEPLOY.md`](docs/DEPLOY.md) (`forge … --verify`)
- [ ] **Trust (optional)** — sync on-chain ballots during **voting** *(RPC-heavy)*
- [ ] **Telegram** — bot + README ([`docs/BUILD_CHECKLIST.md`](docs/BUILD_CHECKLIST.md) §7)

---

## E — Spec / docs

### Done

- [x] [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md) **§7** + [`docs/BAND_POLICY.md`](docs/BAND_POLICY.md) + BUILD_LOG
- [x] Vault P&L notes — [`vault/spec.md`](vault/spec.md) **§6.6** + oracle/solvency pointers

### To do

_(nothing)_

---

## F — Nice-to-have

### Done

- [x] Profits UI — **`testGainsRawSample1e18`** ([`ProfitsTab.tsx`](frontend/src/components/ProfitsTab.tsx))

### To do

- [ ] ENS, MCP, fork tests, Slither — if time

---

## Next up (priority)

1. Fill **[`docs/PROOF.md`](docs/PROOF.md)** — txs, deployed URL → clears **B**, **C2**, **C3** items above.
2. **Devfolio / publish** → clears **A**.
3. Optional: **D** — verify, Telegram, Tier B, on-chain knobs.
