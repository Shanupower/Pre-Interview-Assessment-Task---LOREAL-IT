import { ClaimsService } from './claims.service';

describe('ClaimsService', () => {
  it('saves justified / confidence / reasoning from the model pass', async () => {
    delete process.env.OPENAI_API_KEY;
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));

    const claimRow = { id: 'c1' };
    const assessmentRow = { id: 'a1', justified: true, confidence: 0.72, reasoning: 'ok' };
    const db = {
      claim: { create: jest.fn().mockResolvedValue(claimRow) },
      assessment: { create: jest.fn().mockResolvedValue(assessmentRow) },
    };

    const svc = new ClaimsService(db as never);
    const out = await svc.assess({
      claimText: 'Reduces wrinkles by 20% in 4 weeks',
      evidence:
        'Split-face instrumental study in 72 women over 4 weeks. Mean wrinkle volume down 22% vs vehicle, p<0.05.',
      formula: 'retinol 0.3%',
    });

    const saved = db.assessment.create.mock.calls[0][0].data;
    expect(saved.claimId).toBe('c1');
    expect(typeof saved.justified).toBe('boolean');
    expect(typeof saved.confidence).toBe('number');
    expect(saved.reasoning.length).toBeGreaterThan(10);
    expect(out.assessment).toEqual(assessmentRow);
  });

  it('does not justify a 4-week claim with a 2-week study', async () => {
    delete process.env.OPENAI_API_KEY;
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));

    const db = {
      claim: { create: jest.fn().mockResolvedValue({ id: 'c1' }) },
      assessment: { create: jest.fn().mockResolvedValue({ id: 'a1' }) },
    };

    const svc = new ClaimsService(db as never);
    await svc.assess({
      claimText: 'Reduces wrinkles by 20% in 4 weeks',
      evidence:
        'Instrumental study in 64 women over 2 weeks. Wrinkle volume down 21%, p<0.05.',
    });

    expect(db.assessment.create.mock.calls[0][0].data.justified).toBe(false);
  });

  it('lists each product once', async () => {
    const db = {
      claim: {
        findMany: jest.fn().mockResolvedValue([
          { productName: 'Revitalift', formula: 'a' },
          { productName: 'Revitalift', formula: 'b' },
          { productName: ' Else ', formula: 'c' },
        ]),
      },
    };

    const names = (await new ClaimsService(db as never).listProducts()).map(
      (p) => p.name,
    );
    expect(names).toEqual(['Revitalift', 'Else']);
  });
});
