export const DEMO = import.meta.env.VITE_DEMO === '1';

const API = 'http://localhost:3000/api/claims';
const STORE = 'loreal-claims-demo';

function seed() {
  const now = new Date().toISOString();
  return {
    claims: [
      {
        id: 'seed-c',
        productName: 'Revitalift test batch',
        formula: 'retinol 0.3%, HA 1%',
        claimText: 'Reduces wrinkles by 20% in 4 weeks',
        createdAt: now,
        assessments: [
          {
            id: 'seed-a',
            evidence:
              'Split-face instrumental study, 72 women, 4 weeks. Mean wrinkle volume reduced 22% versus vehicle, p<0.05.',
            justified: true,
            confidence: 0.72,
            reasoning:
              'Duration matches (4 weeks) and the reported reduction (22%) is in range of the claimed 20%, with stats language in the write-up. Still a first pass — evaluation signs off.',
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

function flatten(claims) {
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
  return rows;
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
    out.push({ name, formula: r.formula });
  }
  return out;
}

export async function history(product) {
  if (!product) return [];
  if (!DEMO) {
    const res = await fetch(`${API}?product=${encodeURIComponent(product)}`);
    if (!res.ok) return [];
    return flatten(await res.json());
  }
  return flatten(
    loadStore().claims.filter((c) => c.productName === product),
  );
}

export async function assess(body) {
  if (!DEMO) {
    const res = await fetch(`${API}/assess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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

  const judged = judge(body);
  const now = new Date().toISOString();
  const claim = {
    id: crypto.randomUUID(),
    productName: body.productName,
    formula: body.formula,
    claimText: body.claimText,
    createdAt: now,
    assessments: [],
  };
  const assessment = {
    id: crypto.randomUUID(),
    evidence: body.evidence,
    justified: judged.justified,
    confidence: judged.confidence,
    reasoning: judged.reasoning,
    model: judged.model,
    createdAt: now,
  };
  claim.assessments.push(assessment);
  const store = loadStore();
  store.claims.push(claim);
  saveStore(store);
  return assessment;
}
