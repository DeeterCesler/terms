import { describe, it, expect } from 'vitest';
import { AnalysisResultSchema } from '@term-checker/shared';

const validResult = {
  shares_with_third_parties: { value: true, evidence: 'We share data with partners.' },
  sells_data: { value: false, evidence: null },
  data_anonymized: { value: null, evidence: null },
  data_retention: '90 days after account deletion',
  user_rights: ['right to deletion', 'data portability'],
  overall_score: 6,
  summary: 'Policy is average. Some sharing with partners but no data sales.',
};

describe('AnalysisResultSchema', () => {
  it('accepts a fully valid result', () => {
    expect(AnalysisResultSchema.safeParse(validResult).success).toBe(true);
  });

  it('accepts null evidence fields', () => {
    const result = {
      ...validResult,
      shares_with_third_parties: { value: null, evidence: null },
    };
    expect(AnalysisResultSchema.safeParse(result).success).toBe(true);
  });

  it('rejects overall_score below 1', () => {
    expect(AnalysisResultSchema.safeParse({ ...validResult, overall_score: 0 }).success).toBe(false);
  });

  it('rejects overall_score above 10', () => {
    expect(AnalysisResultSchema.safeParse({ ...validResult, overall_score: 11 }).success).toBe(false);
  });

  it('rejects a non-integer overall_score', () => {
    expect(AnalysisResultSchema.safeParse({ ...validResult, overall_score: 5.5 }).success).toBe(false);
  });

  it('accepts an empty user_rights array', () => {
    expect(AnalysisResultSchema.safeParse({ ...validResult, user_rights: [] }).success).toBe(true);
  });

  it('rejects missing required fields', () => {
    const { summary: _omit, ...incomplete } = validResult;
    expect(AnalysisResultSchema.safeParse(incomplete).success).toBe(false);
  });

  it('accepts null data_retention', () => {
    expect(AnalysisResultSchema.safeParse({ ...validResult, data_retention: null }).success).toBe(true);
  });
});
