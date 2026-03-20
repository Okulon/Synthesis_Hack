# Cycles & allocation voting (implementation)

End-to-end model for **target-weight** votes keyed by cycle, with **trust × share** aggregation per [`PROJECT_SPEC.md`](./PROJECT_SPEC.md) §2.0.

## Wall-clock windows (agent-managed)

Default in repo: **15 minutes** per allocation window ([`config/agent/cycles.yaml`](../config/agent/cycles.yaml)): **12 min voting**, **3 min frozen** (snapshot / export prep). Adjust `duration_minutes` / voting+frozen there; the next **`cycle:sync`** (or **`npm run agent`**) re-pins genesis if the clock file is missing or invalid. This is **off-chain**; vault `cycleId` still only advances on `closeCycle`.

| Command | Purpose |
|---------|---------|
| `npm run cycle:clock-init` | Same as auto-init inside **`cycle:sync`**: writes `config/local/cycle-clock.json` — pins **genesis** to start of current window (manual/CI only; **`npm run agent`** does not require this first) |
| `npm run cycle:status` | JSON: live phase, window index, schedules |
| `npm run cycle:sync` | Creates/updates **current** window in `vote-store.json`, seeds ballots from previous/default cycle, sets `votingOpen` from phase, optional `onChainCycleId` from `VAULT_ADDRESS` |
| `npm run cycle:snapshot` | Share balances at block (frozen phase) |
| `npm run votes:export` | Embeds **`managedClock`** in `allocation-votes.json` for **live** Voting UI countdown |
| `npm run cycle:daemon` | **Loop**: every **`CYCLE_DAEMON_INTERVAL_SEC`** (default 60): **`cycle:sync`** (auto-inits clock if needed) + **`votes:export`** (optional **`CYCLE_DAEMON_TRUST_EXPORT=1`**) |
| **`npm run agent`** (repo root) | **Recommended:** one process — sync, stamp prices (voting), **`aggregate` → `targets.json`**, votes export, trust finalize on rollover, and (if **`GOVERNANCE_PRIVATE_KEY`** is set) **`closeCycle`** so on-chain **`cycleId`** matches wall-clock boundaries (`AGENT_CLOSE_CYCLE_ON_ROLLOVER`, default on when key present). Optional **`AGENT_AUTO_REBALANCE=1`**. See [`apps/agent/src/agent.mjs`](../apps/agent/src/agent.mjs). |
| `npm run close-cycle` | One-shot **`DAOVault.closeCycle(navStart, navEnd)`** (same NAV bookkeeping as agent). |

After clone: **`npm run agent`** from repo root (or `cycle:daemon` for sync+export only); wall-clock + `vote-store` alignment run automatically. Optional manual **`cycle:clock-init`** only if you want to pin genesis without running **`cycle:sync`**.

### Display vs execution targets

- **`frontend/public/allocation-votes.json`** (`targets` field): full trust×share aggregate of ballot weights — always reflects the **overall voted blend** for the dashboard. **Not** gated by allocation quorum.
- **`config/local/targets.json`**: **only** file read by **`npm run plan`** and **`rebalance`**. The agent writes it when aggregate succeeds **and** (by default) **[`check-quorum-for-targets`](../apps/agent/src/check-quorum-for-targets.mjs)** reports quorum met (`AGENT_REQUIRE_QUORUM_FOR_TARGETS`, default on). If quorum is **not** met, this file is **not** overwritten — execution keeps using the **previous** targets until participation is sufficient.

## Artifacts

| File | Purpose |
|------|---------|
| `config/local/cycle-clock.json` | **Genesis unix only** (gitignored). Window length / voting / frozen come from **`config/agent/cycles.yaml`** only. Created on first **`cycle:sync`** / **`npm run agent`** (or **`cycle:clock-init`**). |
| `config/local/vote-store.json` | **Source of truth** for ballots (often gitignored). If missing, `cycle:sync` copies an **empty** template from [`apps/agent/fixtures/vote-store.example.json`](../apps/agent/fixtures/vote-store.example.json) — no demo voters; ballots come from the UI / `castAllocationBallot`. |
| `config/local/votes.json` | **Legacy** single-file votes; used only if **no** `vote-store.json` exists. |
| `config/local/trust_cycle.csv` + `config/trust/scoring.yaml` | Trust multipliers (same as `npm run trust`). |
| `frontend/public/allocation-votes.json` | Dashboard **Voting** tab (`npm run votes:export`). Includes aggregate **`targets`** for display (not quorum-gated). |
| `config/local/targets.json` | **`plan` / rebalance** input only (gitignored). Quorum-gated when agent writes (see **Display vs execution targets** above). |

## Cycle record (`vote-store`)

Each `cycles["<key>"]` entry has:

- **`onChainCycleId`** — should match `DAOVault.cycleId()` while this allocation applies (informative for the UI).
- **`votingOpen`** — whether you still accept new/edited ballots (off-chain convention).
- **`snapshotBlock`** + **`shares1e18`** — **snapshot** of vault **share** `balanceOf(voter)` at `snapshotBlock` (18 decimals string).
- **`ballots`** — one object per voter; **last ballot wins** if the same voter appears twice. **Weights** should sum to ~1 per voter.
  - **`priceMarksUsdc`** (optional) — per asset, **USDC per 1 full token** at vote time, lowercase keys. Filled by **`npm run trust:stamp-prices`** (live Uniswap v3 mid) or manually. Needed for portfolio-based trust (below).
  - **`priceMarksCapturedAt`** — ISO timestamp when marks were written.

## Trust from portfolio performance (time-weighted)

For each voter’s **last ballot** in a **completed** wall-clock window:

1. **Basket return** (decimal): \(\sum_a w_a \bigl(\frac{P^{\mathrm{end}}_a}{P^{\mathrm{vote}}_a} - 1\bigr)\) using `priceMarksUsdc` as \(P^{\mathrm{vote}}\) and **fresh** pool mids at finalize as \(P^{\mathrm{end}}\) (USDC quote, same tokens as weights).
2. **Time weight** (fraction of window still *after* the vote, in \([0,1]\)):  
   \(\displaystyle \frac{t_{\mathrm{end}} - t_{\mathrm{vote}}}{t_{\mathrm{end}} - t_{\mathrm{start}}}\)  
   with \(t_{\mathrm{vote}}\) from **`submittedAt`** (ISO), clamped to \([t_{\mathrm{start}}, t_{\mathrm{end}}]\).  
   Example: vote at the midpoint → weight **0.5**; vote at window end → **0**; vote at start → **1**.
3. **Effective return** = basket return × time weight → stored as **`vote_return_bps`** in `trust_cycle.csv` (`round(effective * 10000)`).

Commands (from `apps/agent`, needs `CHAIN_RPC_URL`):

| Command | When |
|--------|------|
| `npm run trust:stamp-prices` | After votes / edits — writes **`priceMarksUsdc`** on ballots (optional `VOTE_CYCLE_KEY`, `TRUST_STAMP_OVERWRITE=1`). |
| `npm run trust:finalize-window` | After the window ends — defaults to **`managed.index - 1`**; upserts `config/local/trust_cycle.csv`; set **`TRUST_FINALIZE_CYCLE_KEY`** to override. |

Then set `config/trust/scoring.yaml` **`update_rule: time_weighted_portfolio_return`** and run **`npm run trust`** + **`npm run trust:export`**.  
Trust multiplier update: `trust *= 1 + portfolio_trust.linear_scale * (vote_return_bps / 10000)` (then floor/ceiling).  
**`benchmark_return_bps`** in the CSV is the **full-window** basket return (no time scaling), for your own analysis or future rules.

**Caveats:** prices are **Uniswap v3 mid** (one hop to USDC, tier sweep); thin pools = noisy marks. No historical oracle at past `submittedAt` unless you stamped at vote time.

## Aggregation formula

For each voter \(i\), power \(p_i = \mathrm{trust}_i \times \mathrm{shares}_i\) (shares as token units, not wei-normalized in math — we use \(10^{-18}\) float in JS). For asset \(a\):

\[
\text{score}_a = \sum_i p_i \cdot w_{i,a}
\]

Then **targets** \(_a = \text{score}_a / \sum_b \text{score}_b\).

If **`shares1e18`** is missing for a voter, aggregation falls back to **trust-only** (`p_i = \mathrm{trust}_i`) and records a **warning** (unless `AGGREGATE_STRICT_SHARES=1`, which errors).

## Operator flow

1. **Copy / edit** `config/local/vote-store.json` (add `cycles`, ballots, set `onChainCycleId`).
2. **Optional (portfolio trust):** during voting, after ballots are set, `cd apps/agent && npm run trust:stamp-prices` (needs RPC). When the window is over, `npm run trust:finalize-window`, then set **`update_rule: time_weighted_portfolio_return`** in `config/trust/scoring.yaml` and run **`npm run trust`** + **`npm run trust:export`**. For **manual / benchmark CSV** trust only, skip stamping and run **`npm run trust:export`** after editing `trust_cycle.csv`.
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
