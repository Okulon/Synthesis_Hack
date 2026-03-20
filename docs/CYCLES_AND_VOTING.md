# Cycles & allocation voting (implementation)

End-to-end model for **target-weight** votes keyed by cycle, with **trust × share** aggregation per [`PROJECT_SPEC.md`](./PROJECT_SPEC.md) §2.0.

## Wall-clock windows (agent-managed)

Default: **30 minutes** per allocation window (`duration_minutes: 30` in [`config/agent/cycles.yaml`](../config/agent/cycles.yaml)): **25 min voting**, **5 min frozen** (snapshot / export prep). This is **off-chain**; vault `cycleId` still only advances on `closeCycle`.

| Command | Purpose |
|---------|---------|
| `npm run cycle:clock-init` | Writes `config/local/cycle-clock.json` — pins **genesis** to start of current window |
| `npm run cycle:status` | JSON: live phase, window index, schedules |
| `npm run cycle:sync` | Creates/updates **current** window in `vote-store.json`, seeds ballots from previous/default cycle, sets `votingOpen` from phase, optional `onChainCycleId` from `VAULT_ADDRESS` |
| `npm run cycle:snapshot` | Share balances at block (frozen phase) |
| `npm run votes:export` | Embeds **`managedClock`** in `allocation-votes.json` for **live** Voting UI countdown |
| `npm run cycle:daemon` | **Loop**: auto `cycle:clock-init` if missing, then every **`CYCLE_DAEMON_INTERVAL_SEC`** (default 60): **`cycle:sync`** + **`votes:export`** (optional **`CYCLE_DAEMON_TRUST_EXPORT=1`**) |

After clone: `cycle:clock-init` → `cycle:sync` → edit ballots → (frozen) `cycle:snapshot` → `votes:export` — **or** run **`npm run cycle:daemon`** and edit `vote-store` while it runs.

## Artifacts

| File | Purpose |
|------|---------|
| `config/local/cycle-clock.json` | Genesis + durations (gitignored); created by **`cycle:clock-init`**. |
| `config/local/vote-store.json` | **Source of truth** for ballots (gitignored). Copy from [`apps/agent/fixtures/vote-store.example.json`](../apps/agent/fixtures/vote-store.example.json). |
| `config/local/votes.json` | **Legacy** single-file votes; used only if **no** `vote-store.json` exists. |
| `config/local/trust_cycle.csv` + `config/trust/scoring.yaml` | Trust multipliers (same as `npm run trust`). |
| `frontend/public/allocation-votes.json` | Dashboard **Voting** tab (`npm run votes:export`). |

## Cycle record (`vote-store`)

Each `cycles["<key>"]` entry has:

- **`onChainCycleId`** — should match `DAOVault.cycleId()` while this allocation applies (informative for the UI).
- **`votingOpen`** — whether you still accept new/edited ballots (off-chain convention).
- **`snapshotBlock`** + **`shares1e18`** — **snapshot** of vault **share** `balanceOf(voter)` at `snapshotBlock` (18 decimals string).
- **`ballots`** — one object per voter; **last ballot wins** if the same voter appears twice. **Weights** should sum to ~1 per voter.

## Aggregation formula

For each voter \(i\), power \(p_i = \mathrm{trust}_i \times \mathrm{shares}_i\) (shares as token units, not wei-normalized in math — we use \(10^{-18}\) float in JS). For asset \(a\):

\[
\text{score}_a = \sum_i p_i \cdot w_{i,a}
\]

Then **targets** \(_a = \text{score}_a / \sum_b \text{score}_b\).

If **`shares1e18`** is missing for a voter, aggregation falls back to **trust-only** (`p_i = \mathrm{trust}_i`) and records a **warning** (unless `AGGREGATE_STRICT_SHARES=1`, which errors).

## Operator flow

1. **Copy / edit** `config/local/vote-store.json` (add `cycles`, ballots, set `onChainCycleId`).
2. **Optional:** `npm run trust:export` so the dashboard shows the same trust as aggregation.
3. **Snapshot shares** at cutoff (requires RPC + deployed vault):
   ```bash
   cd apps/agent && npm run cycle:snapshot
   ```
   Env: `CHAIN_RPC_URL`, `VAULT_ADDRESS`, optional `VOTE_CYCLE_KEY`, `CYCLE_SNAPSHOT_BLOCK` (default: latest), `CYCLE_KEEP_VOTING_OPEN=1` to leave voting open.
4. **Aggregate** (inspect JSON):
   ```bash
   npm run aggregate
   ```
   Strict shares: `AGGREGATE_STRICT_SHARES=1 npm run aggregate`
5. **Export for UI:**
   ```bash
   npm run votes:export
   ```
6. Paste **`targets`** into `config/local/targets.json` for `npm run plan`.

## On-chain `cycleId`

`closeCycle` increments vault **`cycleId`** and emits **`CycleClosed`**. Voting / targets are **off-chain** in this MVP but should **track** that counter so operators know which NAV period a ballot set belongs to.

**Not automatic:** when a **wall-clock** window ends, **`cycle:sync`** / **`cycle:daemon`** only refresh **vote-store** / **`allocation-votes.json`**. They **do not** call **`rebalance`**, **`closeCycle`**, or write **aggregate targets** into the vault contract. **`castAllocationBallot`** emits **events** only — there is no on-chain “target weights” storage for the executor to read; use **logs**, **`npm run aggregate`**, and **`config/local/targets.json`** for **`plan`**. See [`BUILD_LOG.md`](./BUILD_LOG.md) **Current state**.

## Future

- EIP-712 signed ballots, indexer, or **Snapshot**.
- Enforce **snapshot inclusion**: only voters with `balanceOf > 0` at block may appear in `shares1e18`.
- Product **phase machine** (voting frozen → targets committed) in DB or contract.

See also [`GOVERNANCE_VOTING.md`](./GOVERNANCE_VOTING.md) (parameter votes vs allocation).
