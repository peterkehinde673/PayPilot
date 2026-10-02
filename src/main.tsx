import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

type CheckoutState = 'idle' | 'loading' | 'ready' | 'error';

function App() {
  const [request, setRequest] = useState('Find me a programming laptop under $900');
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [intentSummary, setIntentSummary] = useState<string | null>(null);
  const [products, setProducts] = useState<Array<{ id: string; name: string; price: string; currency: string; reason: string }>>([]);
  const [comparison, setComparison] = useState<{ recommendedId: string | null; summary: string } | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [state, setState] = useState<CheckoutState>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) return;

    setState('loading');
    fetch(`/api/paypal/orders/${encodeURIComponent(token)}/capture`, { method: 'POST' })
      .then(async (response) => {
        const data = (await response.json()) as { id?: string; status?: string; error?: string };
        if (!response.ok) throw new Error(data.error ?? 'Unable to capture the PayPal order');
        setState('ready');
        setMessage(`PayPal order ${data.id ?? token} captured with status ${data.status ?? 'COMPLETED'}.`);
        window.history.replaceState({}, document.title, window.location.pathname);
      })
      .catch((error: unknown) => {
        setState('error');
        setMessage(error instanceof Error ? error.message : 'Unable to capture the PayPal order');
      });
  }, []);

  async function startShopping() {
    setState('loading');
    setIntentSummary(null);
    setProducts([]);
    setComparison(null);
    setSelectedProductId(null);
    setCheckoutUrl(null);
    setMessage('');

    try {
      const intentResponse = await fetch('/api/ai/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request })
      });
      const intentData = (await intentResponse.json()) as {
        intent?: { category?: string; maxPrice?: string | null; currency?: string };
        options?: Array<{ id: string; name: string; price: string; currency: string; reason: string }>;
        comparison?: { recommendedId: string | null; summary: string };
        provider?: string;
        error?: string;
      };
      if (!intentResponse.ok) throw new Error(intentData.error ?? 'Unable to understand the purchase request');

      const intent = intentData.intent;
      setProducts(intentData.options ?? []);
      setComparison(intentData.comparison ?? null);
      setSelectedProductId(intentData.comparison?.recommendedId ?? intentData.options?.[0]?.id ?? null);
      setIntentSummary(
        `Intent: ${intent?.category ?? 'general'} · Budget: ${intent?.maxPrice ? `${intent.maxPrice} ${intent.currency ?? 'USD'}` : 'not specified'} · ${intentData.provider === 'ai' ? 'AI' : 'safe local parser'}`
      );

      const selectedProduct = (intentData.options ?? []).find((product) => product.id === (selectedProductId ?? intentData.comparison?.recommendedId ?? intentData.options?.[0]?.id));
      if (!selectedProduct) throw new Error('No matching product is available for checkout');

      const response = await fetch('/api/paypal/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: selectedProduct.price,
          currency: selectedProduct.currency,
          description: selectedProduct.name
        })
      });

      const data = (await response.json()) as {
        id?: string;
        approveUrl?: string | null;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to create the PayPal order');
      }

      if (!data.approveUrl) {
        throw new Error('PayPal created the order but did not return an approval URL');
      }

      setCheckoutUrl(data.approveUrl);
      setState('ready');
      setMessage(`PayPal order ${data.id ?? 'created'} is ready for approval.`);
    } catch (error: unknown) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Unable to start checkout');
    }
  }

  return (
    <main className="app">
      <section className="hero">
        <div className="badge">PAYPILOT · AI COMMERCE</div>
        <h1>
          Buy smarter.
          <br />
          <span>Stay in control.</span>
        </h1>
        <p className="subtitle">
          An AI purchasing agent that understands what you need, evaluates options,
          and lets you decide when your money moves.
        </p>

        <div className="command-card">
          <div className="command-label">PURCHASE REQUEST</div>
          <input
            aria-label="Purchase request"
            value={request}
            onChange={(event) => setRequest(event.target.value)}
          />
          <div className="checkout-fields"><div className="checkout-note">Checkout uses the selected catalog product price.</div></div>
          <button type="button" onClick={startShopping} disabled={state === 'loading'}>
            {state === 'loading' ? 'Creating PayPal order…' : 'Start shopping'}
          </button>

          {intentSummary && <div className="intent-summary" role="status">{intentSummary}</div>}

          {comparison && <div className="comparison-summary" role="status">{comparison.summary}</div>}

          {products.length > 0 && (
            <div className="product-list" aria-label="Product options">
              {products.map((product) => (
                <button type="button" className={selectedProductId === product.id ? 'product-card selected' : 'product-card'} key={product.id} onClick={() => setSelectedProductId(product.id)}>
                  <div>
                    <strong>{product.name}</strong>
                    <p>{product.reason}</p>
                  </div>
                  <span>{product.currency} {product.price}</span>
                </button>
              ))}
            </div>
          )}

          {message && (
            <div className={`checkout-message ${state === 'error' ? 'error' : 'success'}`} role="status">
              {message}
            </div>
          )}

          {checkoutUrl && (
            <a className="approve-link" href={checkoutUrl}>
              Continue to PayPal Sandbox →
            </a>
          )}
        </div>

        <div className="status-grid">
          <div><strong>AI Agent</strong><span>Ready for Phase 3</span></div>
          <div><strong>PayPal</strong><span>Sandbox checkout</span></div>
          <div><strong>Purchase Policy</strong><span>Phase 4</span></div>
        </div>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);
