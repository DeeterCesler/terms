import { describe, it, expect } from 'vitest';
import {
  AnalysisResultSchema,
  RecruitmentAnalysisResultSchema,
  HipaaAnalysisResultSchema,
} from './analysis.js';

const finding = { value: true, evidence: 'because the policy says so' };

const basePrivacyResult = {
  shares_with_third_parties: finding,
  sells_data: finding,
  data_anonymized: finding,
  data_retention: '90 days',
  user_rights: ['access', 'deletion'],
  overall_score: 7,
  summary: 'A fine policy.',
};

describe('AnalysisResultSchema no_meaningful_policy', () => {
  it('parses pre-existing analyses that omit the field', () => {
    const result = AnalysisResultSchema.parse(basePrivacyResult);
    expect(result.no_meaningful_policy).toBeUndefined();
  });

  it('accepts an explicit true', () => {
    const result = AnalysisResultSchema.parse({ ...basePrivacyResult, no_meaningful_policy: true });
    expect(result.no_meaningful_policy).toBe(true);
  });

  it('accepts an explicit false', () => {
    const result = AnalysisResultSchema.parse({ ...basePrivacyResult, no_meaningful_policy: false });
    expect(result.no_meaningful_policy).toBe(false);
  });

  it('rejects a non-boolean value', () => {
    expect(() =>
      AnalysisResultSchema.parse({ ...basePrivacyResult, no_meaningful_policy: 'yes' })
    ).toThrow();
  });
});

describe('RecruitmentAnalysisResultSchema', () => {
  const baseRecruitmentResult = {
    sells_or_shares_for_advertising: finding,
    collects_sensitive_information: finding,
    background_checks: finding,
    ai_or_automated_tools: finding,
    third_party_data_sources: finding,
    shares_with_affiliates: finding,
    international_transfers: finding,
    data_retention: '2 years post-application',
    applicant_rights: ['access', 'correction'],
    overall_score: 6,
    summary: 'A recruitment notice.',
  };

  it('accepts a fully-populated recruitment result', () => {
    const result = RecruitmentAnalysisResultSchema.parse(baseRecruitmentResult);
    expect(result.overall_score).toBe(6);
    expect(result.applicant_rights).toEqual(['access', 'correction']);
  });

  it('accepts null data_retention', () => {
    const result = RecruitmentAnalysisResultSchema.parse({ ...baseRecruitmentResult, data_retention: null });
    expect(result.data_retention).toBeNull();
  });

  it('accepts an optional highlights array', () => {
    const result = RecruitmentAnalysisResultSchema.parse({
      ...baseRecruitmentResult,
      highlights: [{ kind: 'bad', text: 'Shares data with third-party recruiters.' }],
    });
    expect(result.highlights).toHaveLength(1);
  });

  it('rejects a result missing a required field (background_checks)', () => {
    const { background_checks, ...withoutBackgroundChecks } = baseRecruitmentResult;
    expect(() => RecruitmentAnalysisResultSchema.parse(withoutBackgroundChecks)).toThrow();
  });

  it('rejects an overall_score outside 1-10', () => {
    expect(() =>
      RecruitmentAnalysisResultSchema.parse({ ...baseRecruitmentResult, overall_score: 11 })
    ).toThrow();
  });

  it('does not accept privacy-lens fields in place of its own (shares_with_third_parties is not a substitute)', () => {
    const { sells_or_shares_for_advertising, ...rest } = baseRecruitmentResult;
    const wrongShape = { ...rest, shares_with_third_parties: finding };
    expect(() => RecruitmentAnalysisResultSchema.parse(wrongShape)).toThrow();
  });
});

describe('HipaaAnalysisResultSchema', () => {
  const baseHipaaResult = {
    underwriting_use: finding,
    plan_sponsor_disclosure: finding,
    marketing_requires_authorization: finding,
    sensitive_category_protections: finding,
    information_exchange_reporting: finding,
    restriction_requests_binding: finding,
    accounting_of_disclosures: finding,
    state_law_rights: finding,
    data_retention: '6 years',
    exercise_mechanism: 'Written request by mail',
    member_rights: ['access', 'amendment'],
    covered_entities: ['Golden Rule Insurance Company'],
    overall_score: 6,
    summary: 'A standard HIPAA notice.',
  };

  it('parses a complete result', () => {
    const result = HipaaAnalysisResultSchema.parse(baseHipaaResult);
    expect(result.overall_score).toBe(6);
    expect(result.covered_entities).toHaveLength(1);
  });

  it('accepts a null data_retention and exercise_mechanism', () => {
    const result = HipaaAnalysisResultSchema.parse({
      ...baseHipaaResult,
      data_retention: null,
      exercise_mechanism: null,
    });
    expect(result.data_retention).toBeNull();
    expect(result.exercise_mechanism).toBeNull();
  });

  it('rejects a missing finding', () => {
    const { information_exchange_reporting, ...withoutMib } = baseHipaaResult;
    expect(() => HipaaAnalysisResultSchema.parse(withoutMib)).toThrow();
  });

  it('rejects an out-of-range score', () => {
    expect(() => HipaaAnalysisResultSchema.parse({ ...baseHipaaResult, overall_score: 0 })).toThrow();
  });

  it('rejects a privacy result in its place', () => {
    expect(() => HipaaAnalysisResultSchema.parse(basePrivacyResult)).toThrow();
  });
});
