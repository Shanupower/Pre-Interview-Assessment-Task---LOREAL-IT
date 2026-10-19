import { useEffect, useState } from 'react';
import { DEMO, assess, history, listProducts } from './api';

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
  const [past, setPast] = useState([]);

  async function refreshProducts() {
    setProducts(await listProducts());
  }

  async function refreshHistory(name) {
    if (!name) {
      setPast([]);
      return [];
    }
    const rows = await history(name);
    setPast(rows);
    return rows;
  }

  useEffect(() => {
    refreshProducts().catch(() => {});
  }, []);

  function goList() {
    setScreen('list');
    setResult(null);
    setErr('');
    refreshProducts().catch(() => {});
  }

  function startNew() {
    setIsNew(true);
    setProductName('');
    setFormula('');
    setClaimText('');
    setEvidence('');
    setPast([]);
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
    const rows = await refreshHistory(p.name);
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
      const assessment = await assess({
        productName: name,
        formula,
        claimText,
        evidence,
      });
      setResult(assessment);
      setIsNew(false);
      await refreshProducts();
      await refreshHistory(name);
    } catch (ex) {
      setErr(
        DEMO
          ? String(ex.message || ex)
          : 'Cannot reach the API — is the backend up on :3000?',
      );
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
        {DEMO
          ? 'Hosted demo — Assess runs in the browser, history stays on this machine. Full Nest/Prisma stack is in the repo (docker compose up).'
          : 'No OpenAI key needed to try Assess — a demo model runs the first pass. Add OPENAI_API_KEY to backend/.env later if you want to use your own.'}
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

              <section className={'result' + (result || past.length ? ' has' : '')}>
                {!result && !past.length && (
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
                {past.length > 0 && (
                  <div className="history">
                    <h3>History</h3>
                    <ul>
                      {past.map((row) => (
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
