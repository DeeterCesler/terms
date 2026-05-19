import { z } from 'zod';

export const FindingSchema = z.object({
  value: z.boolean().nullable(),
  evidence: z.string().nullable(),
});

export const HighlightSchema = z.object({
  kind: z.enum(['good', 'bad']),
  text: z.string().min(1),
});

export const AnalysisResultSchema = z.object({
  shares_with_third_parties: FindingSchema,
  sells_data: FindingSchema,
  data_anonymized: FindingSchema,
  data_retention: z.string().nullable(),
  user_rights: z.array(z.string()),
  overall_score: z.number().int().min(1).max(10),
  summary: z.string(),
  highlights: z.array(HighlightSchema).optional(),
});

export type Finding = z.infer<typeof FindingSchema>;
export type Highlight = z.infer<typeof HighlightSchema>;
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export const SCORE_TIERS = {
  GOOD: { min: 8, max: 10, label: 'Good', color: '#22c55e' },
  FAIR: { min: 5, max: 7, label: 'Fair', color: '#f59e0b' },
  POOR: { min: 1, max: 4, label: 'Poor', color: '#ef4444' },
} as const;

export function getScoreTier(score: number) {
  if (score >= SCORE_TIERS.GOOD.min) return SCORE_TIERS.GOOD;
  if (score >= SCORE_TIERS.FAIR.min) return SCORE_TIERS.FAIR;
  return SCORE_TIERS.POOR;
}

export const PROMPT_VERSION = '1.0.0';
