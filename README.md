# PayPilot

**An AI purchasing agent powered by PayPal.**

PayPilot helps a user describe what they want to buy, evaluates available options, applies the user's spending rules, and uses PayPal for controlled checkout.

## Product flow

User request → AI purchase intent → Product discovery → Comparison & reasoning → Spending policy → Human approval when required → PayPal checkout → Post-purchase agent

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
