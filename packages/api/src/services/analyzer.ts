import Anthropic from '@anthropic-ai/sdk';
import type { PromptCachingBetaTextBlockParam } from '@anthropic-ai/sdk/resources/beta/prompt-caching/messages.js';
import { AnalysisResultSchema, PROMPT_VERSION, type AnalysisResult } from '@term-checker/shared';
import { config } from '../config.js';

const client = new Anthropic({ apiKey: config.anthropicApiKey });
const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are a privacy policy analyst. You will be given the text of a privacy policy or terms of service document. Analyze it and return ONLY a valid JSON object — no prose, no markdown fences, no explanation.

The JSON must exactly match this schema:
{
  "shares_with_third_parties": { "value": boolean | null, "evidence": string | null },
  "sells_data": { "value": boolean | null, "evidence": string | null },
  "data_anonymized": { "value": boolean | null, "evidence": string | null },
  "data_retention": string | null,
  "user_rights": string[],
  "overall_score": number (integer 1-10, where 10 = best privacy protection),
  "summary": string (2-3 sentences)
}

Scoring guide:
- 9-10: No 3rd party sharing, no selling, strong user rights, clear retention
- 7-8: Limited sharing for services only, no selling, decent user rights
- 5-6: Shares with partners/affiliates, unclear on selling, basic user rights
- 3-4: Broad sharing, possible data selling, weak user rights
- 1-2: Sells data, extensive sharing, no meaningful user rights

For "evidence" fields: quote the most relevant sentence or phrase from the policy (max 200 chars). Use null if you cannot find evidence.
For "user_rights": list specific rights mentioned (e.g. "right to deletion", "data portability", "opt-out of sale", "access your data"). Empty array if none mentioned.
For "data_retention": describe the retention period in plain English (e.g. "90 days after account deletion", "as long as account is active", "not specified"). null if completely absent.`;

const CACHED_SYSTEM: PromptCachingBetaTextBlockParam = {
  type: 'text',
  text: SYSTEM_PROMPT,
  cache_control: { type: 'ephemeral' },
};

export interface AnalyzeResult {
  result: AnalysisResult;
  rawResponse: unknown;
  modelUsed: string;
  promptVersion: string;
}

function stripJsonFences(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

export async function analyzePolicy(policyText: string): Promise<AnalyzeResult> {
  const message = await client.beta.promptCaching.messages.create({
    model: MODEL,
    max_tokens: 1024,
    temperature: 0,
    system: [CACHED_SYSTEM],
    messages: [
      {
        role: 'user',
        content: `Analyze the following privacy policy:\n\n${policyText}`,
      },
    ],
  });

  const rawResponse = message;
  const textContent = message.content.find(c => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('Claude returned no text content');
  }

  const cleaned = stripJsonFences(textContent.text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Failed to parse Claude response as JSON: ${(err as Error).message}\nRaw: ${textContent.text.slice(0, 500)}`);
  }

  const validated = AnalysisResultSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`Claude response failed schema validation: ${validated.error.message}\nRaw: ${textContent.text.slice(0, 500)}`);
  }

  return {
    result: validated.data,
    rawResponse,
    modelUsed: MODEL,
    promptVersion: PROMPT_VERSION,
  };
}
