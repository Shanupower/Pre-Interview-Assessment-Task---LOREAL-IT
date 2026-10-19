export const DEMO = import.meta.env.VITE_DEMO === '1';

const API = 'http://localhost:3000/api/claims';
const STORE = 'loreal-claims-demo-v2';

function seed() {
  const now = new Date().toISOString();
  return {
    claims: [
      {
        id: 'seed-pending',
        productName: 'Revitalift test batch',
        formula: 'retinol 0.3%, HA 1%',
        claimText: 'Reduces wrinkles by 20% in 4 weeks',
        createdAt: now,
        assessments: [],
      },
      {
        id: 'seed-done',
        productName: 'Revitalift test batch',
        formula: 'retinol 0.3%, HA 1%',
        claimText: 'Improves skin hydration in 2 weeks',
        createdAt: now,
        assessments: [
          {
            id: 'seed-a',
            evidence:
              'Corneometer study, 48 women, 2 weeks. Hydration +18% vs vehicle, p<0.05.',
            justified: true,
            confidence: 0.7,
            reasoning:
              'The write-up matches the 2-week window and reports a measured hydration lift with stats. First pass only.',
            model: 'hosted-demo',
            createdAt: now,
          },
        ],
      },
    ],
  };
}

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) {
      const s = seed();
      localStorage.setItem(STORE, JSON.stringify(s));
      return s;
    }
    return JSON.parse(raw);
  } catch {
    return seed();
  }
}

function saveStore(data) {
  localStorage.setItem(STORE, JSON.stringify(data));
}

function judge(dto) {
  const ev = dto.evidence.toLowerCase();
  const cl = dto.claimText.toLowerCase();
  const evPct = ev.match(/(\d+(?:\.\d+)?)\s*%/);
  const clPct = cl.match(/(\d+(?:\.\d+)?)\s*%/);
  const evWeeks = ev.match(/(\d+)\s*weeks?/);
  const clWeeks = cl.match(/(\d+)\s*weeks?/);
  const hasStats = /\bp\s*[<≤]/.test(ev) || ev.includes('significant');
  const weeksMatch = !!(clWeeks && evWeeks && clWeeks[1] === evWeeks[1]);
  const pctOk = !!(evPct && clPct && Number(evPct[1]) >= Number(clPct[1]) * 0.8);

  if (weeksMatch && pctOk && hasStats) {
    return {
      justified: true,
      confidence: 0.72,
      reasoning: `Duration matches (${clWeeks[1]} weeks) and the reported reduction (${evPct[1]}%) is in range of the claimed ${clPct[1]}%, with stats language in the write-up. Still a first pass — evaluation signs off.`,
      model: 'hosted-demo',
    };
  }
  if (!weeksMatch) {
    return {
      justified: false,
      confidence: 0.4,
      reasoning: `Claim window is ${clWeeks ? clWeeks[1] + ' weeks' : 'unclear'}; the write-up ${evWeeks ? 'is ' + evWeeks[1] + ' weeks' : 'does not state a matching duration'}. That is enough to withhold justification.`,
      model: 'hosted-demo',
    };
  }
  return {
    justified: false,
    confidence: 0.38,
    reasoning:
      'Duration lines up but the magnitude or statistical support in the write-up is too thin for the claim as worded.',
    model: 'hosted-demo',
  };
}

export async function listProducts() {
  if (!DEMO) {
    const res = await fetch(`${API}/products`);
    if (!res.ok) throw new Error('products');
    return res.json();
  }
  const rows = loadStore().claims;
  const seen = new Set();
  const out = [];
  for (const r of [...rows].reverse()) {
    const name = r.productName?.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const waiting = rows.some(
      (c) => c.productName === name && (!c.assessments || c.assessments.length === 0),
    );
    out.push({ name, formula: r.formula, waiting });
  }
  return out;
}

export async function listClaims(product) {
  if (!product) return [];
  if (!DEMO) {
    const res = await fetch(`${API}?product=${encodeURIComponent(product)}`);
    if (!res.ok) return [];
    return res.json();
  }
  return loadStore().claims.filter((c) => c.productName === product);
}

export async function submitClaim(body) {
  if (!DEMO) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(String(data.message || 'Submit failed'));
    return data;
  }
  const claim = {
    id: crypto.randomUUID(),
    productName: body.productName,
    formula: body.formula,
    claimText: body.claimText,
    createdAt: new Date().toISOString(),
    assessments: [],
  };
  const store = loadStore();
  store.claims.push(claim);
  saveStore(store);
  return claim;
}

export async function attachStudy(claimId, evidence) {
  if (!DEMO) {
    const res = await fetch(`${API}/${claimId}/assess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evidence }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = Array.isArray(data.message)
        ? data.message.join(', ')
        : data.message || 'Request failed';
      throw new Error(String(msg));
    }
    return data.assessment;
  }

  const store = loadStore();
  const claim = store.claims.find((c) => c.id === claimId);
  if (!claim) throw new Error('claim not found');
  const judged = judge({
    claimText: claim.claimText,
    evidence,
    productName: claim.productName,
    formula: claim.formula,
  });
  const assessment = {
    id: crypto.randomUUID(),
    evidence,
    justified: judged.justified,
    confidence: judged.confidence,
    reasoning: judged.reasoning,
    model: judged.model,
    createdAt: new Date().toISOString(),
  };
  claim.assessments = claim.assessments || [];
  claim.assessments.push(assessment);
  saveStore(store);
  return assessment;
}
