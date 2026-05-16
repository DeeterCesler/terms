import 'dotenv/config';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });

const BASE = `http://localhost:3000`;
const SECRET = process.env.ADMIN_SECRET!;

const headers = {
  'Content-Type': 'application/json',
  'X-Admin-Secret': SECRET,
};

const PRIVACY: Array<{ domain: string; name: string; product?: string; priority?: number }> = [
  { domain: 'google.com',        name: 'Google',         priority: 1 },
  { domain: 'youtube.com',       name: 'YouTube',        priority: 1 },
  { domain: 'facebook.com',      name: 'Meta',           priority: 1 },
  { domain: 'instagram.com',     name: 'Meta',           product: 'Instagram', priority: 1 },
  { domain: 'chatgpt.com',       name: 'OpenAI',         product: 'ChatGPT',   priority: 1 },
  { domain: 'x.com',             name: 'X (Twitter)',    priority: 1 },
  { domain: 'reddit.com',        name: 'Reddit',         priority: 1 },
  { domain: 'bing.com',          name: 'Microsoft',      product: 'Bing',      priority: 2 },
  { domain: 'whatsapp.com',      name: 'Meta',           product: 'WhatsApp',  priority: 1 },
  { domain: 'wikipedia.org',     name: 'Wikimedia',      priority: 2 },
  { domain: 'tiktok.com',        name: 'TikTok',         priority: 1 },
  { domain: 'yahoo.com',         name: 'Yahoo',          priority: 2 },
  { domain: 'gemini.google.com', name: 'Google',         product: 'Gemini',    priority: 1 },
  { domain: 'amazon.com',        name: 'Amazon',         priority: 1 },
  { domain: 'linkedin.com',      name: 'LinkedIn',       priority: 1 },
  { domain: 'netflix.com',       name: 'Netflix',        priority: 2 },
  { domain: 'pinterest.com',     name: 'Pinterest',      priority: 2 },
  { domain: 'microsoft.com',     name: 'Microsoft',      priority: 1 },
  { domain: 'office.com',        name: 'Microsoft',      product: 'Office',    priority: 2 },
  { domain: 'twitch.tv',         name: 'Twitch',         priority: 2 },
  { domain: 'canva.com',         name: 'Canva',          priority: 3 },
  { domain: 'weather.com',       name: 'The Weather Company', priority: 4 },
  { domain: 'fandom.com',        name: 'Fandom',         priority: 4 },
  { domain: 'nytimes.com',       name: 'The New York Times', priority: 3 },
  { domain: 'duckduckgo.com',    name: 'DuckDuckGo',     priority: 3 },
  { domain: 'zoom.us',           name: 'Zoom',           priority: 2 },
  { domain: 'ebay.com',          name: 'eBay',           priority: 2 },
  { domain: 'github.com',        name: 'GitHub',         priority: 2 },
  { domain: 'claude.ai',         name: 'Anthropic',      product: 'Claude',    priority: 1 },
  { domain: 'discord.com',       name: 'Discord',        priority: 2 },
  { domain: 'apple.com',         name: 'Apple',          priority: 1 },
  { domain: 'bbc.com',           name: 'BBC',            priority: 3 },
  { domain: 'booking.com',       name: 'Booking.com',    priority: 3 },
  { domain: 'spotify.com',       name: 'Spotify',        priority: 2 },
  { domain: 'aliexpress.com',    name: 'AliExpress',     priority: 3 },
  { domain: 'instructure.com',   name: 'Canvas / Instructure', priority: 3 },
  { domain: 'roblox.com',        name: 'Roblox',         priority: 3 },
  { domain: 'cnn.com',           name: 'CNN',            priority: 3 },
  { domain: 'brave.com',         name: 'Brave',          priority: 3 },
  { domain: 'espn.com',          name: 'ESPN',           priority: 3 },
  { domain: 'walmart.com',       name: 'Walmart',        priority: 2 },
  { domain: 'imdb.com',          name: 'IMDB',           priority: 3 },
  { domain: 'msn.com',           name: 'Microsoft',      product: 'MSN',       priority: 4 },
  { domain: 'paypal.com',        name: 'PayPal',         priority: 2 },
  { domain: 'indeed.com',        name: 'Indeed',         priority: 3 },
  { domain: 'etsy.com',          name: 'Etsy',           priority: 3 },
  { domain: 'adobe.com',         name: 'Adobe',          priority: 2 },
  { domain: 'disneyplus.com',    name: 'Disney',         product: 'Disney+',   priority: 2 },
  { domain: 'deepseek.com',      name: 'DeepSeek',       priority: 2 },
  { domain: 'theguardian.com',   name: 'The Guardian',   priority: 4 },
  { domain: 'zillow.com',        name: 'Zillow',         priority: 3 },
  { domain: 'shein.com',         name: 'SHEIN',          priority: 3 },
  { domain: 'grok.com',          name: 'xAI',            product: 'Grok',      priority: 2 },
  { domain: 'quora.com',         name: 'Quora',          priority: 4 },
  { domain: 'temu.com',          name: 'Temu',           priority: 3 },
  { domain: 'samsung.com',       name: 'Samsung',        priority: 3 },
  { domain: 'bilibili.com',      name: 'Bilibili',       priority: 4 },
  { domain: 'telegram.org',      name: 'Telegram',       priority: 2 },
  { domain: 'hbomax.com',        name: 'HBO Max',        priority: 3 },
  { domain: 'indiatimes.com',    name: 'Times of India', priority: 5 },
  { domain: 'namu.wiki',         name: 'Namu Wiki',      priority: 5 },
  { domain: 'usps.com',          name: 'USPS',           priority: 4 },
  { domain: 'live.com',          name: 'Microsoft',      product: 'Outlook/Live', priority: 3 },
  { domain: 'rakuten.co.jp',     name: 'Rakuten',        priority: 4 },
  { domain: 'naver.com',         name: 'Naver',          priority: 4 },
];

// These high-impact sites also get a ToS entry
const ALSO_TOS = [
  'google.com', 'youtube.com', 'facebook.com', 'instagram.com', 'chatgpt.com',
  'x.com', 'reddit.com', 'whatsapp.com', 'tiktok.com', 'amazon.com',
  'linkedin.com', 'microsoft.com', 'apple.com', 'github.com', 'discord.com',
  'spotify.com', 'netflix.com', 'paypal.com', 'zoom.us', 'claude.ai',
  'gemini.google.com', 'deepseek.com', 'grok.com', 'twitch.tv', 'ebay.com',
  'etsy.com', 'walmart.com', 'roblox.com', 'adobe.com', 'disneyplus.com',
];

async function add(body: object) {
  const res = await fetch(`${BASE}/admin/candidates`, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json() as any;
  if (res.status === 201) {
    console.log(`  ✓  ${(body as any).domain}  [${(body as any).policyType}]`);
  } else if (res.status === 409 || data?.candidate) {
    console.log(`  –  ${(body as any).domain} already exists`);
  } else {
    console.log(`  ✗  ${(body as any).domain}: ${JSON.stringify(data?.error ?? data)}`);
  }
}

async function run() {
  console.log(`\nAdding ${PRIVACY.length} privacy policy candidates...`);
  for (const s of PRIVACY) {
    await add({ domain: s.domain, name: s.name, product: s.product ?? null, policyType: 'privacy_policy', priority: s.priority ?? 5 });
  }

  const tosSites = PRIVACY.filter(s => ALSO_TOS.includes(s.domain));
  console.log(`\nAdding ${tosSites.length} terms of service candidates...`);
  for (const s of tosSites) {
    await add({ domain: s.domain, name: s.name, product: s.product ?? null, policyType: 'terms_of_service', priority: s.priority ?? 5 });
  }

  console.log('\nDone.');
}

run().catch(err => { console.error(err); process.exit(1); });
