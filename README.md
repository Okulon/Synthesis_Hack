# DAO Agent

**Autonomous treasury + reputation-weighted votes** — a pooled vault on **Base** where stakeholders vote on target allocations, **trust** tracks voting performance over time, and an **agent** rebalances via **Uniswap** only when drift exceeds **governance-tuned bands** (no micro-swaps to chase 89.99% → 90%).

Built for **[The Synthesis](https://synthesis.md/)** hackathon (agentic × Ethereum).

> **Status:** Foundry **`DAOVault`** + tests; **[`docs/DEPLOY.md`](docs/DEPLOY.md)** (Base Sepolia **DeployConfigure** one-shot + configure-only script); **agent** [`plan` / `aggregate` / `trust` / `quote`](apps/agent/README.md) (dry-run). **You still:** broadcast deploy, paste **`VAULT_ADDRESS`**, add **real rebalance tx** + optional vote DB. See [docs/BUILD_CHECKLIST.md](docs/BUILD_CHECKLIST.md).

---

## Why it exists

| Pain | Direction |
|------|-----------|
| Crowds are noisy; dollar-votes don’t reward **track record** | Voting power blends **share** and **trust** |
| People want collective exposure without blind automation | **Governance** caps risk (allowlist, slippage, rebalance thresholds) |
| On-chain agents shouldn’t churn dust trades | **Band policy** — swap only above configurable **ε** / min notional ([spec §2.1](docs/PROJECT_SPEC.md#21--rebalance-bands-threshold-policy)) |

Full problem/solution and MVP scope: [**docs/PROJECT_SPEC.md**](docs/PROJECT_SPEC.md).

---

## Repository layout

```
contracts/      # Foundry: DAOVault + tests (see contracts/README.md)
apps/agent/     # Node: plan | aggregate | trust | quote (dry-run; see apps/agent/README.md)
docs/           # Spec, build log, governance model, checklist
vault/          # Vault spec + checklist
config/         # Non-secret agent defaults (YAML); see config/README.md
.env.example    # Environment variable *names* only (no secrets in git)
```

`contracts/` — Foundry vault (`forge build` / `forge test`); see [`contracts/README.md`](contracts/README.md).  
`apps/agent/` — [`apps/agent/README.md`](apps/agent/README.md). Optional Telegram bot later.

---

## Quick start (contributors)

1. Clone the repo **with submodules** (OpenZeppelin + `forge-std` live under `contracts/lib/`):
   ```bash
   git clone --recurse-submodules <URL>
   # or after a plain clone:
   git submodule update --init --recursive
   ```
2. Copy env template — **never commit real secrets**:
   ```bash
   cp .env.example .env
   ```
3. Fill in `.env` once you deploy contracts or run RPC (see comments inside `.env.example`).
4. Read [**config/README.md**](config/README.md) for how YAML and env vars combine.

### Commands

```bash
cd contracts && forge build && forge test
```

Dry-run rebalance planner (needs `CHAIN_RPC_URL`, `VAULT_ADDRESS` in `.env`):

```bash
cd apps/agent && npm install && npm run plan
```

Copy [`apps/agent/fixtures/targets.example.json`](apps/agent/fixtures/targets.example.json) to `config/local/targets.json` and set real token addresses.

**Deploy on Base Sepolia:** step-by-step [`docs/DEPLOY.md`](docs/DEPLOY.md) (recommended: `DeployConfigureDAOVault` one-shot). Then set `VAULT_ADDRESS` in `.env` and document addresses in [`config/chain/contracts.yaml`](config/chain/contracts.yaml). Contract commands: [`contracts/README.md`](contracts/README.md).

**New to this?** Follow the hand-holding guide: [**`docs/STEP_BY_STEP.md`**](docs/STEP_BY_STEP.md).

---

## Documentation

| Doc | Purpose |
|-----|---------|
| [STRUCTURE.md](STRUCTURE.md) | Repo layout + Mermaid architecture (links to `DEPLOY`, specs) |
| [apps/agent/README.md](apps/agent/README.md) | `plan` / `aggregate` / `trust` / `quote` (dry-run) |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Base Sepolia deploy + configure + agent wiring |
| [docs/STEP_BY_STEP.md](docs/STEP_BY_STEP.md) | **Start here** if you’re new: wallet, RPC, deploy, `npm run plan` |
| [vault/spec.md](vault/spec.md) | On-chain vault design (shares, redeem-to-one-asset, executor, pause) |
| [TRACKS.md](TRACKS.md) | Synthesis prize tracks we target + fit notes |
| [docs/PROJECT_SPEC.md](docs/PROJECT_SPEC.md) | MVP, rebalance bands, backlog |
| [docs/GOVERNANCE_VOTING.md](docs/GOVERNANCE_VOTING.md) | Parameter vs allocation votes, registry ideas |
| [docs/BUILD_LOG.md](docs/BUILD_LOG.md) | Chronological human ↔ agent work log |
| [docs/BUILD_CHECKLIST.md](docs/BUILD_CHECKLIST.md) | Ordered checklist toward submission |
| [docs/VAULT_ORACLE_AND_GOVERNANCE.md](docs/VAULT_ORACLE_AND_GOVERNANCE.md) | Oracle stack, roles, feed sunset / manual override |

---

## Intended sponsor alignment (provisional)

- **Synthesis Open Track**
- **Uniswap** — agentic finance, real API + txs where we claim the track
- **MetaMask** — **delegations** as the core “capped executor” story, if claimed

Refresh prize/track UUIDs via `GET https://synthesis.devfolio.co/catalog` before submitting.

---

## Disclaimer

This repository is an **experimental hackathon prototype**. It is **not** investment, legal, or security advice. Pooling assets and automated trading carry **total loss** risk. Do **not** use production keys or substantial funds without professional review.

---

## License

[MIT](LICENSE)
