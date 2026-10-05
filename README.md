# PayPilot

**An AI purchasing agent powered by PayPal.**

PayPilot helps a user describe what they want to buy, evaluates available options, applies the user's spending rules, and uses PayPal for controlled checkout.

## Why PayPilot

Traditional shopping assistants can recommend products, but the important moment is what happens **before money moves**. PayPilot turns purchasing into a controlled agent workflow:

> **Understand → Compare → Enforce policy → Ask for approval → Pay with PayPal → Support the purchase**

The key demo rule is simple: **purchases above the automatic spending limit require explicit human approval before a PayPal order can be created.**

## Product flow

User request → AI purchase intent → Product discovery → Comparison & reasoning → Spending policy → Human approval when required → PayPal checkout → Post-purchase agent

## Hackathon demo flow

Use the deployed prototype and walk through this sequence:

1. Enter a natural-language request such as **“Find me a programming laptop under $900.”**
2. PayPilot extracts the purchase intent and presents catalog options with prices and reasoning.
3. The spending policy evaluates the selected purchase.
4. Because the prototype's automatic limit is **USD 500**, an **USD 849** laptop triggers the human-approval step.
5. Select **Approve purchase & continue** to create the PayPal Sandbox checkout.
6. Complete the PayPal Sandbox checkout.
7. Return to PayPilot and show the **payment captured** notification and **Purchase history**.
8. Refresh the page to demonstrate that the purchase history persists through the Render Postgres database.
9. Use **Status**, **Track**, or **Refund help** to demonstrate the post-purchase support agent.

This demonstrates the complete loop from natural-language intent to a controlled PayPal transaction and post-purchase assistance.

## What is implemented

- AI-assisted purchase intent and product discovery
- Product comparison and recommendation
- Configurable automatic spending limit with human approval above the limit
- PayPal Sandbox order creation and capture
- Persistent purchase history and notifications backed by Render Postgres
- Post-purchase support guidance for status, tracking, and refund workflows
- Server-side credential handling and transaction-linkage checks
- API input bounds, browser security headers, HTTPS-only PayPal transport, and request timeouts
- Automated lint, build, and test checks in GitHub Actions
- Render deployment blueprint in `render.yaml`

## Architecture

```text
                 ┌─────────────────────┐
                 │   Natural language  │
                 │   purchase request  │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │  Intent + product   │
                 │ discovery/reasoning │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │  Spending policy    │
                 │  ≤ $500 auto-buy    │
                 │  > $500 approval    │
                 └──────────┬──────────┘
                            │
                    approval required
                            │
                            ▼
                 ┌─────────────────────┐
                 │   PayPal Sandbox    │
                 │  create → capture   │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │ Post-purchase agent │
                 │ status/track/refund │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │ Render Postgres DB  │
                 │ history/notifications│
                 └─────────────────────┘
```

## Deployment

The production prototype is deployed on Render. The Render Blueprint associates the `paypilot` web service with the `paypilot-db` Postgres database and injects `DATABASE_URL` from the database connection string.

The current hackathon deployment uses PayPal Sandbox credentials. Do not use Sandbox credentials for live commerce.

## Production notes

Purchase and notification data is persisted in Postgres when `DATABASE_URL` is configured. The application retains an in-memory fallback for local development without a database.

The current hackathon prototype should still receive a final operational review before being used for real-money commerce, including live PayPal credentials, production merchant configuration, database backups/retention, monitoring, and a formal security review.

## Development

```bash
npm install
npm run dev
```

Frontend: http://localhost:5173

API: http://localhost:3001

Production start:

```bash
npm run build
npm start
```

Environment configuration is documented in `.env.example`. Keep PayPal credentials and AI keys server-side; do not commit `.env` files.

Health check:

```bash
curl http://localhost:3001/api/health
```

## Security

PayPal client secrets and AI API keys must remain server-side and must never be committed.
