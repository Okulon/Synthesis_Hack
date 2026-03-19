# Configuration

YAML here holds **non-secret defaults** and structure. **Secrets** (`TELEGRAM_BOT_TOKEN`, `PRIVATE_KEY`, RPC keys, Uniswap API key) live in **`.env`** (see repo root `.env.example`).

## Layout

| Folder | Purpose |
|--------|---------|
| `agent/` | Worker loop, dry-run, execution limits |
| `chain/` | Chain metadata; contract addresses (or env placeholders) |
| `dex/` | Uniswap / routing defaults (governance can override on-chain) |
| `rebalancing/` | Drift bands (`ε`), min notional, metric choice |
| `governance/` | Quorum, timelock, caps — defaults until on-chain params exist |
| `trust/` | Benchmark, rolling window, score floors/ceilings |
| `telegram/` | Bot UX and transport (not secrets) |
| `integrations/` | External services (e.g. hackathon catalog URL) |
| `logging/` | Levels, structured fields |
| `security/` | Allowed chain IDs, env var names for keys (no values) |

## Overrides

Recommended load order (implement in code later):

1. `config/**/*.yaml` (defaults)
2. `config/local/**/*.yaml` (optional, gitignored — see `.gitignore` suggestion in README)
3. Environment variables (highest priority for addresses, RPC URLs, tokens)

`config/local/` is optional per-developer overrides; add `config/local/` to `.gitignore` when you create it.
