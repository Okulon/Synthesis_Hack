# Step-by-step: from zero to “vault deployed + agent running”

You are **not** an idiot — this is just a lot of tools. Follow the steps **in order**. Skip nothing until you understand the previous step.

---

## What you’re doing (in one sentence)

You’re going to **deploy a smart contract** (the vault) to **Base Sepolia** (a free test network), then **point a small script** at that contract so it can **read balances** and **print a plan** (no trading yet unless you add more).

---

## 0 — Install these on your computer

| Tool | What it is | How to check |
|------|------------|----------------|
| **Git** | Downloads the repo | `git --version` |
| **Foundry** (`forge`) | Builds & deploys Solidity | `forge --version` — [install](https://book.getfoundry.sh/getting-started/installation) |
| **Node.js 20+** | Runs the agent scripts | `node --version` |

---

## 1 — Get a wallet ready (testnet only)

1. Use **MetaMask** (or any wallet) and create/import an account.
2. **Add Base Sepolia** to MetaMask:  
   - Chain ID **84532**,  
   - RPC URL from your provider (e.g. [Alchemy](https://www.alchemy.com/) / [Infura](https://infura.io/) — free tier is fine).  
   - Or use a public RPC (can be slower): e.g. `https://sepolia.base.org` (verify current URL in [Base docs](https://docs.base.org/)).
3. **Export the private key** of the account that will deploy (only for this hackathon test wallet — **not** your main wallet).  
   - In MetaMask: Account → … → Account details → Show private key.  
   - It’s a long hex string (often **without** `0x` in `.env` — if Forge errors, try **with** `0x`).

4. **Get Base Sepolia ETH** for gas (search “Base Sepolia faucet” — e.g. [Coinbase](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet) or [Alchemy](https://www.alchemy.com/faucets/base-sepolia) as available).  
   - Send **a little** to your deploy address. You need enough for **one deploy** (usually a small amount of test ETH).

---

## 2 — Get an RPC URL (required)

Your computer talks to Base Sepolia through an **RPC URL**.

**Easiest:** Sign up for **Alchemy** or **Infura**, create an app for **Base Sepolia**, copy the **HTTPS** URL.  
Put it in a file later as `BASE_SEPOLIA_RPC_URL` (same value can be `CHAIN_RPC_URL` for the agent).

---

## 3 — Download the project

```bash
cd ~/Documents   # or wherever you keep code
git clone --recurse-submodules <YOUR_REPO_URL>
cd Synthesis_Hack   # or your repo folder name
```

If you already cloned without submodules:

```bash
git submodule update --init --recursive
```

---

## 4 — Create `.env` (secrets stay on your machine)

```bash
cp .env.example .env
```

Open `.env` in editor. Set **at least**:

| Name | What to put |
|------|-------------|
| `PRIVATE_KEY` | Your **deployer** private key (one line, no quotes) |
| `BASE_SEPOLIA_RPC_URL` | The HTTPS RPC from step 2 |
| `CHAIN_RPC_URL` | **Same URL** as above (used by the agent) |
| `CHAIN_ID` | `84532` (Base Sepolia) |

**Optional:**

| Name | What to put |
|------|-------------|
| `BASESCAN_API_KEY` | From [Basescan](https://basescan.org/myapikey) — only if you want `--verify` to work |
| `GUARDIAN_ADDRESS` | Leave empty or `0x0000000000000000000000000000000000000000` if you skip guardian |

**Never commit `.env`** or paste your private key in Discord/GitHub.

---

## 5 — Prove the code builds

```bash
cd contracts
forge build
forge test
```

You should see tests pass (some fork test may **skip** — that’s OK).

---

## 6 — Deploy the vault (one command)

Still in **`contracts/`**:

```bash
forge script script/DeployConfigureDAOVault.s.sol:DeployConfigureDAOVault \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
  --broadcast
```

- If **`--verify`** fails (no API key or network issue), run **without** `--verify` first:

```bash
forge script script/DeployConfigureDAOVault.s.sol:DeployConfigureDAOVault \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
  --broadcast
```

**Read the terminal output.** Find a line like **`DAOVault: 0x...`** — that hex address is your vault.

---

## 7 — Save the vault address everywhere

1. Open `.env` in the **repo root** (not only `contracts/`).
2. Add:

```bash
VAULT_ADDRESS=0xYOUR_VAULT_ADDRESS_FROM_LOGS
CHAIN_ID=84532
```

3. Make sure `CHAIN_RPC_URL` is still set (same as RPC you used).

---

## 8 — Run the agent (dry-run, no trades)

```bash
cd ../apps/agent   # from repo root: apps/agent
npm install
```

**Targets** (what the vault “should” hold — demo numbers):

```bash
# from repo root
cp apps/agent/fixtures/targets.example.json config/local/targets.json
```

Edit `config/local/targets.json` and replace the **fake** `0x000…0001` addresses with **real token addresses** you care about:

- On Base Sepolia, the script already uses **USDC** and **WETH** from the project config — see [`config/chain/base_sepolia.yaml`](../config/chain/base_sepolia.yaml).  
- Put those two addresses under `"targets"` with weights that sum to **1** after the script normalizes (e.g. `0.5` and `0.5`).

Then:

```bash
npm run plan
```

You should get **JSON** with `would_trade` / `skip` per asset.

**Other useful commands:**

```bash
npm run aggregate   # if you copied votes.json — see apps/agent/README.md
npm run quote       # reads pool from Uniswap factory (needs CHAIN_RPC_URL)
```

---

## 9 — See the contract on the internet

Open **Base Sepolia** explorer (e.g. [sepolia.basescan.org](https://sepolia.basescan.org)), paste **`VAULT_ADDRESS`**, check the contract exists.

---

## 10 — Dashboard in the browser (optional)

Point the **React** UI at the same chain and vault:

```bash
cd frontend
cp .env.example .env.local
```

Edit **`frontend/.env.local`**: set **`VITE_RPC_URL`** (public HTTPS RPC for Base Sepolia) and **`VITE_VAULT_ADDRESS`** (same value as **`VAULT_ADDRESS`** in repo root). Optionally set **`VITE_ROLE_LOGS_FROM_BLOCK`**, **`VITE_HOLDER_LOGS_FROM_BLOCK`**, **`VITE_ALLOCATION_VOTE_LOGS_FROM_BLOCK`** to your vault **deploy block** (from Foundry **`broadcast/.../run-latest.json`**) if role / ballot logs are truncated. Then:

```bash
npm install
npm run dev
```

Open **http://localhost:1337** — connect a wallet on **Base Sepolia**.

- **Deposit:** normal path — WETH / USDC (approve + deposit) or **ETH** (wrap to WETH, then deposit).
- **TEST** (hackathon / QA): enter **ETH** → app wraps, swaps **WETH→USDC** via Uniswap v3, then **deposits USDC** into the vault. Uses **`amountOutMinimum: 0`** (unsafe outside testnets). Details: [`frontend/README.md`](../frontend/README.md).

---

## 11 — If something fails

| Symptom | Likely fix |
|--------|------------|
| `insufficient funds` | Get more Base Sepolia ETH from a faucet |
| `invalid private key` / RPC error | Check `PRIVATE_KEY` and RPC URL in `.env` |
| `forge` not found | Install Foundry (step 0) |
| `npm` errors | Use Node 20+, run `npm install` inside `apps/agent` |
| `plan` says wrong/missing | Check `VAULT_ADDRESS`, `CHAIN_ID=84532`, same RPC as deploy |
| `targets.json` wrong addresses | Use addresses from [`config/chain/base_sepolia.yaml`](../config/chain/base_sepolia.yaml) |
| Dashboard won’t connect | Same chain ID (**84532**), **`VITE_*`** vars set in `frontend/.env.local` |

---

## What’s *after* this (not required to finish the guide)

- **Send a real `rebalance` transaction** — needs executor key + `SwapStep` calldata (advanced).
- **Uniswap track** — usually want **one real tx proof** + API usage (see [`docs/BUILD_CHECKLIST.md`](./BUILD_CHECKLIST.md)).

---

## Same info, shorter path

- Technical detail: [`DEPLOY.md`](./DEPLOY.md)  
- Dashboard: [`frontend/README.md`](../frontend/README.md)  
- Current priorities: [`BUILD_LOG.md`](./BUILD_LOG.md) → **Current state**
