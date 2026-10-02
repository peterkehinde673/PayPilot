import cors from 'cors';
import express from 'express';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'paypilot-api',
    version: '0.1.0'
  });
});

app.get('/api/config', (_req, res) => {
  res.json({
    paypalConfigured: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
    aiConfigured: Boolean(process.env.AI_API_KEY)
  });
});

app.listen(PORT, () => {
  console.log(`PayPilot API listening on http://localhost:${PORT}`);
});
