import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { PrismaService } from '../prisma';
import { AssessClaimDto } from './assess.dto';

@Injectable()
export class ClaimsService {
  constructor(private readonly db: PrismaService) {}

  async listProducts() {
    const rows = await this.db.claim.findMany({
      orderBy: { updatedAt: 'desc' },
      select: { productName: true, formula: true },
    });
    const seen = new Set<string>();
    const out: { name: string; formula: string | null }[] = [];
    for (const r of rows) {
      const name = r.productName?.trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      out.push({ name, formula: r.formula });
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

  async assess(dto: AssessClaimDto) {
    const claim = await this.db.claim.create({
      data: {
        claimText: dto.claimText,
        productName: dto.productName,
        formula: dto.formula,
      },
    });

    const judged = await this.askModel(dto);

    const assessment = await this.db.assessment.create({
      data: {
        claimId: claim.id,
        evidence: dto.evidence,
        justified: judged.justified,
        confidence: judged.confidence,
        reasoning: judged.reasoning,
        model: judged.model,
      },
    });

    return { claim, assessment };
  }

  private async askModel(dto: AssessClaimDto) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return this.fallback(dto);

    const openai = new OpenAI({ apiKey: key });
    try {
      const res = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You check whether a clinical write-up actually supports a cosmetic claim. Be picky about the numbers, the duration, and what was measured. If the study is shorter than the claim, that is a no. Do not invent stats. JSON only: {"justified":boolean,"confidence":number,"reasoning":string}. confidence is 0 to 1.',
          },
          {
            role: 'user',
            content: `Claim: ${dto.claimText}\nProduct: ${dto.productName ?? 'n/a'}\nFormula: ${dto.formula ?? 'n/a'}\n\nEvidence:\n${dto.evidence}`,
          },
        ],
      });

      const parsed = JSON.parse(res.choices[0]?.message?.content || '{}');
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
        model: 'gpt-4o-mini',
      };
    } catch {
      throw new HttpException('model call failed', HttpStatus.BAD_GATEWAY);
    }
  }

  private fallback(dto: AssessClaimDto) {
    const ev = dto.evidence.toLowerCase();
    const cl = dto.claimText.toLowerCase();
    const evPct = ev.match(/(\d+(?:\.\d+)?)\s*%/);
    const clPct = cl.match(/(\d+(?:\.\d+)?)\s*%/);
    const evWeeks = ev.match(/(\d+)\s*weeks?/);
    const clWeeks = cl.match(/(\d+)\s*weeks?/);
    const hasStats = /\bp\s*[<≤]/.test(ev) || ev.includes('significant');
    const weeksMatch = !!(clWeeks && evWeeks && clWeeks[1] === evWeeks[1]);
    const pctOk =
      !!(evPct && clPct && Number(evPct[1]) >= Number(clPct[1]) * 0.8);

    if (weeksMatch && pctOk && hasStats) {
      return {
        justified: true,
        confidence: 0.72,
        reasoning:
          'No API key, so this is a rough local check. Duration and magnitude roughly line up and there is some stats language. Still needs a person to sign off.',
        model: 'local-fallback',
      };
    }

    if (!weeksMatch) {
      return {
        justified: false,
        confidence: 0.4,
        reasoning:
          'No API key, so this is a rough local check. Study duration does not clearly match the claim window.',
        model: 'local-fallback',
      };
    }

    return {
      justified: false,
      confidence: 0.38,
      reasoning:
        'No API key, so this is a rough local check. Numbers or stats look thin against the claim wording.',
      model: 'local-fallback',
    };
  }
}
