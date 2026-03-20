# Synthesis Project Draft Payload

```json
{
  "teamUUID": "10c5a860a09d473197a78c46578d8ac7",
  "name": "VaultDao — Governance-Bounded Treasury Agent",
  "description": "VaultDao is an autonomous DAO treasury system on Base Sepolia where members deposit into a pooled vault, vote on target allocations, and an agent executes bounded rebalances via Uniswap. The system emphasizes governance guardrails (allowlists, thresholds, caps), transparent on-chain actions, and a clear human-agent collaboration trail from planning to implementation.",
  "problemStatement": "Individuals and small groups struggle to manage shared treasury capital consistently: manual rebalancing is time-consuming, pure token-weight voting ignores voting quality over time, and unconstrained automation is risky. VaultDao addresses this by combining pooled treasury management, governance-defined risk boundaries, and agentic execution that acts only within explicit constraints.",
  "repoURL": "https://github.com/Okulon/Synthesis_Hack.git",
  "trackUUIDs": [
    "020214c160fc43339dd9833733791e6b",
    "0d69d56a8a084ac5b7dbe0dc1da73e1d",
    "fdb76d08812b43f6a5f454744b66f590",
    "bf374c2134344629aaadb5d6e639e840"
  ],
  "conversationLog": "Project built iteratively in a human-agent workflow documented in docs/BUILD_LOG.md. Core milestones include: MVP scope and governance model; DAOVault + tests (including ballotAssets-indexed castAllocationBallot); Base Sepolia deploy/configure; agent modules (plan, aggregate, trust, quote, executor rebalance); frontend dashboard (deposits, voting with on-chain ballots + pie charts, legacy-vault fallback, aggregate targets from events); env and docs hygiene without committing secrets. Latest session notes: wall-clock cycle end does not auto-rebalance; closeCycle does not store aggregate targets on-chain. Scope: Base + Uniswap + delegation-style bounded execution narrative.",
  "submissionMetadata": {
    "agentFramework": "other",
    "agentFrameworkOther": "custom Foundry + Node.js agent modules + Vite React frontend",
    "agentHarness": "cursor",
    "model": "auto (Cursor automatic model selection)",
    "skills": [
      "custom-repo-workflow"
    ],
    "tools": [
      "Foundry",
      "Solidity",
      "Node.js",
      "TypeScript",
      "Vite",
      "React",
      "viem",
      "wagmi",
      "Uniswap",
      "Base Sepolia"
    ],
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
