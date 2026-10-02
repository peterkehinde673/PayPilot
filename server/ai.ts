export type PurchaseIntent = {
  request: string;
  category: string;
  query: string;
  maxPrice: string | null;
  currency: string;
  requirements: string[];
};

export type ProductOption = {
  id: string;
  name: string;
  price: string;
  currency: string;
  reason: string;
};

export type PurchasePlan = {
  intent: PurchaseIntent;
  options: ProductOption[];
  reasoning: string;
  provider: 'ai' | 'fallback';
};

export class AIProviderError extends Error {
  constructor(message: string, public readonly status = 502) {
    super(message);
    this.name = 'AIProviderError';
  }
}

const SYSTEM_PROMPT = [
  'You are PayPilot, a careful purchasing assistant.',
  'Convert the user request into structured purchase intent.',
  'Never invent a real product listing or claim live availability.',
  'If price, currency, or requirements are missing, use null/empty values.',
  'Return only valid JSON with keys: category, query, maxPrice, currency, requirements, reasoning.',
  'currency must be a 3-letter code when known.',
  'maxPrice must be a decimal string when known.'
].join(' ');

export async function buildPurchasePlan(request: string): Promise<PurchasePlan> {
  const normalized = request.trim().slice(0, 500);

  if (!normalized) {
    throw new AIProviderError('Purchase request is required', 400);
  }

  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    return buildFallbackPlan(normalized);
  }

  const baseUrl = (process.env.AI_API_URL ?? 'https://api.openai.com/v1/chat/completions').replace(/\/$/, '');
  const model = process.env.AI_MODEL ?? 'gpt-4o-mini';

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: normalized }
      ]
    })
  });

  const data = await readJson(response);
  if (!response.ok) {
    throw new AIProviderError('AI provider request failed', 502);
  }

  const content = extractContent(data);
  if (!content) {
    throw new AIProviderError('AI provider returned no structured purchase intent');
  }

  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const intent = normalizeIntent(normalized, parsed);
    return {
      intent,
      options: [],
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning.slice(0, 500) : 'Intent extracted by the AI provider.',
      provider: 'ai'
    };
  } catch {
    throw new AIProviderError('AI provider returned invalid purchase intent JSON');
  }
}

function buildFallbackPlan(request: string): PurchasePlan {
  const amountMatch = request.match(/(?:under|below|less than|max(?:imum)?(?: of)?)\s*[$€£]?\s*(\d+(?:\.\d{1,2})?)/i);
  const currency = request.includes('€') ? 'EUR' : request.includes('£') ? 'GBP' : 'USD';
  const maxPrice = amountMatch?.[1] ?? null;
  const category = inferCategory(request);

  return {
    intent: {
      request,
      category,
      query: request,
      maxPrice,
      currency,
      requirements: extractRequirements(request)
    },
    options: [],
    reasoning: 'AI credentials are not configured, so PayPilot used its safe local intent parser. No live products or prices were invented.',
    provider: 'fallback'
  };
}

function inferCategory(request: string): string {
  const value = request.toLowerCase();
  if (/laptop|computer|macbook|chromebook/.test(value)) return 'computers';
  if (/phone|iphone|android|smartphone/.test(value)) return 'phones';
  if (/headphone|earbud|airpod/.test(value)) return 'audio';
  if (/monitor|display/.test(value)) return 'monitors';
  if (/keyboard|mouse/.test(value)) return 'computer accessories';
  if (/camera|dslr|mirrorless/.test(value)) return 'cameras';
  return 'general';
}

function extractRequirements(request: string): string[] {
  const requirements: string[] = [];
  const value = request.toLowerCase();
  if (value.includes('programming')) requirements.push('programming');
  if (value.includes('gaming')) requirements.push('gaming');
  if (value.includes('portable')) requirements.push('portable');
  if (value.includes('wireless')) requirements.push('wireless');
  if (value.includes('new')) requirements.push('new');
  return requirements;
}

function normalizeIntent(request: string, value: Record<string, unknown>): PurchaseIntent {
  const currency = typeof value.currency === 'string' && /^[A-Za-z]{3}$/.test(value.currency)
    ? value.currency.toUpperCase()
    : 'USD';
  const maxPrice = typeof value.maxPrice === 'string' && /^\d{1,9}(?:\.\d{1,2})?$/.test(value.maxPrice)
    ? value.maxPrice
    : null;
  const requirements = Array.isArray(value.requirements)
    ? value.requirements.filter((item): item is string => typeof item === 'string').slice(0, 10)
    : [];

  return {
    request,
    category: typeof value.category === 'string' ? value.category.slice(0, 80) : 'general',
    query: typeof value.query === 'string' ? value.query.slice(0, 300) : request,
    maxPrice,
    currency,
    requirements
  };
}

function extractContent(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const choices = (value as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== 'object') return null;
  const message = (choices[0] as { message?: unknown }).message;
  if (!message || typeof message !== 'object') return null;
  const content = (message as { content?: unknown }).content;
  return typeof content === 'string' ? content : null;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}
