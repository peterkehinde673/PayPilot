import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

type CheckoutState = 'idle' | 'loading' | 'ready' | 'error';

function App() {
  const [request, setRequest] = useState('Find me a programming laptop under $900');
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [intentSummary, setIntentSummary] = useState<string | null>(null);
  const [products, setProducts] = useState<Array<{ id: string; name: string; price: string; currency: string; reason: string }>>([]);
  const [comparison, setComparison] = useState<{ recommendedId: string | null; summary: string } | null>(null);
  const [policy, setPolicy] = useState<{ allowed: boolean; requiresApproval: boolean; reason: string } | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [approvalToken, setApprovalToken] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<Array<{ id: string; productName: string; amount: string; currency: string; status: string; paypalOrderId?: string }>>([]);
  const [notifications, setNotifications] = useState<Array<{ type: string; message: string; createdAt: string }>>([]);
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

  async function loadNotifications() {
    const response = await fetch('/api/notifications');
    if (!response.ok) return;
    const data = (await response.json()) as { notifications?: typeof notifications };
    setNotifications(data.notifications ?? []);
  }

  async function loadPurchases() {
    const response = await fetch('/api/purchases');
    if (!response.ok) return;
    const data = (await response.json()) as { purchases?: typeof purchases };
    setPurchases(data.purchases ?? []);
  }

  async function startShopping() {
    setState('loading');
    setIntentSummary(null);
    setProducts([]);
    setComparison(null);
    setPolicy(null);
    setSelectedProductId(null);
    setApprovalToken(null);
    setCheckoutUrl(null);
    setPurchaseId(null);
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
        policy?: { allowed: boolean; requiresApproval: boolean; reason: string } | null;
        provider?: string;
        error?: string;
      };
      if (!intentResponse.ok) throw new Error(intentData.error ?? 'Unable to understand the purchase request');

      setProducts(intentData.options ?? []);
      setComparison(intentData.comparison ?? null);
      setPolicy(intentData.policy ?? null);
      const defaultProductId = intentData.comparison?.recommendedId ?? intentData.options?.[0]?.id ?? null;
      setSelectedProductId(defaultProductId);
      setIntentSummary(
        `Intent: ${intentData.intent?.category ?? 'general'} · Budget: ${intentData.intent?.maxPrice ? `${intentData.intent.maxPrice} ${intentData.intent.currency ?? 'USD'}` : 'not specified'} · ${intentData.provider === 'ai' ? 'AI' : 'safe local parser'}`
      );

      if (!defaultProductId) throw new Error('No matching product is available for checkout');

      const selectedProduct = (intentData.options ?? []).find((product) => product.id === defaultProductId);
      if (!selectedProduct) throw new Error('No matching product is available for checkout');

      if (intentData.policy?.requiresApproval) {
        const approvalResponse = await fetch('/api/purchases/approval', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: selectedProduct.price, currency: selectedProduct.currency })
        });
        const approvalData = (await approvalResponse.json()) as {
          approved?: boolean;
          approvalToken?: string;
          decision?: { reason: string; requiresApproval: boolean };
          error?: string;
        };
        if (!approvalResponse.ok) throw new Error(approvalData.error ?? 'Unable to request purchase approval');
        setApprovalToken(approvalData.approvalToken ?? null);
        setState('ready');
        setMessage('Human approval is required before PayPal checkout can be created.');
        return;
      }

      await createCheckout(selectedProduct, null);
    } catch (error: unknown) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Unable to start checkout');
    }
  }

  async function createCheckout(
    selectedProduct: { id: string; name: string; price: string; currency: string; reason: string },
    token: string | null
  ) {
    setState('loading');
    try {
      const response = await fetch('/api/paypal/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: selectedProduct.price,
          currency: selectedProduct.currency,
          description: selectedProduct.name,
          productId: selectedProduct.id,
          approvalToken: token ?? undefined
        })
      });
      const data = (await response.json()) as { purchaseId?: string; id?: string; approveUrl?: string | null; error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Unable to create the PayPal order');
      if (!data.approveUrl) throw new Error('PayPal created the order but did not return an approval URL');

      setApprovalToken(null);
      setPurchaseId(data.purchaseId ?? null);
      setCheckoutUrl(data.approveUrl);
      setState('ready');
      setMessage(`PayPal order ${data.id ?? 'created'} is ready for approval.`);
      await loadPurchases();
    } catch (error: unknown) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Unable to start checkout');
    }
  }

  async function approvePurchase() {
    if (!approvalToken || !selectedProductId) return;
    const product = products.find((item) => item.id === selectedProductId);
    if (!product) return;
    await createCheckout(product, approvalToken);
  }

  return (
    <>

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
            {state === 'loading' ? 'Working…' : 'Start shopping'}
          </button>
          {approvalToken && (
            <button type="button" className="approval-button" onClick={approvePurchase} disabled={state === 'loading'}>
              Approve purchase & continue →
            </button>
          )}

          {intentSummary && <div className="intent-summary" role="status">{intentSummary}</div>}

          {comparison && <div className="comparison-summary" role="status">{comparison.summary}</div>}
          {policy && (
            <div className={`policy-summary ${policy.requiresApproval ? 'approval' : policy.allowed ? 'allowed' : 'blocked'}`} role="status">
              <strong>{policy.requiresApproval ? 'Human approval required' : policy.allowed ? 'Within automatic spending policy' : 'Purchase blocked'}</strong>
              <span>{policy.reason}</span>
            </div>
          )}

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
            <section className="notification-panel" aria-label="Purchase notifications">
          <div className="section-heading"><h2>Agent notifications</h2><button type="button" onClick={loadNotifications}>Refresh</button></div>
          {notifications.length === 0 ? <p className="empty-state">No notifications yet.</p> : notifications.slice(0, 5).map((item, index) => (
            <div className="notification-row" key={item.createdAt + index}><strong>{item.type.replace('_', ' ')}</strong><span>{item.message}</span></div>
          ))}
        </section>

        <section className="purchase-history" aria-label="Purchase history">
          <div className="section-heading"><h2>Purchase history</h2><button type="button" onClick={loadPurchases}>Refresh</button></div>
          {purchases.length === 0 ? <p className="empty-state">No PayPilot purchases yet.</p> : purchases.map((purchase) => (
            <div className="history-row" key={purchase.id}>
              <div><strong>{purchase.productName}</strong><span>{purchase.currency} {purchase.amount}</span></div>
              <span className="history-status">{purchase.status.replace('_', ' ')}</span>
            </div>
          ))}
        </section>
</main>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);
