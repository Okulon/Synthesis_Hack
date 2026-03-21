# Trust, ballots, and RPC (what the agent already does)

**Purpose:** Clarify the optional checklist item “sync on-chain ballots / vote-time marks” — most of it is **already wired** in **`npm run agent`**.

## During **voting** phase

- **`AGENT_STAMP_PRICES`** (default **on**): runs **`trust:stamp-prices`** so ballot rows get **`priceMarksUsdc`** from pool/oracle while votes are open. Tune **`AGENT_STAMP_INTERVAL_SEC`** to avoid hammering RPC.
- **`CHAIN_RPC_URL`** + **`VAULT_ADDRESS`** required.

## On **rollover** (closed window)

- **`AGENT_SYNC_ON_CHAIN_BALLOTS_BEFORE_TRUST`** (default **on**): merges **`AllocationBallotCast`** logs into **`vote-store.json`** via **`sync-allocation-ballots-from-chain.mjs`** (preserves existing price marks when merging).
- Then trust finalize / export as in [`apps/agent/README.md`](../apps/agent/README.md).

## If RPC is expensive

- Turn off **`AGENT_STAMP_PRICES`** or increase **`AGENT_STAMP_INTERVAL_SEC`** during long demos.
- **`AGENT_TRUST_ON_ROLLOVER=0`** disables the whole trust pipeline on rollover (not usually what you want for a trust demo).

**Related:** [`CYCLES_AND_VOTING.md`](CYCLES_AND_VOTING.md), [`apps/agent/src/agent.mjs`](../apps/agent/src/agent.mjs) header comment.
