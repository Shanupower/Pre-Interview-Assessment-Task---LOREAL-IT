import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { PrismaService } from '../prisma';
import { AssessClaimDto, SubmitClaimDto } from './assess.dto';

const REVIEWER =
  'First-pass cosmetic claims reviewer for R&I. EU 655/2013 evidential support only — you do not sign off. Decide whether THIS clinical write-up supports THIS claim as worded, not a nearby nicer story.\n\n' +
  'Hard no: study shorter than the claimed timepoint, or that timepoint is not reported. Different endpoint (hydration / TES / glow / liking is not wrinkles; “anti-ageing” is not a measured %). Claimed number not met — do not round a miss into a hit. Write-up is consumer quotes only against a quantified or instrumental claim. Write-up names a different active or product than the one filed.\n\n' +
  'Do not invent n, %, p-values, weeks, or endpoints. If a figure is missing, say it is missing. If the write-up is silent on formula, that is not a hard no — note it, drop confidence, judge the rest. Thin design (no vehicle, small n, no stats) lowers confidence; it is an automatic no only when the claim is quantified and the number or stats are absent.\n\n' +
  'justified = the paste actually carries the wording. confidence = how sure you are of that call (a clean duration miss is false with high confidence), not how strong the claim is. reasoning = 2–5 sentences, cite numbers that appear in the write-up.\n\n' +
  'JSON only: {"justified":boolean,"confidence":number,"reasoning":string}. confidence is 0 to 1.';

@Injectable()
export class ClaimsService {
  constructor(private readonly db: PrismaService) {}

  async listProducts() {
    const rows = await this.db.claim.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        productName: true,
        formula: true,
        assessments: { select: { id: true } },
      },
    });
    const waiting = new Set<string>();
    for (const r of rows) {
      const n = r.productName?.trim();
      if (n && (r.assessments?.length ?? 0) === 0) waiting.add(n);
    }
    const seen = new Set<string>();
    const out: { name: string; formula: string | null; waiting: boolean }[] = [];
    for (const r of rows) {
      const name = r.productName?.trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      out.push({ name, formula: r.formula, waiting: waiting.has(name) });
    }
    return out;
  }

  history(product: string) {
    return this.db.claim.findMany({
      where: { productName: product },
      orderBy: { createdAt: 'desc' },
      include: {
        assessments: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  submit(dto: SubmitClaimDto) {
    return this.db.claim.create({
      data: {
        claimText: dto.claimText,
        productName: dto.productName,
        formula: dto.formula,
      },
    });
  }

  async attachStudy(claimId: string, evidence: string) {
    const claim = await this.db.claim.findUnique({ where: { id: claimId } });
    if (!claim) {
      throw new HttpException('claim not found', HttpStatus.NOT_FOUND);
    }

    const judged = await this.askModel({
      claimText: claim.claimText,
      productName: claim.productName ?? '',
      formula: claim.formula ?? undefined,
      evidence,
    });

    const assessment = await this.db.assessment.create({
      data: {
        claimId: claim.id,
        evidence,
        justified: judged.justified,
        confidence: judged.confidence,
        reasoning: judged.reasoning,
        model: judged.model,
      },
    });

    return { claim, assessment };
  }

  async assess(dto: AssessClaimDto) {
    const claim = await this.submit(dto);
    return this.attachStudy(claim.id, dto.evidence);
  }

  private async askModel(dto: AssessClaimDto) {
    const messages = [
      { role: 'system' as const, content: REVIEWER },
      {
        role: 'user' as const,
        content:
          `Assess this pair. Use only numbers that appear in the write-up.\n\n` +
          `Claim: ${dto.claimText}\n` +
          `Product: ${dto.productName || 'n/a'}\n` +
          `Formula: ${dto.formula || 'n/a'}\n\n` +
          `Clinical study results:\n${dto.evidence}`,
      },
    ];

    const key = process.env.OPENAI_API_KEY;
    if (key) {
      try {
        const openai = new OpenAI({ apiKey: key });
        const res = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages,
        });
        return this.readJudgement(
          res.choices[0]?.message?.content ?? undefined,
          'gpt-4o-mini',
        );
      } catch {
        throw new HttpException('model call failed', HttpStatus.BAD_GATEWAY);
      }
    }

    for (let i = 0; i < 3; i++) {
      try {
        const res = await fetch('https://text.pollinations.ai/openai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'openai',
            response_format: { type: 'json_object' },
            messages,
          }),
        });
        if (res.ok) {
          const body = await res.json();
          const model = body.model ? `demo:${body.model}` : 'demo-llm';
          return this.readJudgement(
            body.choices?.[0]?.message?.content ?? undefined,
            model,
          );
        }
      } catch {
        return this.fallback(dto);
      }
      await new Promise((r) => setTimeout(r, 700 * (i + 1)));
    }
    return this.fallback(dto);
  }

  private readJudgement(raw: string | undefined, model: string) {
    const parsed = JSON.parse(raw || '{}');
    if (
      typeof parsed.justified !== 'boolean' ||
      typeof parsed.confidence !== 'number' ||
      typeof parsed.reasoning !== 'string'
    ) {
      throw new Error('bad shape');
    }
    return {
      justified: parsed.justified,
      confidence: Math.min(1, Math.max(0, parsed.confidence)),
      reasoning: parsed.reasoning,
      model,
    };
  }

  private fallback(dto: AssessClaimDto) {
    const ev = dto.evidence.toLowerCase();
    const cl = dto.claimText.toLowerCase();
    const wantWeeks = weekSpan(cl);
    const resultPct = effectPct(ev);
    const claimPct = effectPct(cl);
    const hasStats = /\bp\s*[<≤]/.test(ev) || ev.includes('significant');
    const weeksOk = durationOk(wantWeeks, ev);

    if (!weeksOk) {
      return {
        justified: false,
        confidence: 0.82,
        reasoning: `Claim window is ${wantWeeks ? wantWeeks + ' weeks' : 'unclear'}; the write-up does not report that timepoint. That is enough to withhold justification.`,
        model: 'local-fallback',
      };
    }
    if (!endpointOk(cl, ev)) {
      return {
        justified: false,
        confidence: 0.8,
        reasoning:
          'The write-up measures a different endpoint than the claim. A hydration or glow result does not carry a wrinkle claim, and the other way around.',
        model: 'local-fallback',
      };
    }
    if (formulaClash(dto.formula, ev)) {
      return {
        justified: false,
        confidence: 0.78,
        reasoning:
          'The clinical write-up is a different formula than the one filed with the claim.',
        model: 'local-fallback',
      };
    }
    if (consumerOnly(ev)) {
      return {
        justified: false,
        confidence: 0.76,
        reasoning:
          'The write-up is consumer language / self-assessment, not an instrumental or statistical result against the claim as worded.',
        model: 'local-fallback',
      };
    }
    if (claimPct != null && !hasStats) {
      return {
        justified: false,
        confidence: 0.7,
        reasoning:
          'The claim is quantified but the write-up has no statistical or instrumental support for the number.',
        model: 'local-fallback',
      };
    }
    if (claimPct != null && (resultPct == null || resultPct < claimPct * 0.8)) {
      return {
        justified: false,
        confidence: 0.74,
        reasoning: `Claimed ${claimPct}%; the write-up ${resultPct == null ? 'does not report a matching magnitude' : 'reports ' + resultPct + '%'}. That miss is not rounded into a yes.`,
        model: 'local-fallback',
      };
    }
    if (!hasStats) {
      return {
        justified: false,
        confidence: 0.38,
        reasoning:
          'Duration lines up but the statistical support in the write-up is too thin for the claim as worded.',
        model: 'local-fallback',
      };
    }

    return {
      justified: true,
      confidence: 0.72,
      reasoning: claimPct != null
        ? `Duration matches (${wantWeeks} weeks) and the reported result (${resultPct}%) is in range of the claimed ${claimPct}%, with stats language in the write-up. Still a first pass — evaluation signs off.`
        : `Duration matches (${wantWeeks} weeks) and the write-up reports a measured result on the claimed endpoint, with stats language. Still a first pass — evaluation signs off.`,
      model: 'local-fallback',
    };
  }
}

function effectPct(text: string) {
  const all = [...text.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => Number(m[1]));
  const effects = all.filter((n) => n >= 5);
  return effects.length ? effects[effects.length - 1] : null;
}

function weekSpan(text: string) {
  const m = text.match(/(\d+)[-\s]*weeks?/);
  return m?.[1] ?? null;
}

function durationOk(want: string | null, ev: string) {
  if (!want) return /week/.test(ev);
  const at = [...ev.matchAll(/\bweek[-\s]+(\d+)\b/g)].map((m) => m[1]);
  if (at.includes(want)) return true;
  const span = weekSpan(ev);
  return span === want;
}

function endpointOk(claim: string, ev: string) {
  if (/wrinkle/.test(claim)) {
    const measured =
      /wrinkle volume|wrinkle depth|wrinkle count|wrinkles? (down|reduc|looked)/.test(
        ev,
      );
    if (!measured) return false;
  }
  if (/hydrat/.test(claim) && !/hydrat|corneometer/.test(ev)) return false;
  return true;
}

function formulaClash(formula: string | undefined, ev: string) {
  const f = (formula || '').toLowerCase();
  const usedRetinol = /retinol\s+\d|\d+(\.\d+)?%\s*retinol/.test(ev);
  const usedVitC = /vitamin\s*c|ascorb/.test(ev);
  if (/retinol/.test(f) && usedVitC && !usedRetinol) return true;
  if (/vitamin\s*c|ascorb/.test(f) && /retinol\s+\d/.test(ev) && !usedVitC) {
    return true;
  }
  return false;
}

function consumerOnly(ev: string) {
  const measured =
    /instrument|corneometer|profilometr|cutometer|wrinkle volume|\bp\s*[<≤]|significant/.test(
      ev,
    );
  const vibe = /loved|glow|felt younger|questionnaire|self-assess/.test(ev);
  return vibe && !measured;
}
