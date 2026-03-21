# Telegram bot (optional — not shipped for hackathon MVP)

**Status:** No runtime service in this repo yet. **Governance + agent** are the source of truth; chat is a **future UX layer** only.

## Config (prepared for later)

- **[`config/telegram/bot.yaml`](../../config/telegram/bot.yaml)** — transport (`polling` vs webhook), command names, idempotency window, rate limits.
- **Secrets:** `TELEGRAM_BOT_TOKEN` (and optional webhook URL) in **`.env` only** — never commit.

## Judge path

- **Today:** use the **Vite dashboard** ([`frontend/README.md`](../../frontend/README.md)) + **agent CLI** ([`apps/agent/README.md`](../agent/README.md)).
- **Later:** long-poll or webhook service under `apps/bot/` with idempotent handlers (see [`docs/BUILD_CHECKLIST.md`](../../docs/BUILD_CHECKLIST.md) historical §7).
