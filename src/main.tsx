import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

function App() {
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
          <div className="command-label">TRY A REQUEST</div>
          <div className="command">“Find me a programming laptop under $900”</div>
          <button type="button">Start shopping</button>
        </div>
        <div className="status-grid">
          <div><strong>AI Agent</strong><span>Ready</span></div>
          <div><strong>PayPal</strong><span>Sandbox</span></div>
          <div><strong>Purchase Policy</strong><span>Human approval</span></div>
        </div>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);
