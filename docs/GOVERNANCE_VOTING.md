# Governance voting — parameters & process

How holders change **rules** (allowlisted tokens, venues, chains, risk caps) vs how they change **allocation** (monthly portfolio targets). Allocation voting is already in [`PROJECT_SPEC.md`](./PROJECT_SPEC.md); this doc focuses on **governance** of the system.

---

## 1 — Two different vote streams

| Stream | Question | Frequency | Typical power |
|--------|----------|-----------|----------------|
| **Allocation vote** | “What target weights for *this* cycle?” | Every cycle (e.g. monthly) | `trust × share` among voters |
| **Parameter / governance vote** | “Should we allow token X? Add DEX Y? Change ε?” | Ad hoc or scheduled | Same formula *or* different (see §5) |

Keep them **separate in the product** so users don’t confuse “I voted my portfolio” with “I voted to change the rules.”

---

## 2 — What is “governable” (parameter registry)

Treat settings as a **registry** — each key has type, bounds, and (on-chain) enforcement.

**Likely keys (examples):**

| Category | Examples | Notes |
|----------|----------|--------|
| **Tokens** | Allowlisted ERC-20 addresses, per-token max weight | Must match what vault/oracle supports |
| **Venues / DEX** | `uniswap_v3_base`, router address, fee tiers | MVP: **one** DEX; adding another = new executor paths + audits story |
| **Chains** | `allowed_chain_ids` | **Heavy:** bridges, custody, oracles. For hackathon, **ship Base-only**; multi-chain is “governance intent” in README, not flippable in two clicks |
| **Risk** | Max slippage bps, global/per-asset `ε`, min trade notional, pause | Aligns with [`config/rebalancing/bands.yaml`](../config/rebalancing/bands.yaml) after execution |
| **Process** | Cycle length, quorum, timelock | Usually constrained by contract immutables + safety |

**Reality:** Not every knob needs to be **on-chain** on day one. What **must** be on-chain: whatever the **executor** must not be able to bypass (allowlist, max slippage, caps). What can start **off-chain + multisig or admin**: exploratory lists until you harden.

---

## 3 — Ways to implement governance (choose per maturity)

### A — Fully on-chain (OpenZeppelin Governor style)

- Propose → vote with **voting power** (e.g. vault shares × trust snapshot) → timelock → **execute** `setAllowlist`, `setMaxSlippage`, etc.
- **Pros:** Trustless, best demo for “DAO controls the agent.”
- **Cons:** Most solidity + indexing work; trust or snapshot correctness must be defined on-chain.

### B — Snapshot (or similar) + trusted executor

- Votes signed off-chain; outcome pushed on-chain by **relayer** or **multisig** you control for MVP.
- **Pros:** Fast to ship; good UX.
- **Cons:** Not fully trust-minimized until relayer is replaced by contract logic.

### C — Hackathon MVP: “Governance lite”

- **Parameters** stored on a **minimal governance contract** or **single Params contract** updated only by **`onlyGovernance`** role.
- **Voting** for the hackathon: **signed votes** aggregated off-chain + one **execute** tx from a **timelocked admin** or small multisig that mirrors vote outcome — **documented honestly** as staged trustlessness.
- **Alternative:** Parameter votes only via **same Telegram/mini-app** as allocation, but **typed payloads** (`type: SET_ALLOWLIST`, `payload: {...}`) committed in DB and reflected on-chain once threshold passes.

Pick **one** path for the demo; describe the **north star** (A) in README.

---

## 4 — Recommended path for your hackathon

1. **Single chain (Base)** and **single DEX (Uniswap)** in code; don’t make “switch chain” a one-click vote without bridge work — instead governance can vote to **freeze deposits** and **publish a migration plan** (post-MVP).
2. **Token allowlist** and **risk caps** are the **first-class** governable set — they directly affect user safety and agent behavior.
3. **DEX list:** MVP = one venue; a vote to “add Curve” means new integration work — model as **proposal with technical description** + **timelock**, not just a string toggle unless you build plug-in routers.
4. **Rebalance `ε` and min-notional:** great **governance candidates** — numeric, easy to reason, matches your product story.
5. **Voting power for parameter votes:** start with **`share`-only** or **`trust × share` same as allocation**; splitting rules (e.g. cap trust for param votes) is optional complexity (`PROJECT_SPEC` §5 optional note).

---

## 5 — UX flow (product shape)

1. **Create proposal** — human-readable title + machine payload (JSON or contract calldata hash).
2. **Discussion window** (optional, off-chain).
3. **Voting window** — wallet- or share-weighted; snapshot block for `trust` and `share`.
4. **Timelock** — README: “users can exit if they disagree.”
5. **Execute** — updates registry on-chain; **agent** reads new params before next rebalance; event log for indexers.

Telegram can **notify** and collect **links** to a **web vote** or **signature** flow; avoid making Telegram the **sole** authority for governance outcomes (same as allocation).

---

## 6 — Executor alignment (MetaMask delegations narrative)

Whatever governance sets (allowlist, slippage, DEX router allowlist), the **delegation / executor permission** should be **unable** to act outside those bounds. That way “DAO voted” and “agent acted” stay consistent for judges.

---

## 7 — Config vs on-chain

- [`config/`](../config/) holds **defaults** and dev overrides.
- **Authoritative production state** for a live DAO should move to **chain + optional subgraph** as you harden.
- Agent startup: **merge** on-chain params over file defaults (chain wins).

---

## 8 — Open decisions (track in `BUILD_LOG`)

- [ ] Governor contract vs minimal `Params` + `onlyRole(GOVERNANCE)`
- [ ] Snapshot block definition when `trust` updates mid-vote
- [ ] Whether parameter votes require **higher quorum** than allocation votes
- [ ] Exact encoding for “add token” proposals (address + oracle feed + decimals?)
