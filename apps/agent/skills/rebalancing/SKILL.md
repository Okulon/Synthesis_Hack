# Rebalancing Skill

## Objective

Generate a deterministic rebalance package from current vault state and cycle targets:
- trust-weighted target allocation
- drift analysis with band policy
- optional market sanity quote
- action recommendation (`execute` or `hold`)

## Preconditions

- Repo root has `.env` with:
  - `CHAIN_RPC_URL`
  - `CHAIN_ID` (optional; defaults to `84532`)
  - `VAULT_ADDRESS`
- Local files exist:
  - `config/local/targets.json`
  - `config/local/votes.json` (if using `aggregate`)
- Dependencies installed: `cd apps/agent && npm install`

## Inputs

- `cycleId` (string/int; operator label)
- `targetSource` (`manual` or `aggregate`)
- `poolFee` (optional; default `3000`)

## Execution

1. **Build targets**
   - If `targetSource=aggregate`:
     - `npm run aggregate`
     - copy produced target weights into `config/local/targets.json`
   - If `targetSource=manual`:
     - verify `config/local/targets.json` totals 1.0 and symbols are allowlisted.

2. **Plan drift**
   - Policy lives in `config/rebalancing/bands.yaml`: **`global_epsilon_pp`** = minimum weight drift (percentage points) before a trade; optional **`min_trade_notional_quote`** dollar floor (set `0` for %‑only).
   - Run `npm run plan`.
   - Capture output rows:
     - `current_weight`
     - `target_weight`
     - `drift`
     - `decision` (`would_trade` or `skip`)

3. **Quote sanity (optional but recommended)**
   - Run:
     - `POOL_FEE=<fee> npm run quote`
   - Validate pool exists and liquidity is non-trivial.

4. **Decision**
   - `execute` when at least one asset is out-of-band and quote sanity is valid.
   - `hold` when all assets are in-band or quote sanity fails.

## Expected Outputs

- `targets` snapshot used for this run
- `plan` output JSON and timestamp
- `quote` output JSON and timestamp (if run)
- recommendation:
  - `execute` with list of candidate swaps
  - `hold` with reason

## Failure Handling

- Missing env/file -> stop and report exact missing key/path.
- RPC unavailable -> retry with fallback RPC before failing.
- Quote pool missing/illiquid -> return `hold` with reason `quote_unavailable`.
- Invalid targets (sum != 1 or unknown assets) -> fail fast, no execute recommendation.

## Notes

- This skill is read-only through `plan`/`quote`. On-chain `rebalance` broadcast is covered in [`execution/SKILL.md`](../execution/SKILL.md).
