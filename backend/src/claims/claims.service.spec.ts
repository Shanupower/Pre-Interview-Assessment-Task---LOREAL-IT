import { ClaimsService } from './claims.service';

function dbMock(claimRow: object) {
  return {
    claim: {
      create: jest.fn().mockResolvedValue(claimRow),
      findUnique: jest.fn().mockResolvedValue(claimRow),
    },
    assessment: {
      create: jest.fn().mockResolvedValue({ id: 'a1', ...claimRow }),
    },
  };
}

describe('ClaimsService', () => {
  it('scientist can submit a claim without a study', async () => {
    const row = { id: 'c1', claimText: 'Reduces wrinkles by 20% in 4 weeks' };
    const db = {
      claim: { create: jest.fn().mockResolvedValue(row) },
    };
    const out = await new ClaimsService(db as never).submit({
      productName: 'Revitalift',
      formula: 'retinol 0.3%',
      claimText: 'Reduces wrinkles by 20% in 4 weeks',
    });
    expect(db.claim.create).toHaveBeenCalled();
    expect(out.id).toBe('c1');
  });

  it('saves justified / confidence / reasoning from the model pass', async () => {
    delete process.env.OPENAI_API_KEY;
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));

    const claimRow = {
      id: 'c1',
      claimText: 'Reduces wrinkles by 20% in 4 weeks',
      productName: 'Revitalift',
      formula: 'retinol 0.3%',
    };
    const db = dbMock(claimRow);
    db.assessment.create.mockResolvedValue({
      id: 'a1',
      justified: true,
      confidence: 0.72,
      reasoning: 'ok',
    });

    const svc = new ClaimsService(db as never);
    const out = await svc.assess({
      productName: 'Revitalift',
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
    expect(out.assessment.justified).toBe(true);
  });

  it('does not treat retinol 0.3% as the clinical result', async () => {
    delete process.env.OPENAI_API_KEY;
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    const claimRow = {
      id: 'c1',
      claimText: 'Reduces wrinkles by 20% in 4 weeks',
      productName: 'Revitalift',
      formula: 'retinol 0.3%',
    };
    const db = dbMock(claimRow);
    await new ClaimsService(db as never).assess({
      productName: 'Revitalift',
      formula: 'retinol 0.3%',
      claimText: 'Reduces wrinkles by 20% in 4 weeks',
      evidence:
        'Split-face instrumental study, 72 women, retinol 0.3% vs vehicle, 4 weeks. Mean wrinkle volume -22%, p<0.05.',
    });
    expect(db.assessment.create.mock.calls[0][0].data.justified).toBe(true);
  });

  it('does not justify a wrinkle claim with a hydration study', async () => {
    delete process.env.OPENAI_API_KEY;
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    const claimRow = {
      id: 'c1',
      claimText: 'Reduces wrinkles by 20% in 4 weeks',
      productName: 'Revitalift',
      formula: 'retinol 0.3%',
    };
    const db = dbMock(claimRow);
    await new ClaimsService(db as never).assess({
      ...claimRow,
      evidence:
        'Corneometer study, 48 women, 4 weeks, retinol 0.3% vs vehicle. Skin hydration +22%, p<0.05. No wrinkle measure.',
    });
    expect(db.assessment.create.mock.calls[0][0].data.justified).toBe(false);
  });

  it('does not justify a 20% claim with a 12% result', async () => {
    delete process.env.OPENAI_API_KEY;
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    const claimRow = {
      id: 'c1',
      claimText: 'Reduces wrinkles by 20% in 4 weeks',
      productName: 'Revitalift',
      formula: 'retinol 0.3%',
    };
    const db = dbMock(claimRow);
    await new ClaimsService(db as never).assess({
      ...claimRow,
      evidence:
        'Instrumental wrinkle study, 80 women, 4 weeks, retinol 0.3% vs vehicle. Mean wrinkle volume -12%, p<0.05.',
    });
    expect(db.assessment.create.mock.calls[0][0].data.justified).toBe(false);
  });

  it('does not justify consumer glow quotes against a wrinkle %', async () => {
    delete process.env.OPENAI_API_KEY;
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    const claimRow = {
      id: 'c1',
      claimText: 'Reduces wrinkles by 20% in 4 weeks',
      productName: 'Revitalift',
      formula: 'retinol 0.3%',
    };
    const db = dbMock(claimRow);
    await new ClaimsService(db as never).assess({
      ...claimRow,
      evidence:
        'After 4 weeks, 9 out of 10 women said they loved the glow and felt younger. Self-assessment questionnaire only. No instrumental wrinkle data.',
    });
    expect(db.assessment.create.mock.calls[0][0].data.justified).toBe(false);
  });

  it('does not justify a retinol claim with a vitamin C study', async () => {
    delete process.env.OPENAI_API_KEY;
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    const claimRow = {
      id: 'c1',
      claimText: 'Reduces wrinkles by 20% in 4 weeks',
      productName: 'Revitalift',
      formula: 'retinol 0.3%',
    };
    const db = dbMock(claimRow);
    await new ClaimsService(db as never).assess({
      ...claimRow,
      evidence:
        'Instrumental study of a 15% vitamin C serum, 70 women, 4 weeks. Wrinkle volume -23% vs vehicle, p<0.05. Not a retinol formula.',
    });
    expect(db.assessment.create.mock.calls[0][0].data.justified).toBe(false);
  });

  it('accepts a 4-week readout inside a longer study', async () => {
    delete process.env.OPENAI_API_KEY;
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    const claimRow = {
      id: 'c1',
      claimText: 'Reduces wrinkles by 20% in 4 weeks',
      productName: 'Revitalift',
      formula: 'retinol 0.3%',
    };
    const db = dbMock(claimRow);
    await new ClaimsService(db as never).assess({
      ...claimRow,
      evidence:
        '12-week instrumental study, 90 women, retinol 0.3% vs vehicle. At week 4, wrinkle volume -21%, p<0.05. At week 12, -28%, p<0.01.',
    });
    expect(db.assessment.create.mock.calls[0][0].data.justified).toBe(true);
  });

  it('rejects a longer study that never reports the claimed timepoint', async () => {
    delete process.env.OPENAI_API_KEY;
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    const claimRow = {
      id: 'c1',
      claimText: 'Reduces wrinkles by 20% in 4 weeks',
      productName: 'Revitalift',
      formula: 'retinol 0.3%',
    };
    const db = dbMock(claimRow);
    await new ClaimsService(db as never).assess({
      ...claimRow,
      evidence:
        '12-week instrumental study, 90 women, retinol 0.3% vs vehicle. Only a week-12 readout: wrinkle volume -28%, p<0.01. No 4-week timepoint reported.',
    });
    expect(db.assessment.create.mock.calls[0][0].data.justified).toBe(false);
  });

  it('can justify an unquantified hydration claim', async () => {
    delete process.env.OPENAI_API_KEY;
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    const claimRow = {
      id: 'c1',
      claimText: 'Improves skin hydration in 2 weeks',
      productName: 'Revitalift',
      formula: 'HA 1%',
    };
    const db = dbMock(claimRow);
    await new ClaimsService(db as never).assess({
      ...claimRow,
      evidence:
        'Corneometer study, 48 women, HA 1% vs vehicle, 2 weeks. Hydration +18% vs vehicle, p<0.05.',
    });
    expect(db.assessment.create.mock.calls[0][0].data.justified).toBe(true);
  });

  it('does not justify a 4-week claim with a 2-week study', async () => {
    delete process.env.OPENAI_API_KEY;
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));

    const claimRow = {
      id: 'c1',
      claimText: 'Reduces wrinkles by 20% in 4 weeks',
      productName: 'Revitalift',
      formula: null,
    };
    const db = dbMock(claimRow);

    await new ClaimsService(db as never).assess({
      productName: 'Revitalift',
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
