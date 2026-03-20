# Configuration

YAML here holds **non-secret defaults** and structure. **Secrets** (`TELEGRAM_BOT_TOKEN`, `PRIVATE_KEY`, RPC keys, Uniswap API key) live in **`.env`** (see repo root `.env.example`).

## Layout

| Folder | Purpose |
|--------|---------|
| `agent/` | Worker loop, dry-run, execution limits |
| `chain/` | Chain metadata; [`base.yaml`](chain/base.yaml) / [`base_sepolia.yaml`](chain/base_sepolia.yaml) (Uniswap + token hints); env placeholders in [`contracts.yaml`](chain/contracts.yaml) |
| `dex/` | Uniswap / routing defaults (governance can override on-chain) |
| `rebalancing/` | Drift bands (`ε`), min notional, metric choice |
| `governance/` | Quorum, timelock, caps — defaults until on-chain params exist |
| `trust/` | Benchmark, rolling window, score floors/ceilings |
| `telegram/` | Bot UX and transport (not secrets) |
| `integrations/` | External services (e.g. hackathon catalog URL) |
| `logging/` | Levels, structured fields |
| `security/` | Allowed chain IDs, env var names for keys (no values) |

## Overrides

Recommended load order (agent implements **1 + 3** today; **2** optional):

1. `config/**/*.yaml` (defaults)
2. `config/local/**` — `targets.json`, **`vote-store.json`** (cycle ballots + share snapshot), `votes.json` (legacy), `trust_cycle.csv` (gitignored; see [`docs/DEPLOY.md`](../docs/DEPLOY.md), [`docs/CYCLES_AND_VOTING.md`](../docs/CYCLES_AND_VOTING.md))
3. Environment variables (highest priority for addresses, RPC URLs, tokens)

`config/local/` is optional per-developer overrides; add `config/local/` to `.gitignore` when you create it.

## See also

- [`frontend/README.md`](../frontend/README.md) — browser dashboard uses **`VITE_*`** env vars (not this YAML tree); token/router addresses align with `config/chain/base_sepolia.yaml` for Base Sepolia.
