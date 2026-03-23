# Synthesis project — published payload (reference)

**Status:** **published** (2026-03-23). **Do not treat as a draft to POST again** unless updating fields via API or Devfolio UI.

**Project UUID:** `038081098f4a4a758268ad23834672bd`  
**Slug:** `vaultdao-governance-bounded-treasury-agent-9164`  

```json
{
  "teamUUID": "10c5a860a09d473197a78c46578d8ac7",
  "name": "VaultDao — Governance-Bounded Treasury Agent",
  "description": "VaultDao is an autonomous DAO treasury system on Base Sepolia where members deposit into a pooled vault, vote on target allocations, and an agent executes bounded rebalances via Uniswap. The system emphasizes governance guardrails (allowlists, thresholds, caps), transparent on-chain actions, and a clear human-agent collaboration trail from planning to implementation.",
  "problemStatement": "Individuals and small groups struggle to manage shared treasury capital consistently: manual rebalancing is time-consuming, pure token-weight voting ignores voting quality over time, and unconstrained automation is risky. VaultDao addresses this by combining pooled treasury management, governance-defined risk boundaries, and agentic execution that acts only within explicit constraints.",
  "repoURL": "https://github.com/Okulon/Synthesis_Hack",
  "deployedURL": "https://synthesis-hack.vercel.app/",
  "videoURL": "https://www.youtube.com/watch?v=pBa5DHpLs5M",
  "trackUUIDs": [
    "fdb76d08812b43f6a5f454744b66f590",
    "bf374c2134344629aaadb5d6e639e840",
    "020214c160fc43339dd9833733791e6b"
  ],
  "conversationLog": "See live project on Devfolio / Synthesis — full text stored server-side (restored Mar 2026). Pointer: docs/BUILD_LOG.md. Submission note: demo video recorded; proof in docs/PROOF.md; Uniswap path = SwapRouter02 + QuoterV2, not Uniswap Developer Platform API on critical path.",
  "submissionMetadata": {
    "agentFramework": "other",
    "agentFrameworkOther": "custom Foundry + Node.js agent modules + Vite React frontend",
    "agentHarness": "cursor",
    "model": "auto (Cursor automatic model selection)",
    "skills": ["custom-repo-workflow"],
    "tools": ["Foundry", "Solidity", "Node.js", "TypeScript", "Vite", "React", "viem", "wagmi", "Uniswap", "Base Sepolia"],
    "helpfulResources": [
      "https://synthesis.devfolio.co/catalog",
      "https://synthesis.md/submission/skill.md",
      "https://synthesis.devfolio.co/catalog/prizes.md"
    ],
    "helpfulSkills": [
      {
        "name": "custom-repo-workflow",
        "reason": "Kept project execution tightly aligned to the repository build checklist and progress log."
      }
    ],
    "intention": "continuing",
    "intentionNotes": "Continue from hackathon MVP to production-ready execution safeguards, fuller rebalance transaction flow, and stronger governance/delegation enforcement."
  }
}
```

**Tracks on project:** Synthesis Open, Autonomous Trading Agent, Agentic Finance (Uniswap). **MetaMask** track was **removed** (not claimed).

**`videoURL`:** [YouTube](https://www.youtube.com/watch?v=pBa5DHpLs5M) — set via [`docs/SUBMIT.md`](docs/SUBMIT.md) `npm run synthesis:set-video`.
