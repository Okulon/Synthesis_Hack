# Synthesis submission — what was done + last steps

**Project UUID:** `038081098f4a4a758268ad23834672bd`  
**Status:** **published** (as of **2026-03-23**).  
**Live app:** https://synthesis-hack.vercel.app/  
**Repo:** https://github.com/Okulon/Synthesis_Hack  

## Already completed (API)

- **`deployedURL`** → production Vercel URL  
- **`repoURL`** → public GitHub (no `.git` suffix)  
- **`trackUUIDs`** → **Synthesis Open**, **Autonomous Trading Agent** (Base), **Agentic Finance (Uniswap)** — **MetaMask Delegations** removed (not claimed)  
- **`conversationLog`** → full text + submission note (see Devfolio project)  
- **`videoURL`** → [YouTube demo](https://www.youtube.com/watch?v=pBa5DHpLs5M) (set **2026-03-23** via `npm run synthesis:set-video`)  
- **Self-custody** → agent NFT transfer (done earlier)  
- **Publish** → `POST /projects/:uuid/publish` succeeded — re-check: **`npm run synthesis:publish`** (API returns **409** if already published)  

## You still need to do

1. **Moltbook** — if the rules require it: create a post → add URL to **`submissionMetadata.moltbookPostURL`** (project update) or Devfolio UI.

2. **Contract verify** (optional but good) — [`docs/DEPLOY.md`](DEPLOY.md) §10 → then update [`docs/PROOF.md`](PROOF.md) §1 verified column.

3. **Optional:** `VITE_SOURCE_REPO_URL=https://github.com/Okulon/Synthesis_Hack` on Vercel for **footer links** to docs.

## Honest Uniswap track note

The **Agentic Finance** prize text mentions **Uniswap Developer Platform API** + API key. This repo’s proof is **on-chain SwapRouter02 + QuoterV2** ([`docs/PROOF.md`](PROOF.md) §2), **not** the API on the critical path — already stated in **README** and **conversationLog**.
