# Agent Skills

Execution playbooks for concrete agent tasks.

Each skill should define:
- objective
- required inputs
- execution steps
- success criteria
- failure handling

Current skills:
- `rebalancing/SKILL.md` — run aggregate/plan/quote and prepare a rebalance-ready output package.
- `execution/SKILL.md` — build `SwapStep[]`, preflight, broadcast `rebalance`, record tx evidence.
