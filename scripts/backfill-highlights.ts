/**
 * One-off backfill: add `highlights` to the 40 analysis JSONs in /tmp/bucket2
 * AND update the existing `policy_analyses` rows in place.
 *
 * Idempotent: rerunning replaces the highlights for each listed policy_id.
 * Sites not in the table below are left with NULL highlights.
 *
 * Usage: npx tsx scripts/backfill-highlights.ts [--dry-run]
 */
import 'dotenv/config';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { pool } from '../packages/api/src/db/client.js';
import type { Highlight } from '../packages/shared/src/index.js';

type Entry = {
  policyId: string;
  jsonPath: string;
  highlights: Highlight[];
};

const BUCKET = '/tmp/bucket2';

const ENTRIES: Entry[] = [
  // Batch 1
  {
    policyId: '76875aa1-4694-49ec-9eb6-2d942d7886c3',
    jsonPath: `${BUCKET}/ford.com-analysis.json`,
    highlights: [
      { kind: 'bad', text: 'Explicitly "sells" Geolocation Data (along with Identifiers and Personal Records) under California law.' },
      { kind: 'bad', text: 'May collect Vehicle Location regardless of your location settings (repossession, law enforcement, exigent circumstances).' },
    ],
  },
  {
    policyId: 'f5c91d77-939f-466a-aa8d-80e816a5ce6a',
    jsonPath: `${BUCKET}/verizon.com-analysis.json`,
    highlights: [
      { kind: 'bad', text: 'Custom Experience advertising program is default-on for Verizon Wireless postpaid and small business customers — opt-out required.' },
    ],
  },
  {
    policyId: '4ba57dea-c546-4ee9-9aca-91140011594a',
    jsonPath: `${BUCKET}/docusign.com-analysis.json`,
    highlights: [],
  },
  {
    policyId: 'f175d241-7df3-4929-9750-a9ab06d46895',
    jsonPath: `${BUCKET}/dexcom.com-analysis.json`,
    highlights: [
      { kind: 'good', text: 'Honors Global Privacy Control; commits not to attempt re-identification of de-identified data except as required by law.' },
    ],
  },
  {
    policyId: '086921be-6120-4ca1-a236-0839b405c10c',
    jsonPath: `${BUCKET}/roblox.com-analysis.json`,
    highlights: [
      { kind: 'good', text: 'Users under 18 are excluded from personalized advertising entirely.' },
      { kind: 'good', text: 'COPPA-aligned data minimization for <13 users; SMS program data is never shared, sold, or rented.' },
    ],
  },
  {
    policyId: 'e0ca54df-55e4-49e6-9516-db0dc961d3c0',
    jsonPath: `${BUCKET}/ubereats.com-terms_of_service-analysis.json`,
    highlights: [
      { kind: 'bad', text: 'Requires you to waive attorney-client privilege over documents shared with any Litigation Funder financing your claim.' },
      { kind: 'bad', text: 'Mandatory arbitration with class- and mass-action waivers; no general opt-out.' },
    ],
  },
  {
    policyId: 'b492a74f-8b59-44f3-822d-b88b1a25723f',
    jsonPath: `${BUCKET}/azure.microsoft.com-analysis.json`,
    highlights: [
      { kind: 'bad', text: 'Optional diagnostic data may include browsing history and crash dumps that can incidentally contain user file contents.' },
      { kind: 'good', text: 'Privacy Dashboard centralizes review/export/deletion across all Microsoft products linked to your account.' },
    ],
  },
  {
    policyId: 'c9f7763f-312e-4635-a79b-a6dd9fc031c7',
    jsonPath: `${BUCKET}/plaid.com-analysis.json`,
    highlights: [],
  },
  {
    policyId: 'c9cdb2c0-69c1-4dde-842b-cde1a67d9600',
    jsonPath: `${BUCKET}/segment.com-analysis.json`,
    highlights: [],
  },
  {
    policyId: '9941e29e-2297-40f4-9063-7e8b98619d5b',
    jsonPath: `${BUCKET}/fanduel.com-analysis.json`,
    highlights: [
      { kind: 'bad', text: 'By entering a contest you grant FanDuel and its business partners the right to use your name, voice, likeness, location, and photograph for marketing.' },
      { kind: 'bad', text: 'Perpetual royalty-free sublicensable license to all User Content you post.' },
    ],
  },
  {
    policyId: '3970e690-079f-4fc5-b414-5d324a08ea50',
    jsonPath: `${BUCKET}/betterhelp.com-analysis.json`,
    highlights: [
      { kind: 'good', text: 'Therapy content (sessions, messages, journal entries) is never shared with advertisers and not used for AI/NLU training unless separately agreed.' },
      { kind: 'good', text: 'Analytics and Advertising cookies are opt-in (off by default); no retargeting.' },
    ],
  },
  {
    policyId: '9701bf89-32f4-41c6-ac53-ea9b61f14fb0',
    jsonPath: `${BUCKET}/gusto.com-analysis.json`,
    highlights: [
      { kind: 'good', text: 'Mandatory arbitration in Section 24 is opt-out-able via a separate Arbitration Opt-Out Notice — rare for B2B ToS.' },
    ],
  },
  {
    policyId: '23d005b2-f8a6-4f2c-9726-7a4663d52315',
    jsonPath: `${BUCKET}/ancestry.com-analysis.json`,
    highlights: [
      { kind: 'good', text: 'Will not share Genetic Information with insurers, employers, or third-party marketers; separate explicit consent required to use it for any advertising.' },
      { kind: 'good', text: 'Does not voluntarily provide user data to law enforcement; publishes annual Transparency Report.' },
    ],
  },
  {
    policyId: '585f3307-a1e5-42a1-8846-57907a849be3',
    jsonPath: `${BUCKET}/squareup.com-terms_of_service-analysis.json`,
    highlights: [
      { kind: 'bad', text: 'Square Bitcoin Terms and Neighborhoods on Cash App services "may be automatically enabled" on new seller accounts.' },
      { kind: 'bad', text: 'Section 7 makes Square "the sole arbiter" of any account-ownership dispute, with binding effect on all parties.' },
    ],
  },
  {
    policyId: 'b87b333d-452f-4629-9732-1bb42bdab809',
    jsonPath: `${BUCKET}/elevenlabs.io-analysis.json`,
    highlights: [
      { kind: 'bad', text: 'Grants ElevenLabs a perpetual, irrevocable, sublicensable license to your voice and "other indicia of your persona" for AI training and product development.' },
      { kind: 'bad', text: 'Training opt-out only affects future use — prior training and resulting model weights are not undone.' },
      { kind: 'good', text: '30-day opt-out from mandatory arbitration is available.' },
    ],
  },
  {
    policyId: '14063f33-a185-4c3c-b4b4-0d4dd99a39d0',
    jsonPath: `${BUCKET}/cloud.google.com-analysis.json`,
    highlights: [
      { kind: 'good', text: 'No mandatory arbitration — disputes go to court in Santa Clara County.' },
      { kind: 'good', text: '12 months’ advance notice required before discontinuing any Service unless replaced with materially similar functionality.' },
    ],
  },
  {
    policyId: '53f833f5-cfd8-4e80-8fd1-268a2c267fcb',
    jsonPath: `${BUCKET}/ubereats.com-privacy_policy-analysis.json`,
    highlights: [
      { kind: 'bad', text: 'In-cabin cameras and audio recordings are collected on autonomous-vehicle rides.' },
      { kind: 'bad', text: 'Audience lists (mobile ad ID, hashed email, name) are sold/shared with ad intermediaries — Criteo, Google, Rokt, The Trade Desk, TripleLift.' },
    ],
  },
  {
    policyId: '056574ea-0f64-4617-b8d9-37ac560f7a8f',
    jsonPath: `${BUCKET}/squareup.com-privacy_policy-analysis.json`,
    highlights: [
      { kind: 'bad', text: 'Acknowledges "sold or shared" Usage Data for targeted advertising in the prior 12 months under CCPA.' },
      { kind: 'bad', text: 'DNT signals are NOT honored; GPC is.' },
    ],
  },
  {
    policyId: '79cb36ff-d843-41d7-83ec-b346c6ff5268',
    jsonPath: `${BUCKET}/glassdoor.com-analysis.json`,
    highlights: [
      { kind: 'bad', text: 'Starting April 20, 2026 new users must log in via Indeed; once Glassdoor and Indeed accounts are linked, they cannot be disconnected.' },
      { kind: 'bad', text: 'Sensitive demographic data (race, sexual orientation, religion) is processed for DEI analytics and ad personalization.' },
    ],
  },
  {
    policyId: '2c56db74-336d-46e8-bd8b-df0f19afe810',
    jsonPath: `${BUCKET}/amplitude.com-analysis.json`,
    highlights: [
      { kind: 'good', text: 'Explicit no-automated-decision-making policy: Amplitude does not use personal data for profiling.' },
    ],
  },

  // Batch 2
  {
    policyId: '77719da2-84a9-4383-aa65-fb719a0b3b0c',
    jsonPath: `${BUCKET}/blockchain.com-analysis.json`,
    highlights: [
      { kind: 'bad', text: 'Biometric data (face/ID matching for KYC) flows to third-party verification vendors (Veriff, Sumsub) under their own retention policies.' },
    ],
  },
  {
    policyId: '93b69cb1-2850-4dfd-88be-4529872c10e0',
    jsonPath: `${BUCKET}/box.com-analysis.json`,
    highlights: [
      { kind: 'good', text: 'Box AI will not train on your queries or outputs without explicit consent.' },
      { kind: 'bad', text: 'If your account email is on an organization’s domain and that org establishes a Box relationship, they can take full control of your account after 14 days.' },
    ],
  },
  {
    policyId: 'a3b8a74d-ba9c-4499-902d-e70c11059127',
    jsonPath: `${BUCKET}/ea.com-analysis.json`,
    highlights: [
      { kind: 'bad', text: 'Cross-Play forwards your platform ID and gameplay data to Sony, Microsoft, Nintendo, Valve, or Epic depending on where your match-mates play.' },
      { kind: 'good', text: 'Does not "sell" or "share" personal information of consumers under 16.' },
    ],
  },
  {
    policyId: '576137de-e5a9-4b11-9b4b-a588c1d48b16',
    jsonPath: `${BUCKET}/blackboard.com-analysis.json`,
    highlights: [
      { kind: 'good', text: 'Will not sell or rent your data, and does not use student information for behavioral advertising to students.' },
      { kind: 'good', text: 'ISO 27001/27017/27018/27701, SOC 2, and Future of Privacy Forum member.' },
    ],
  },
  {
    policyId: 'ea60a623-6e6e-4e7b-9a57-b6648c34367d',
    jsonPath: `${BUCKET}/ancestry.com-terms_of_service-analysis.json`,
    highlights: [
      { kind: 'good', text: 'Explicitly prohibits other users from using Ancestry data to train, develop, or fine-tune any AI/ML model.' },
      { kind: 'good', text: 'Mass-arbitration framework uses a 12-case bellwether + mandatory mediation procedure (Ancestry pays) instead of a blanket waiver.' },
    ],
  },
  {
    policyId: 'db9839d9-e516-45d0-a4af-6718017ef811',
    jsonPath: `${BUCKET}/tmobile.com-analysis.json`,
    highlights: [
      { kind: 'bad', text: 'Relevant Ads, Custom Experience, and Audience Measurement programs are default-on (opt-out).' },
      { kind: 'good', text: '2024 Transparency Report: 16,615,412 opt-out-of-sale/share requests received and 100% complied with.' },
    ],
  },
  {
    policyId: '1f4ad8c1-bd1e-4e9d-9f4e-7c2e4ba5e5fd',
    jsonPath: `${BUCKET}/jetbrains.com-analysis.json`,
    highlights: [
      { kind: 'good', text: 'Czech HQ; default Personal Data location is the EU; explicitly does not process health or other sensitive data.' },
      { kind: 'good', text: 'Children under 13: automatic 3-day deletion if parental consent is not received.' },
    ],
  },
  {
    policyId: 'ccceb756-2244-4ee7-a14e-6733f071e186',
    jsonPath: `${BUCKET}/google.com-analysis.json`,
    highlights: [
      { kind: 'good', text: 'No personalized ads based on Drive, Gmail, or Photos content; no personalized ads on sensitive categories (race, religion, sexuality, health).' },
      { kind: 'bad', text: 'Activity on 2M+ non-Google partner sites and apps flows back to Google when those sites use Google Ads or Analytics.' },
    ],
  },
  {
    policyId: 'b4e9675b-92ad-43ab-97fd-76480debc0e5',
    jsonPath: `${BUCKET}/beenverified.com-analysis.json`,
    highlights: [
      { kind: 'bad', text: 'A data broker by design — sells aggregated public-records reports (criminal/civil court records, marriage/divorce, property, vehicle, social media) about individuals.' },
      { kind: 'bad', text: 'Registered under Texas data-broker law with the Texas Secretary of State.' },
    ],
  },
  {
    policyId: 'f0965be5-bade-4600-9448-af9c538370d1',
    jsonPath: `${BUCKET}/cloud.google.com-privacy_policy-analysis.json`,
    highlights: [
      { kind: 'good', text: '180-day default retention for most Service Data; explicit no-sale and no-CCPA-share commitment.' },
    ],
  },
  {
    policyId: '62468d4f-6bbf-4c67-ad3c-bdb8eac57ec2',
    jsonPath: `${BUCKET}/docker.com-analysis.json`,
    highlights: [
      { kind: 'good', text: 'Did not sell or share Californians’ personal info for cross-context behavioral advertising in the past 12 months.' },
      { kind: 'good', text: 'Does not engage in profiling or automated decision-making with legal or similarly significant effects.' },
    ],
  },
  {
    policyId: 'f85def4a-c81e-459e-a478-b9eac4ce182a',
    jsonPath: `${BUCKET}/lastpass.com-analysis.json`,
    highlights: [
      { kind: 'good', text: 'Zero-knowledge architecture: vault data is encrypted with your Master Password before sync; even LastPass cannot decrypt it.' },
      { kind: 'good', text: 'Does not sell personal data — including vault data.' },
    ],
  },
  {
    policyId: 'd1bc95b2-188d-4751-b036-09bbcf1bc99d',
    jsonPath: `${BUCKET}/expressvpn.com-analysis.json`,
    highlights: [
      { kind: 'good', text: 'British Virgin Islands jurisdiction; data not controlled by UK-based parent Kape Technologies and not subject to UK courts.' },
      { kind: 'good', text: 'KPMG-audited no-logs policy — no logging of browsing history, traffic destinations, DNS queries, IP addresses, or connection timestamps.' },
    ],
  },
  {
    policyId: 'ac550939-022d-466a-b317-129505a3c412',
    jsonPath: `${BUCKET}/ibm.com-analysis.json`,
    highlights: [
      { kind: 'good', text: 'Cloud customer data is not used for marketing or advertising without express consent.' },
      { kind: 'good', text: 'Unusual breadth of cross-border transfer mechanisms: BCR-C, DPF, APEC CBPR, and Global CBPR.' },
    ],
  },
  {
    policyId: 'c769f647-fdbe-40f0-a04c-9b439c7cfca2',
    jsonPath: `${BUCKET}/liveramp.com-analysis.json`,
    highlights: [
      { kind: 'bad', text: 'Sells identity-linked personal data (including identifiers, IP-derived location, internet activity, inferences) to advertising networks, social networks, and ad-tech intermediaries.' },
      { kind: 'bad', text: 'Collects SSN and driver’s license numbers for identity-resolution (commits not to make inferences from them).' },
    ],
  },
  {
    policyId: 'd71abb94-9601-48d9-b45b-8af31ed39073',
    jsonPath: `${BUCKET}/healthcare.gov-analysis.json`,
    highlights: [
      { kind: 'good', text: 'Federal Privacy Act of 1974 governs the data; information you provide is never sold.' },
      { kind: 'good', text: 'Do Not Track signals are automatically honored for conversion tracking and retargeting.' },
    ],
  },
  {
    policyId: '95e560fd-a28c-4208-9f33-6ee044b8c59e',
    jsonPath: `${BUCKET}/segment.com-privacy_policy-analysis.json`,
    highlights: [
      { kind: 'good', text: 'Mobile information is never shared or sold to any third party for marketing or promotional purposes.' },
      { kind: 'good', text: 'EU-approved Binding Corporate Rules govern Twilio group transfers.' },
    ],
  },
  {
    policyId: '0811513d-31a8-48df-a791-d7c5920ff258',
    jsonPath: `${BUCKET}/cursor.com-analysis.json`,
    highlights: [
      { kind: 'good', text: 'Anysphere will not use your code or inputs to train any AI model unless you’ve explicitly opted in.' },
      { kind: 'good', text: '30-day opt-out from mandatory arbitration; also can reject any future change to the arbitration agreement within 30 days.' },
    ],
  },
  {
    policyId: 'c8f29153-c4c2-4ffa-b5eb-22605ed5b302',
    jsonPath: `${BUCKET}/braze.com-analysis.json`,
    highlights: [
      { kind: 'good', text: 'Will not attempt to re-identify de-identified data (except to test compliance of the de-identification process).' },
    ],
  },
  {
    policyId: 'a28595a9-9b5a-4334-bfb2-eff8f5cab835',
    jsonPath: `${BUCKET}/nest.com-analysis.json`,
    highlights: [
      { kind: 'good', text: 'For video, audio, and Familiar Face Alerts biometric data, the customer is the controller and Nest is only a processor.' },
      { kind: 'bad', text: 'If used with a Google Account, the Google Privacy Policy governs the data instead of this one.' },
    ],
  },
];

const dryRun = process.argv.includes('--dry-run');

async function main() {
  let jsonsUpdated = 0;
  let rowsUpdated = 0;
  const missing: string[] = [];

  for (const entry of ENTRIES) {
    if (!existsSync(entry.jsonPath)) {
      missing.push(entry.jsonPath);
      continue;
    }

    // Update the JSON file so it stays in sync with the DB row.
    const raw = JSON.parse(readFileSync(entry.jsonPath, 'utf8'));
    const next = { ...raw, highlights: entry.highlights };
    if (!dryRun) {
      writeFileSync(entry.jsonPath, JSON.stringify(next, null, 2) + '\n', 'utf8');
    }
    jsonsUpdated++;

    // Update the existing 'done' policy_analyses row for this policy_id.
    const highlightsJson = entry.highlights.length > 0 ? JSON.stringify(entry.highlights) : null;
    if (!dryRun) {
      const { rowCount } = await pool.query(
        `UPDATE policy_analyses
         SET highlights = $1
         WHERE policy_id = $2 AND status = 'done'`,
        [highlightsJson, entry.policyId]
      );
      if (rowCount && rowCount > 0) rowsUpdated += rowCount;
    } else {
      rowsUpdated++; // best-effort dry-run count
    }
  }

  console.log(`JSONs updated: ${jsonsUpdated}`);
  console.log(`Rows updated:  ${rowsUpdated}${dryRun ? ' (dry-run, no DB writes)' : ''}`);
  if (missing.length > 0) {
    console.log(`Missing JSON files (skipped): ${missing.length}`);
    for (const m of missing) console.log(`  - ${m}`);
  }

  await pool.end();
}

main().catch(async err => {
  console.error(`[backfill-highlights] ${(err as Error).message}`);
  try { await pool.end(); } catch {}
  process.exit(1);
});
