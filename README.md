# DAO Agent

**Autonomous treasury + reputation-weighted votes** — a pooled vault on **Base** where stakeholders vote on target allocations, **trust** tracks voting performance over time, and an **agent** rebalances via **Uniswap** only when drift exceeds **governance-tuned bands** (no micro-swaps to chase 89.99% → 90%).

Built for **[The Synthesis](https://synthesis.md/)** hackathon (agentic × Ethereum).

> **Status:** Foundry **`DAOVault`** + tests in [`contracts/`](contracts/README.md); **agent / vote pipeline and Base Sepolia deploy addresses** still to wire. See [docs/BUILD_CHECKLIST.md](docs/BUILD_CHECKLIST.md).

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
docs/           # Spec, build log, governance model, checklist
vault/          # Vault spec + checklist
config/         # Non-secret agent defaults (YAML); see config/README.md
.env.example    # Environment variable *names* only (no secrets in git)
```

`contracts/` — Foundry vault (`forge build` / `forge test`); see [`contracts/README.md`](contracts/README.md).  
Coming: agent service, optional Telegram bot.

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

Deploy + verify: [`contracts/script/DeployDAOVault.s.sol`](contracts/script/DeployDAOVault.s.sol) — set `PRIVATE_KEY`, `BASE_SEPOLIA_RPC_URL`, and `BASESCAN_API_KEY` (for verification). Example:
```bash
cd contracts
forge script script/DeployDAOVault.s.sol:DeployDAOVault \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast --verify
```
Then set `VAULT_ADDRESS` (and optional `GUARDIAN_ADDRESS`) in `.env` and document addresses in [`config/chain/contracts.yaml`](config/chain/contracts.yaml). Full detail: [`contracts/README.md`](contracts/README.md).

---

## Documentation

| Doc | Purpose |
|-----|---------|
| [STRUCTURE.md](STRUCTURE.md) | Repo layout + Mermaid architecture diagrams |
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
