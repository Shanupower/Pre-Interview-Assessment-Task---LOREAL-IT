import { useState } from 'react';

const API = 'http://localhost:3000/api/claims/assess';

export default function App() {
  const [productName, setProductName] = useState('Revitalift test batch');
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

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    setResult(null);
    setBusy(true);
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName, formula, claimText, evidence }),
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
    } catch {
      setErr('Cannot reach the API — is the backend up on :3000?');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header>
        <h1>Claims Intelligence</h1>
        <p className="lede">
          Evaluator attaches the study. We store a first-pass read on whether
          it actually supports the wording of the claim.
        </p>
      </header>

      <form onSubmit={onSubmit}>
        <label>
          Product
          <input
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
          />
        </label>
        <label>
          Formula
          <input
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
          />
        </label>
        <label>
          Claim
          <textarea
            required
            minLength={10}
            rows={3}
            value={claimText}
            onChange={(e) => setClaimText(e.target.value)}
          />
        </label>
        <label>
          Clinical evidence
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
      </form>

      {err && <p className="err">{err}</p>}

      {result && (
        <section className="result">
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
        </section>
      )}
    </div>
  );
}
