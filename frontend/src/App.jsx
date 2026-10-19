import { useEffect, useState } from 'react';

const API = 'http://localhost:3000/api/claims';

export default function App() {
  const [screen, setScreen] = useState('list');
  const [products, setProducts] = useState([]);
  const [productName, setProductName] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [formula, setFormula] = useState('');
  const [claimText, setClaimText] = useState('');
  const [evidence, setEvidence] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  async function loadProducts() {
    const res = await fetch(`${API}/products`);
    if (!res.ok) return;
    setProducts(await res.json());
  }

  async function loadHistory(name) {
    if (!name) {
      setHistory([]);
      return [];
    }
    const res = await fetch(`${API}?product=${encodeURIComponent(name)}`);
    if (!res.ok) return [];
    const claims = await res.json();
    const rows = [];
    for (const c of claims) {
      for (const a of c.assessments) {
        rows.push({
          id: a.id,
          claimText: c.claimText,
          formula: c.formula,
          evidence: a.evidence,
          justified: a.justified,
          confidence: a.confidence,
          reasoning: a.reasoning,
          model: a.model,
          createdAt: a.createdAt,
        });
      }
    }
    rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    setHistory(rows);
    return rows;
  }

  useEffect(() => {
    loadProducts().catch(() => {});
  }, []);

  function goList() {
    setScreen('list');
    setResult(null);
    setErr('');
    loadProducts().catch(() => {});
  }

  function startNew() {
    setIsNew(true);
    setProductName('');
    setFormula('');
    setClaimText('');
    setEvidence('');
    setHistory([]);
    setResult(null);
    setErr('');
    setScreen('form');
  }

  async function openProduct(p) {
    setIsNew(false);
    setProductName(p.name);
    setFormula(p.formula || '');
    setResult(null);
    setErr('');
    const rows = await loadHistory(p.name);
    const last = rows[0];
    if (last) {
      setFormula(last.formula || p.formula || '');
      setClaimText(last.claimText);
      setEvidence(last.evidence);
    }
    setScreen('form');
  }

  async function onSubmit(e) {
    e.preventDefault();
    const name = productName.trim();
    if (!name) {
      setErr('Give the product a name first.');
      return;
    }
    setErr('');
    setResult(null);
    setBusy(true);
    try {
      const res = await fetch(`${API}/assess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: name, formula, claimText, evidence }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = Array.isArray(data.message)
          ? data.message.join(', ')
          : data.message || 'Request failed';
        setErr(String(msg));
        return;
      }
      setResult(data.assessment);
      setIsNew(false);
      await loadProducts();
      await loadHistory(name);
    } catch {
      setErr('Cannot reach the API — is the backend up on :3000?');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <header className="top">
        <div className="lockup">
          <span className="wordmark">L&apos;Oréal</span>
          <span className="paris">Paris</span>
        </div>
        <span className="unit">Recherche &amp; Innovation</span>
      </header>
      <p className="key-note">
        No OpenAI key needed to try Assess — a demo model runs the first pass.
        Add OPENAI_API_KEY to backend/.env later if you want to use your own.
      </p>

      <main className="page">
        {screen === 'list' && (
          <>
            <p className="kicker">Evaluator desk · claim substantiation</p>
            <h1>Claims Intelligence</h1>
            <p className="lede">
              Pick a product to see what we already assessed, or start a new
              one. First pass only — evaluation still signs off.
            </p>
            <button type="button" onClick={startNew}>
              New product
            </button>
            {products.length === 0 ? (
              <p className="placeholder">Nothing in the database yet.</p>
            ) : (
              <ul className="plist">
                {products.map((p) => (
                  <li key={p.name}>
                    <button type="button" className="prod" onClick={() => openProduct(p)}>
                      <span className="prod-name">{p.name}</span>
                      {p.formula && <span className="prod-sub">{p.formula}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {screen === 'form' && (
          <>
            <button type="button" className="back" onClick={goList}>
              ← All products
            </button>
            <p className="kicker">Evaluator desk · claim substantiation</p>
            <h1>{isNew ? 'New product' : productName}</h1>
            <p className="lede">
              Attach the clinical write-up against the claim wording.
            </p>

            <div className="work">
              <form onSubmit={onSubmit}>
                {isNew && (
                  <label>
                    <span>Product</span>
                    <input
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      placeholder="e.g. Revitalift test batch"
                    />
                  </label>
                )}
                <label>
                  <span>Formula</span>
                  <input
                    value={formula}
                    onChange={(e) => setFormula(e.target.value)}
                    placeholder="e.g. retinol 0.3%"
                  />
                </label>
                <label>
                  <span>Claim</span>
                  <textarea
                    required
                    minLength={10}
                    rows={2}
                    value={claimText}
                    onChange={(e) => setClaimText(e.target.value)}
                    placeholder="e.g. Reduces wrinkles by 20% in 4 weeks"
                  />
                </label>
                <label>
                  <span>Clinical evidence</span>
                  <textarea
                    required
                    minLength={20}
                    rows={5}
                    value={evidence}
                    onChange={(e) => setEvidence(e.target.value)}
                    placeholder="Paste the clinical write-up"
                  />
                </label>
                <button type="submit" disabled={busy}>
                  {busy ? 'Assessing…' : 'Assess claim'}
                </button>
                {err && <p className="err">{err}</p>}
              </form>

              <section className={'result' + (result || history.length ? ' has' : '')}>
                {!result && !history.length && (
                  <p className="placeholder">
                    Assessment will show here — Justified, Confidence Score,
                    Reasoning.
                  </p>
                )}
                {result && (
                  <>
                    <h2>Assessment</h2>
                    <dl>
                      <div>
                        <dt>Justified</dt>
                        <dd className={result.justified ? 'yes' : 'no'}>
                          {result.justified ? 'Yes' : 'No'}
                        </dd>
                      </div>
                      <div>
                        <dt>Confidence Score</dt>
                        <dd>{Math.round(result.confidence * 100)}%</dd>
                      </div>
                    </dl>
                    <h3>Reasoning</h3>
                    <p>{result.reasoning}</p>
                    {result.model && <p className="model">{result.model}</p>}
                  </>
                )}
                {history.length > 0 && (
                  <div className="history">
                    <h3>History</h3>
                    <ul>
                      {history.map((row) => (
                        <li key={row.id}>
                          <button
                            type="button"
                            className="hist"
                            onClick={() => {
                              setResult(row);
                              setFormula(row.formula || '');
                              setClaimText(row.claimText);
                              setEvidence(row.evidence);
                            }}
                          >
                            <span className={row.justified ? 'yes' : 'no'}>
                              {row.justified ? 'Yes' : 'No'}
                            </span>
                            <span className="hist-claim">{row.claimText}</span>
                            <span className="hist-when">
                              {new Date(row.createdAt).toLocaleString()}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
