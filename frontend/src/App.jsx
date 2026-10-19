import { useEffect, useState } from 'react';
import {
  DEMO,
  attachStudy,
  listClaims,
  listProducts,
  submitClaim,
} from './api';

export default function App() {
  const [screen, setScreen] = useState('list');
  const [products, setProducts] = useState([]);
  const [productName, setProductName] = useState('');
  const [formula, setFormula] = useState('');
  const [claimText, setClaimText] = useState('');
  const [evidence, setEvidence] = useState('');
  const [claims, setClaims] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null);

  const pending = claims.filter((c) => !c.assessments?.length);
  const done = claims.filter((c) => c.assessments?.length);
  const active = claims.find((c) => c.id === activeId);

  async function refreshProducts() {
    setProducts(await listProducts());
  }

  async function refreshClaims(name) {
    const rows = await listClaims(name);
    setClaims(rows);
    return rows;
  }

  useEffect(() => {
    refreshProducts().catch(() => {});
  }, []);

  function goList() {
    setScreen('list');
    setResult(null);
    setErr('');
    setActiveId('');
    refreshProducts().catch(() => {});
  }

  function startScientist() {
    setProductName('');
    setFormula('');
    setClaimText('');
    setErr('');
    setScreen('scientist');
  }

  async function openProduct(p) {
    setProductName(p.name);
    setFormula(p.formula || '');
    setEvidence('');
    setResult(null);
    setErr('');
    const rows = await refreshClaims(p.name);
    const wait = rows.find((c) => !c.assessments?.length);
    setActiveId(wait ? wait.id : rows[0]?.id || '');
    setScreen('desk');
  }

  async function onSubmitClaim(e) {
    e.preventDefault();
    const name = productName.trim();
    if (!name) {
      setErr('Give the product a name first.');
      return;
    }
    setErr('');
    setBusy(true);
    try {
      const claim = await submitClaim({
        productName: name,
        formula,
        claimText,
      });
      setProductName(name);
      setEvidence('');
      setResult(null);
      const rows = await refreshClaims(name);
      setActiveId(claim.id);
      setScreen('desk');
      await refreshProducts();
    } catch (ex) {
      setErr(DEMO ? String(ex.message || ex) : 'Cannot reach the API — is the backend up on :3000?');
    } finally {
      setBusy(false);
    }
  }

  async function onAttach(e) {
    e.preventDefault();
    if (!activeId) {
      setErr('Pick a claim waiting for a study.');
      return;
    }
    setErr('');
    setResult(null);
    setBusy(true);
    try {
      const assessment = await attachStudy(activeId, evidence);
      setResult(assessment);
      const rows = await refreshClaims(productName);
      const wait = rows.find((c) => !c.assessments?.length);
      setActiveId(wait ? wait.id : activeId);
      setEvidence('');
      await refreshProducts();
    } catch (ex) {
      setErr(DEMO ? String(ex.message || ex) : 'Cannot reach the API — is the backend up on :3000?');
    } finally {
      setBusy(false);
    }
  }

  function pickDone(claim, assessment) {
    setActiveId(claim.id);
    setResult(assessment);
    setEvidence(assessment.evidence);
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
          ? 'Hosted demo — data stays in this browser. Scientist submits the formula; evaluator attaches the study. Full stack is docker compose up.'
          : 'Scientist submits formula + claim. Evaluator attaches the clinical study, then we run the first-pass assess. No OpenAI key required.'}
      </p>

      <main className="page">
        {screen === 'list' && (
          <>
            <p className="kicker">Paris R&amp;I · claims desk</p>
            <h1>Claims Intelligence</h1>
            <p className="lede">
              Scientist files a formula against a claim. Evaluator attaches the
              clinical study. Then a first-pass read on whether the write-up
              actually carries the wording.
            </p>
            <button type="button" onClick={startScientist}>
              Submit formula
            </button>
            {products.length === 0 ? (
              <p className="placeholder">Nothing in the database yet.</p>
            ) : (
              <ul className="plist">
                {products.map((p) => (
                  <li key={p.name}>
                    <button type="button" className="prod" onClick={() => openProduct(p)}>
                      <span className="prod-name">{p.name}</span>
                      <span className="prod-sub">
                        {p.formula || '—'}
                        {p.waiting ? ' · waiting on study' : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {screen === 'scientist' && (
          <>
            <button type="button" className="back" onClick={goList}>
              ← All products
            </button>
            <p className="kicker">Scientist · formulation</p>
            <h1>Submit a formula</h1>
            <p className="lede">
              Lock the formula against the claim. This goes to the evaluator
              to attach the clinical study — nothing is assessed yet.
            </p>
            <form onSubmit={onSubmitClaim} className="narrow">
              <label>
                <span>Product</span>
                <input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Revitalift test batch"
                />
              </label>
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
              <button type="submit" disabled={busy}>
                {busy ? 'Sending…' : 'Send to evaluator'}
              </button>
              {err && <p className="err">{err}</p>}
            </form>
          </>
        )}

        {screen === 'desk' && (
          <>
            <button type="button" className="back" onClick={goList}>
              ← All products
            </button>
            <p className="kicker">Evaluator · clinical study</p>
            <h1>{productName}</h1>
            <p className="lede">
              Attach the results of the clinical study to a claim the scientist
              already filed. Then we run the first-pass assess.
            </p>

            <div className="work">
              <div>
                <h3 className="block-title">Waiting on a study</h3>
                {pending.length === 0 ? (
                  <p className="placeholder">No claims waiting.</p>
                ) : (
                  <ul className="plist tight">
                    {pending.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className={'prod' + (c.id === activeId ? ' on' : '')}
                          onClick={() => {
                            setActiveId(c.id);
                            setResult(null);
                            setEvidence('');
                          }}
                        >
                          <span className="prod-name sm">{c.claimText}</span>
                          <span className="prod-sub">{c.formula || '—'}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {active && !active.assessments?.length && (
                  <form onSubmit={onAttach} style={{ marginTop: 22 }}>
                    <label>
                      <span>Clinical study results</span>
                      <textarea
                        required
                        minLength={20}
                        rows={6}
                        value={evidence}
                        onChange={(e) => setEvidence(e.target.value)}
                        placeholder="Paste the evaluator’s clinical write-up"
                      />
                    </label>
                    <button type="submit" disabled={busy}>
                      {busy ? 'Assessing…' : 'Attach study & assess'}
                    </button>
                    {err && <p className="err">{err}</p>}
                  </form>
                )}
              </div>

              <section className={'result' + (result || done.length ? ' has' : '')}>
                {!result && (
                  <p className="placeholder">
                    After the study is attached: Justified, Confidence Score,
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
                    {result.evidence && (
                      <>
                        <h3>Clinical study results</h3>
                        <p className="study">{result.evidence}</p>
                      </>
                    )}
                    {result.model && <p className="model">{result.model}</p>}
                  </>
                )}
                {done.length > 0 && (
                  <div className="history">
                    <h3>Already assessed</h3>
                    <ul>
                      {done.flatMap((c) =>
                        c.assessments.map((a) => (
                          <li key={a.id}>
                            <button
                              type="button"
                              className="hist"
                              onClick={() => pickDone(c, a)}
                            >
                              <span className={a.justified ? 'yes' : 'no'}>
                                {a.justified ? 'Yes' : 'No'}
                              </span>
                              <span className="hist-claim">{c.claimText}</span>
                              <span className="hist-study">{a.evidence}</span>
                              <span className="hist-when">
                                {new Date(a.createdAt).toLocaleString()}
                              </span>
                            </button>
                          </li>
                        )),
                      )}
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
