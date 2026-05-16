import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });

const BASE = 'http://localhost:3000';
const SECRET = process.env.ADMIN_SECRET!;
const headers = { 'Content-Type': 'application/json', 'X-Admin-Secret': SECRET };

type PolicyType = 'privacy_policy' | 'terms_of_service' | 'data_processing_agreement' | 'acceptable_use_policy';

interface Candidate {
  domain: string;
  name: string;
  product: string;
  policyType: PolicyType;
  priority: number;
  notes?: string;
}

const CANDIDATES: Candidate[] = [
  // ── Google / Alphabet ──────────────────────────────────────────────────────
  { domain: 'google.com',         name: 'Google',     product: 'Workspace (Enterprise)',  policyType: 'data_processing_agreement', priority: 2, notes: 'Separate DPA for business/enterprise Workspace customers' },
  { domain: 'google.com',         name: 'Google',     product: 'Ads / Advertisers',       policyType: 'privacy_policy',            priority: 2, notes: 'Different data practices for advertisers vs. users' },
  { domain: 'google.com',         name: 'Google',     product: 'Ads / Advertisers',       policyType: 'terms_of_service',          priority: 2 },
  { domain: 'google.com',         name: 'Google',     product: 'Chrome',                  policyType: 'privacy_policy',            priority: 3 },
  { domain: 'google.com',         name: 'Google',     product: 'Play Store',              policyType: 'privacy_policy',            priority: 3 },
  { domain: 'google.com',         name: 'Google',     product: 'Play Store',              policyType: 'terms_of_service',          priority: 3 },
  { domain: 'cloud.google.com',   name: 'Google',     product: 'Cloud',                   policyType: 'privacy_policy',            priority: 2 },
  { domain: 'cloud.google.com',   name: 'Google',     product: 'Cloud',                   policyType: 'terms_of_service',          priority: 2 },

  // ── YouTube creator split ──────────────────────────────────────────────────
  { domain: 'youtube.com',        name: 'YouTube',    product: 'Creator / Partner Program', policyType: 'terms_of_service',        priority: 1, notes: 'Covers monetization, content ownership, ad revenue — very different from viewer ToS' },

  // ── Meta ───────────────────────────────────────────────────────────────────
  { domain: 'threads.net',        name: 'Meta',       product: 'Threads',                 policyType: 'privacy_policy',            priority: 2 },
  { domain: 'threads.net',        name: 'Meta',       product: 'Threads',                 policyType: 'terms_of_service',          priority: 2 },
  { domain: 'meta.com',           name: 'Meta',       product: 'Quest / VR',              policyType: 'privacy_policy',            priority: 2, notes: 'Biometric and spatial data collection is unique to VR' },
  { domain: 'meta.com',           name: 'Meta',       product: 'Quest / VR',              policyType: 'terms_of_service',          priority: 3 },
  { domain: 'meta.com',           name: 'Meta',       product: 'Business Tools / Ads',    policyType: 'privacy_policy',            priority: 1, notes: 'Covers pixel tracking, custom audiences — very different data use from end users' },
  { domain: 'meta.com',           name: 'Meta',       product: 'Business Tools / Ads',    policyType: 'terms_of_service',          priority: 2 },

  // ── Apple ──────────────────────────────────────────────────────────────────
  { domain: 'apple.com',          name: 'Apple',      product: 'iCloud',                  policyType: 'privacy_policy',            priority: 2 },
  { domain: 'apple.com',          name: 'Apple',      product: 'iCloud',                  policyType: 'terms_of_service',          priority: 2 },
  { domain: 'apple.com',          name: 'Apple',      product: 'App Store',               policyType: 'terms_of_service',          priority: 2 },
  { domain: 'apple.com',          name: 'Apple',      product: 'Apple Pay',               policyType: 'privacy_policy',            priority: 1, notes: 'Financial data handling' },
  { domain: 'apple.com',          name: 'Apple',      product: 'Apple Pay',               policyType: 'terms_of_service',          priority: 2 },
  { domain: 'apple.com',          name: 'Apple',      product: 'Apple Music',             policyType: 'terms_of_service',          priority: 3 },
  { domain: 'apple.com',          name: 'Apple',      product: 'Apple TV+',               policyType: 'terms_of_service',          priority: 3 },
  { domain: 'apple.com',          name: 'Apple',      product: 'Apple Intelligence',      policyType: 'privacy_policy',            priority: 1, notes: 'On-device AI with cloud fallback — notable data handling' },
  { domain: 'developer.apple.com', name: 'Apple',     product: 'Developer Program',       policyType: 'terms_of_service',          priority: 3 },

  // ── Microsoft ──────────────────────────────────────────────────────────────
  { domain: 'xbox.com',           name: 'Microsoft',  product: 'Xbox',                    policyType: 'privacy_policy',            priority: 3 },
  { domain: 'xbox.com',           name: 'Microsoft',  product: 'Xbox',                    policyType: 'terms_of_service',          priority: 3 },
  { domain: 'github.com',         name: 'GitHub',     product: 'Copilot',                 policyType: 'privacy_policy',            priority: 1, notes: 'Code sent to AI model — what is retained and how' },
  { domain: 'github.com',         name: 'GitHub',     product: 'Copilot',                 policyType: 'terms_of_service',          priority: 2 },
  { domain: 'azure.microsoft.com', name: 'Microsoft', product: 'Azure',                   policyType: 'privacy_policy',            priority: 2 },
  { domain: 'azure.microsoft.com', name: 'Microsoft', product: 'Azure',                   policyType: 'terms_of_service',          priority: 3 },
  { domain: 'microsoft.com',      name: 'Microsoft',  product: 'Copilot (AI)',            policyType: 'privacy_policy',            priority: 1 },
  { domain: 'microsoft.com',      name: 'Microsoft',  product: 'Copilot (AI)',            policyType: 'terms_of_service',          priority: 2 },
  { domain: 'microsoft.com',      name: 'Microsoft',  product: 'Microsoft 365 Business',  policyType: 'terms_of_service',          priority: 3 },

  // ── Amazon ─────────────────────────────────────────────────────────────────
  { domain: 'amazon.com',         name: 'Amazon',     product: 'Alexa / Echo',            policyType: 'privacy_policy',            priority: 1, notes: 'Always-on voice recording, what is stored and shared' },
  { domain: 'aws.amazon.com',     name: 'Amazon',     product: 'AWS',                     policyType: 'privacy_policy',            priority: 2 },
  { domain: 'aws.amazon.com',     name: 'Amazon',     product: 'AWS',                     policyType: 'terms_of_service',          priority: 3 },
  { domain: 'amazon.com',         name: 'Amazon',     product: 'Kindle',                  policyType: 'terms_of_service',          priority: 4 },
  { domain: 'amazon.com',         name: 'Amazon',     product: 'Prime Video',             policyType: 'terms_of_service',          priority: 3 },
  { domain: 'amazon.com',         name: 'Amazon',     product: 'Amazon Music',            policyType: 'terms_of_service',          priority: 4 },
  { domain: 'amazon.com',         name: 'Amazon',     product: 'Seller / Marketplace',    policyType: 'terms_of_service',          priority: 1, notes: 'Governs what seller data Amazon collects and uses for its own competing products' },
  { domain: 'amazon.com',         name: 'Amazon',     product: 'Advertising',             policyType: 'privacy_policy',            priority: 2 },

  // ── TikTok ─────────────────────────────────────────────────────────────────
  { domain: 'tiktok.com',         name: 'TikTok',     product: 'Creator / TikTok Studio', policyType: 'terms_of_service',         priority: 1, notes: 'Governs content licensing, revenue share, ownership' },
  { domain: 'tiktok.com',         name: 'TikTok',     product: 'TikTok for Business',     policyType: 'privacy_policy',            priority: 2 },
  { domain: 'tiktok.com',         name: 'TikTok',     product: 'TikTok for Business',     policyType: 'terms_of_service',          priority: 2 },

  // ── Twitch ─────────────────────────────────────────────────────────────────
  { domain: 'twitch.tv',          name: 'Twitch',     product: 'Affiliate / Partner',     policyType: 'terms_of_service',          priority: 1, notes: 'Revenue share, payout terms, content ownership for streamers' },

  // ── Spotify ────────────────────────────────────────────────────────────────
  { domain: 'spotify.com',        name: 'Spotify',    product: 'Spotify for Artists',     policyType: 'terms_of_service',          priority: 2, notes: 'Streaming data shared with artists, royalty terms' },
  { domain: 'spotify.com',        name: 'Spotify',    product: 'Spotify for Podcasters',  policyType: 'terms_of_service',          priority: 3 },

  // ── Roblox ─────────────────────────────────────────────────────────────────
  { domain: 'roblox.com',         name: 'Roblox',     product: 'Developer / Creator Hub', policyType: 'terms_of_service',          priority: 2, notes: 'Revenue split on virtual items, IP ownership' },

  // ── Pinterest ──────────────────────────────────────────────────────────────
  { domain: 'pinterest.com',      name: 'Pinterest',  product: 'Pinterest Business / Ads', policyType: 'privacy_policy',           priority: 3 },
  { domain: 'pinterest.com',      name: 'Pinterest',  product: 'Pinterest Business / Ads', policyType: 'terms_of_service',         priority: 3 },

  // ── LinkedIn ───────────────────────────────────────────────────────────────
  { domain: 'linkedin.com',       name: 'LinkedIn',   product: 'Talent Solutions (Recruiters)', policyType: 'privacy_policy',      priority: 2, notes: 'What profile data recruiters can access and export' },
  { domain: 'linkedin.com',       name: 'LinkedIn',   product: 'Marketing Solutions (Ads)',     policyType: 'privacy_policy',      priority: 2 },

  // ── OpenAI ─────────────────────────────────────────────────────────────────
  { domain: 'openai.com',         name: 'OpenAI',     product: 'API (Developers)',         policyType: 'privacy_policy',            priority: 1, notes: 'How prompts/completions are used for training vs. consumer ChatGPT' },
  { domain: 'openai.com',         name: 'OpenAI',     product: 'API (Developers)',         policyType: 'terms_of_service',          priority: 1 },
  { domain: 'openai.com',         name: 'OpenAI',     product: 'ChatGPT Enterprise',       policyType: 'privacy_policy',            priority: 2 },
  { domain: 'openai.com',         name: 'OpenAI',     product: 'ChatGPT Enterprise',       policyType: 'terms_of_service',          priority: 2 },

  // ── Anthropic ──────────────────────────────────────────────────────────────
  { domain: 'anthropic.com',      name: 'Anthropic',  product: 'API (Developers)',         policyType: 'privacy_policy',            priority: 1 },
  { domain: 'anthropic.com',      name: 'Anthropic',  product: 'API (Developers)',         policyType: 'terms_of_service',          priority: 1 },
  { domain: 'anthropic.com',      name: 'Anthropic',  product: 'Claude for Enterprise',    policyType: 'privacy_policy',            priority: 2 },
  { domain: 'anthropic.com',      name: 'Anthropic',  product: 'Claude for Enterprise',    policyType: 'terms_of_service',          priority: 2 },

  // ── Other AI APIs ──────────────────────────────────────────────────────────
  { domain: 'deepseek.com',       name: 'DeepSeek',   product: 'API (Developers)',         policyType: 'privacy_policy',            priority: 1, notes: 'Chinese AI — data residency and government access questions' },
  { domain: 'deepseek.com',       name: 'DeepSeek',   product: 'API (Developers)',         policyType: 'terms_of_service',          priority: 1 },

  // ── Marketplaces: seller splits ────────────────────────────────────────────
  { domain: 'ebay.com',           name: 'eBay',       product: 'Seller',                  policyType: 'terms_of_service',          priority: 1, notes: 'Fee structure, buyer data access, dispute resolution for sellers' },
  { domain: 'etsy.com',           name: 'Etsy',       product: 'Seller',                  policyType: 'terms_of_service',          priority: 1, notes: 'Customer data ownership, Etsy ads, fee practices' },
  { domain: 'booking.com',        name: 'Booking.com', product: 'Property Partner / Host', policyType: 'privacy_policy',           priority: 2, notes: 'What guest data Booking shares back with hosts' },
  { domain: 'booking.com',        name: 'Booking.com', product: 'Property Partner / Host', policyType: 'terms_of_service',         priority: 2 },

  // ── Discord ────────────────────────────────────────────────────────────────
  { domain: 'discord.com',        name: 'Discord',    product: 'Developer Platform',      policyType: 'terms_of_service',          priority: 3, notes: 'Bot and app developer terms, data access from servers' },

  // ── Adobe ──────────────────────────────────────────────────────────────────
  { domain: 'adobe.com',          name: 'Adobe',      product: 'Firefly (AI)',             policyType: 'privacy_policy',            priority: 2, notes: 'AI image generation — training data and content usage' },
  { domain: 'adobe.com',          name: 'Adobe',      product: 'Firefly (AI)',             policyType: 'terms_of_service',          priority: 2 },

  // ── GitHub ─────────────────────────────────────────────────────────────────
  { domain: 'github.com',         name: 'GitHub',     product: 'Marketplace / Apps',      policyType: 'terms_of_service',          priority: 3 },

  // ── PayPal ─────────────────────────────────────────────────────────────────
  { domain: 'paypal.com',         name: 'PayPal',     product: 'Business / Merchant',     policyType: 'privacy_policy',            priority: 2, notes: 'Customer financial data access and sharing for merchants' },
  { domain: 'paypal.com',         name: 'PayPal',     product: 'Business / Merchant',     policyType: 'terms_of_service',          priority: 2 },

  // ── Zoom ───────────────────────────────────────────────────────────────────
  { domain: 'zoom.us',            name: 'Zoom',       product: 'Zoom AI Companion',       policyType: 'privacy_policy',            priority: 1, notes: 'AI meeting summaries — what call content is stored and used for training' },

  // ── Canva ──────────────────────────────────────────────────────────────────
  { domain: 'canva.com',          name: 'Canva',      product: 'Canva for Teams / Enterprise', policyType: 'terms_of_service',     priority: 3 },
];

async function add(c: Candidate) {
  const res = await fetch(`${BASE}/admin/candidates`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      domain: c.domain,
      name: c.name,
      product: c.product,
      policyType: c.policyType,
      priority: c.priority,
      notes: c.notes ?? null,
    }),
  });
  const data = await res.json() as any;
  const label = `${c.domain} / ${c.product} [${c.policyType}]`;
  if (res.status === 201) {
    console.log(`  ✓  ${label}`);
  } else {
    console.log(`  ✗  ${label}: ${JSON.stringify(data?.error ?? data)}`);
  }
}

async function run() {
  console.log(`\nAdding ${CANDIDATES.length} sub-product candidates...\n`);
  for (const c of CANDIDATES) {
    await add(c);
  }
  console.log(`\nDone.`);
}

run().catch(err => { console.error(err); process.exit(1); });
