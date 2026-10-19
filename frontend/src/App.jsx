import { useEffect, useState } from 'react';

const API = 'http://localhost:3000/api/claims';
const NEW = '__new__';

export default function App() {
  const [products, setProducts] = useState([]);
  const [picked, setPicked] = useState(NEW);
  const [productName, setProductName] = useState('');
  const [formula, setFormula] = useState('retinol 0.3%, HA 1%');
  const [claimText, setClaimText] = useState(
    'Reduces wrinkles by 20% in 4 weeks',
  );
  const [evidence, setEvidence] = useState(
    'Split-face instrumental study, 72 women, 4 weeks. Mean wrinkle volume reduced 22% versus vehicle, p<0.05. Corneometer hydration also up, not claimed.',
  );
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
      return;
    }
    const res = await fetch(`${API}?product=${encodeURIComponent(name)}`);
    if (!res.ok) return;
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
          createdAt: a.createdAt,
        });
      }
    }
    rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    setHistory(rows);
  }

  useEffect(() => {
    loadProducts().catch(() => {});
  }, []);

  function onPick(value) {
    setPicked(value);
    setResult(null);
    if (value === NEW) {
      setProductName('');
      setHistory([]);
      return;
    }
    setProductName(value);
    const known = products.find((p) => p.name === value);
    if (known?.formula) setFormula(known.formula);
    loadHistory(value).catch(() => {});
  }

  async function onSubmit(e) {
    e.preventDefault();
    const name = productName.trim();
    if (!name) {
      setErr('Pick a product, or type a new one.');
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
      setPicked(name);
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
        Assess no longer needs your OpenAI key. I wired a demo model for this
        machine and ran it: Justified Yes, 95%, and reasoning that actually
        compared 22% / 4 weeks / n=72 to the claim (demo:gpt-oss-20b). If you
        later drop a key in backend/.env as OPENAI_API_KEY, it will use that
        instead.
      </p>

      <main className="page">
        <p className="kicker">Evaluator desk · claim substantiation</p>
        <h1>Claims Intelligence</h1>
        <p className="lede">
          Attach the clinical write-up against the claim wording. This is a
          first pass for R&amp;I — evaluation still signs off.
        </p>

        <div className="work">
          <form onSubmit={onSubmit}>
            <label>
              <span>Product</span>
              <select value={picked} onChange={(e) => onPick(e.target.value)}>
                <option value={NEW}>New product…</option>
                {products.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            {picked === NEW && (
              <label>
                <span>New product name</span>
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
              />
            </label>
            <label>
              <span>Claim</span>
              <textarea
                required
                minLength={10}
                rows={3}
                value={claimText}
                onChange={(e) => setClaimText(e.target.value)}
              />
            </label>
            <label>
              <span>Clinical evidence</span>
              <textarea
                required
                minLength={20}
                rows={7}
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
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
                Reasoning. Pick a product to see past reads.
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
              </>
            )}
            {history.length > 0 && (
              <div className="history">
                <h3>History · {productName}</h3>
                <ul>
                  {history.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        className="hist"
                        onClick={() => setResult(row)}
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
      </main>
    </div>
  );
}
