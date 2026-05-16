import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });

const BASE = 'http://localhost:3000';
const SECRET = process.env.ADMIN_SECRET!;
const headers = { 'Content-Type': 'application/json', 'X-Admin-Secret': SECRET };

type PT = 'privacy_policy' | 'terms_of_service' | 'data_processing_agreement' | 'acceptable_use_policy';
interface C { domain: string; name: string; product?: string; policyType: PT; priority: number; notes?: string; }

const CANDIDATES: C[] = [
  // ── More Google sub-products ───────────────────────────────────────────────
  { domain: 'google.com',          name: 'Google',     product: 'Maps (Platform / API)',   policyType: 'terms_of_service',          priority: 3 },
  { domain: 'google.com',          name: 'Google',     product: 'Search (Personalization)', policyType: 'privacy_policy',           priority: 2 },
  { domain: 'google.com',          name: 'Google',     product: 'Photos',                  policyType: 'privacy_policy',            priority: 2, notes: 'Biometric face data for photo grouping' },
  { domain: 'google.com',          name: 'Google',     product: 'Drive',                   policyType: 'terms_of_service',          priority: 2 },
  { domain: 'google.com',          name: 'Google',     product: 'Android TV / Google TV',  policyType: 'privacy_policy',            priority: 3 },
  { domain: 'google.com',          name: 'Google',     product: 'Shopping',                policyType: 'privacy_policy',            priority: 3 },
  { domain: 'google.com',          name: 'Google',     product: 'Voice',                   policyType: 'privacy_policy',            priority: 2, notes: 'Voice recordings and transcripts' },
  { domain: 'google.com',          name: 'Google',     product: 'Stadia / Game Services',  policyType: 'terms_of_service',          priority: 4 },
  { domain: 'google.com',          name: 'Google',     product: 'Pay',                     policyType: 'privacy_policy',            priority: 2 },
  { domain: 'google.com',          name: 'Google',     product: 'One',                     policyType: 'terms_of_service',          priority: 3 },

  // ── More Apple sub-products ────────────────────────────────────────────────
  { domain: 'apple.com',           name: 'Apple',      product: 'Siri',                    policyType: 'privacy_policy',            priority: 1, notes: 'Voice assistant — audio recordings and queries' },
  { domain: 'apple.com',           name: 'Apple',      product: 'Maps',                    policyType: 'privacy_policy',            priority: 2 },
  { domain: 'apple.com',           name: 'Apple',      product: 'Wallet / Apple Card',     policyType: 'privacy_policy',            priority: 1 },
  { domain: 'apple.com',           name: 'Apple',      product: 'Sign in with Apple',      policyType: 'privacy_policy',            priority: 2 },
  { domain: 'apple.com',           name: 'Apple',      product: 'Vision Pro',              policyType: 'privacy_policy',            priority: 1, notes: 'Eye tracking, spatial data, biometric passthrough' },
  { domain: 'apple.com',           name: 'Apple',      product: 'AirTag / Find My',        policyType: 'privacy_policy',            priority: 2 },
  { domain: 'apple.com',           name: 'Apple',      product: 'Podcasts',                policyType: 'terms_of_service',          priority: 4 },
  { domain: 'apple.com',           name: 'Apple',      product: 'News+',                   policyType: 'privacy_policy',            priority: 3 },

  // ── More Amazon sub-products ───────────────────────────────────────────────
  { domain: 'amazon.com',          name: 'Amazon',     product: 'Prime (Membership)',       policyType: 'terms_of_service',          priority: 2 },
  { domain: 'amazon.com',          name: 'Amazon',     product: 'Fresh / Whole Foods',     policyType: 'privacy_policy',            priority: 3 },
  { domain: 'amazon.com',          name: 'Amazon',     product: 'Pharmacy',                policyType: 'privacy_policy',            priority: 1, notes: 'Prescription data — highly sensitive' },
  { domain: 'amazon.com',          name: 'Amazon',     product: 'One Medical',             policyType: 'privacy_policy',            priority: 1 },
  { domain: 'amazon.com',          name: 'Amazon',     product: 'Associates (Affiliate)',   policyType: 'terms_of_service',          priority: 3 },
  { domain: 'amazon.com',          name: 'Amazon',     product: 'Mechanical Turk',         policyType: 'privacy_policy',            priority: 3 },
  { domain: 'amazon.com',          name: 'Amazon',     product: 'Mechanical Turk',         policyType: 'terms_of_service',          priority: 3 },

  // ── More Meta sub-products ─────────────────────────────────────────────────
  { domain: 'facebook.com',        name: 'Meta',       product: 'Marketplace',             policyType: 'terms_of_service',          priority: 2 },
  { domain: 'facebook.com',        name: 'Meta',       product: 'Groups',                  policyType: 'terms_of_service',          priority: 3 },
  { domain: 'instagram.com',       name: 'Meta',       product: 'Creator / Monetization',  policyType: 'terms_of_service',          priority: 1, notes: 'Subscriptions, badges, revenue share for creators' },
  { domain: 'instagram.com',       name: 'Meta',       product: 'Shop',                    policyType: 'terms_of_service',          priority: 2 },
  { domain: 'whatsapp.com',        name: 'Meta',       product: 'Business API',            policyType: 'terms_of_service',          priority: 2 },

  // ── More Microsoft sub-products ────────────────────────────────────────────
  { domain: 'microsoft.com',       name: 'Microsoft',  product: 'Surface / Hardware',      policyType: 'privacy_policy',            priority: 3 },
  { domain: 'microsoft.com',       name: 'Microsoft',  product: 'Defender',                policyType: 'privacy_policy',            priority: 2, notes: 'Security telemetry sent to Microsoft' },
  { domain: 'microsoft.com',       name: 'Microsoft',  product: 'Windows / Telemetry',     policyType: 'privacy_policy',            priority: 1, notes: 'OS-level data collection — usage, diagnostics, location' },
  { domain: 'microsoft.com',       name: 'Microsoft',  product: 'Edge Browser',            policyType: 'privacy_policy',            priority: 2 },
  { domain: 'microsoft.com',       name: 'Microsoft',  product: 'LinkedIn Learning',       policyType: 'terms_of_service',          priority: 3 },
  { domain: 'microsoft.com',       name: 'Microsoft',  product: 'Power BI',                policyType: 'terms_of_service',          priority: 3 },

  // ── More TikTok sub-products ───────────────────────────────────────────────
  { domain: 'tiktok.com',          name: 'TikTok',     product: 'TikTok Shop',             policyType: 'privacy_policy',            priority: 2 },
  { domain: 'tiktok.com',          name: 'TikTok',     product: 'TikTok Shop',             policyType: 'terms_of_service',          priority: 2 },
  { domain: 'tiktok.com',          name: 'TikTok',     product: 'TikTok Shop / Seller',    policyType: 'terms_of_service',          priority: 2 },
  { domain: 'tiktok.com',          name: 'TikTok',     product: 'TikTok LIVE',             policyType: 'terms_of_service',          priority: 2, notes: 'Gift monetization, virtual currency terms' },

  // ── More Shopify sub-products ──────────────────────────────────────────────
  { domain: 'shopify.com',         name: 'Shopify',    product: 'Shopify Payments',        policyType: 'privacy_policy',            priority: 1 },
  { domain: 'shopify.com',         name: 'Shopify',    product: 'Shopify Balance',         policyType: 'privacy_policy',            priority: 2 },
  { domain: 'shopify.com',         name: 'Shopify',    product: 'Shop App (Consumer)',     policyType: 'privacy_policy',            priority: 2 },
  { domain: 'shopify.com',         name: 'Shopify',    product: 'Shopify Markets',         policyType: 'terms_of_service',          priority: 3 },

  // ── More Stripe sub-products ───────────────────────────────────────────────
  { domain: 'stripe.com',          name: 'Stripe',     product: 'Stripe Atlas',            policyType: 'terms_of_service',          priority: 3 },
  { domain: 'stripe.com',          name: 'Stripe',     product: 'Stripe Identity',         policyType: 'privacy_policy',            priority: 1, notes: 'ID verification — passport, license, selfie data' },
  { domain: 'stripe.com',          name: 'Stripe',     product: 'Stripe Radar',            policyType: 'privacy_policy',            priority: 2 },
  { domain: 'stripe.com',          name: 'Stripe',     product: 'Stripe Climate',          policyType: 'terms_of_service',          priority: 5 },

  // ── More OpenAI sub-products ───────────────────────────────────────────────
  { domain: 'openai.com',          name: 'OpenAI',     product: 'Operator (Agents)',        policyType: 'terms_of_service',          priority: 1, notes: 'Agentic actions taken on behalf of users' },
  { domain: 'openai.com',          name: 'OpenAI',     product: 'DALL-E',                  policyType: 'terms_of_service',          priority: 2 },
  { domain: 'openai.com',          name: 'OpenAI',     product: 'Sora (Video)',             policyType: 'terms_of_service',          priority: 2 },
  { domain: 'openai.com',          name: 'OpenAI',     product: 'GPT Store / Plugins',     policyType: 'terms_of_service',          priority: 2 },
  { domain: 'openai.com',          name: 'OpenAI',     product: 'GPT Builder / Developer', policyType: 'terms_of_service',          priority: 2 },

  // ── More Anthropic sub-products ────────────────────────────────────────────
  { domain: 'anthropic.com',       name: 'Anthropic',  product: 'Claude.ai (Consumer)',    policyType: 'privacy_policy',            priority: 1 },
  { domain: 'anthropic.com',       name: 'Anthropic',  product: 'Claude.ai (Consumer)',    policyType: 'terms_of_service',          priority: 1 },

  // ── Additional B2B / Enterprise ───────────────────────────────────────────
  { domain: 'servicenow.com',      name: 'ServiceNow', policyType: 'privacy_policy',       priority: 3 },
  { domain: 'oracle.com',          name: 'Oracle',     policyType: 'privacy_policy',       priority: 2 },
  { domain: 'oracle.com',          name: 'Oracle',     policyType: 'terms_of_service',     priority: 3 },
  { domain: 'sap.com',             name: 'SAP',        policyType: 'privacy_policy',       priority: 2 },
  { domain: 'ibm.com',             name: 'IBM',        policyType: 'privacy_policy',       priority: 3 },
  { domain: 'ibm.com',             name: 'IBM',        product: 'Watson AI',               policyType: 'privacy_policy',            priority: 2 },
  { domain: 'adobe.com',           name: 'Adobe',      product: 'Creative Cloud (Terms)',  policyType: 'terms_of_service',          priority: 2, notes: 'Controversial AI training clause on user content' },
  { domain: 'adobe.com',           name: 'Adobe',      product: 'Sign / Acrobat',          policyType: 'privacy_policy',            priority: 2 },
  { domain: 'adobe.com',           name: 'Adobe',      product: 'Analytics',               policyType: 'privacy_policy',            priority: 2 },
  { domain: 'adobe.com',           name: 'Adobe',      product: 'Experience Cloud',        policyType: 'data_processing_agreement', priority: 3 },
  { domain: 'zoom.us',             name: 'Zoom',       product: 'Zoom Phone',              policyType: 'privacy_policy',            priority: 2 },
  { domain: 'zoom.us',             name: 'Zoom',       product: 'Zoom Webinars',           policyType: 'terms_of_service',          priority: 3 },
  { domain: 'zoom.us',             name: 'Zoom',       product: 'Zoom Apps / Marketplace', policyType: 'terms_of_service',          priority: 3 },
  { domain: 'zendesk.com',         name: 'Zendesk',    product: 'Sunshine / Data',         policyType: 'data_processing_agreement', priority: 3 },
  { domain: 'twilio.com',          name: 'Twilio',     product: 'SMS / Voice (Carriers)',  policyType: 'acceptable_use_policy',     priority: 2 },
  { domain: 'mailchimp.com',       name: 'Mailchimp',  product: 'Transactional (Mandrill)', policyType: 'terms_of_service',         priority: 3 },

  // ── Telecom / Carriers ────────────────────────────────────────────────────
  { domain: 'verizon.com',         name: 'Verizon',    policyType: 'privacy_policy',       priority: 1, notes: 'Sells customer data to third parties — notable history' },
  { domain: 'att.com',             name: 'AT&T',       policyType: 'privacy_policy',       priority: 1 },
  { domain: 'tmobile.com',         name: 'T-Mobile',   policyType: 'privacy_policy',       priority: 1 },
  { domain: 'xfinity.com',         name: 'Comcast / Xfinity', policyType: 'privacy_policy', priority: 1 },
  { domain: 'spectrum.com',        name: 'Spectrum',   policyType: 'privacy_policy',       priority: 2 },
  { domain: 'cox.com',             name: 'Cox',        policyType: 'privacy_policy',       priority: 3 },

  // ── AdTech / Data Brokers ─────────────────────────────────────────────────
  { domain: 'doubleclick.net',     name: 'Google DoubleClick', policyType: 'privacy_policy', priority: 1, notes: 'Pervasive ad tracking network' },
  { domain: 'taboola.com',         name: 'Taboola',    policyType: 'privacy_policy',       priority: 2, notes: 'Content recommendation — cross-site tracking' },
  { domain: 'outbrain.com',        name: 'Outbrain',   policyType: 'privacy_policy',       priority: 2 },
  { domain: 'quantcast.com',       name: 'Quantcast',  policyType: 'privacy_policy',       priority: 2 },
  { domain: 'lotame.com',          name: 'Lotame',     policyType: 'privacy_policy',       priority: 2, notes: 'Data broker — audience data sales' },
  { domain: 'acxiom.com',          name: 'Acxiom',     policyType: 'privacy_policy',       priority: 1, notes: 'Major data broker — compiles consumer profiles' },
  { domain: 'datalogix.com',       name: 'Oracle Data Cloud / Datalogix', policyType: 'privacy_policy', priority: 2 },
  { domain: 'liveramp.com',        name: 'LiveRamp',   policyType: 'privacy_policy',       priority: 1, notes: 'Identity resolution across devices — major data intermediary' },
  { domain: 'infogroup.com',       name: 'Data.com / Infogroup', policyType: 'privacy_policy', priority: 2 },
  { domain: 'spokeo.com',          name: 'Spokeo',     policyType: 'privacy_policy',       priority: 2, notes: 'People search / data broker' },
  { domain: 'whitepages.com',      name: 'Whitepages', policyType: 'privacy_policy',       priority: 2 },
  { domain: 'beenverified.com',    name: 'BeenVerified', policyType: 'privacy_policy',     priority: 2, notes: 'Background check / data broker' },

  // ── More streaming / creator economy ──────────────────────────────────────
  { domain: 'ko-fi.com',           name: 'Ko-fi',      policyType: 'privacy_policy',       priority: 4 },
  { domain: 'buymeacoffee.com',    name: 'Buy Me a Coffee', policyType: 'privacy_policy',  priority: 4 },
  { domain: 'gumroad.com',         name: 'Gumroad',    policyType: 'privacy_policy',       priority: 4 },
  { domain: 'gumroad.com',         name: 'Gumroad',    product: 'Creator',                 policyType: 'terms_of_service',          priority: 4 },
  { domain: 'beehiiv.com',         name: 'beehiiv',    policyType: 'privacy_policy',       priority: 4 },
  { domain: 'convertkit.com',      name: 'Kit (ConvertKit)', policyType: 'privacy_policy', priority: 3 },
  { domain: 'ghost.org',           name: 'Ghost',      policyType: 'privacy_policy',       priority: 4 },
  { domain: 'anchor.fm',           name: 'Anchor / Spotify Podcasts', policyType: 'privacy_policy', priority: 3 },
  { domain: 'buzzsprout.com',      name: 'Buzzsprout', policyType: 'privacy_policy',       priority: 5 },
  { domain: 'transistor.fm',       name: 'Transistor', policyType: 'privacy_policy',       priority: 5 },

  // ── Automotive / Mobility ─────────────────────────────────────────────────
  { domain: 'tesla.com',           name: 'Tesla',      policyType: 'privacy_policy',       priority: 1, notes: 'Continuous vehicle telemetry, dashcam footage, driving behavior' },
  { domain: 'tesla.com',           name: 'Tesla',      policyType: 'terms_of_service',     priority: 2 },
  { domain: 'tesla.com',           name: 'Tesla',      product: 'Full Self-Driving (FSD)', policyType: 'terms_of_service',          priority: 1 },
  { domain: 'ford.com',            name: 'Ford',       product: 'FordPass / Connected Vehicle', policyType: 'privacy_policy',       priority: 2 },
  { domain: 'gm.com',              name: 'General Motors', product: 'OnStar / Connected Vehicle', policyType: 'privacy_policy',    priority: 2, notes: 'OnStar sold driving data to insurance companies' },
  { domain: 'rivian.com',          name: 'Rivian',     policyType: 'privacy_policy',       priority: 3 },
  { domain: 'waymo.com',           name: 'Waymo',      policyType: 'privacy_policy',       priority: 2, notes: 'Autonomous vehicle — extensive location and sensor data' },
  { domain: 'bird.co',             name: 'Bird (Scooters)', policyType: 'privacy_policy',  priority: 4 },
  { domain: 'lime.bike',           name: 'Lime',       policyType: 'privacy_policy',       priority: 4 },
  { domain: 'zipcar.com',          name: 'Zipcar',     policyType: 'privacy_policy',       priority: 4 },

  // ── Insurance ─────────────────────────────────────────────────────────────
  { domain: 'geico.com',           name: 'GEICO',      policyType: 'privacy_policy',       priority: 2 },
  { domain: 'progressive.com',     name: 'Progressive', policyType: 'privacy_policy',      priority: 2, notes: 'Snapshot device tracks driving behavior' },
  { domain: 'statefarm.com',       name: 'State Farm', policyType: 'privacy_policy',       priority: 2 },
  { domain: 'allstate.com',        name: 'Allstate',   policyType: 'privacy_policy',       priority: 2 },
  { domain: 'oscarhealthinc.com',  name: 'Oscar Health', policyType: 'privacy_policy',     priority: 2 },
  { domain: 'lemonade.com',        name: 'Lemonade',   policyType: 'privacy_policy',       priority: 2 },

  // ── Productivity (more) ───────────────────────────────────────────────────
  { domain: 'grammarly.com',       name: 'Grammarly',  policyType: 'privacy_policy',       priority: 1, notes: 'Reads all text typed in browser — massive data access' },
  { domain: 'grammarly.com',       name: 'Grammarly',  policyType: 'terms_of_service',     priority: 2 },
  { domain: 'otter.ai',            name: 'Otter.ai',   policyType: 'privacy_policy',       priority: 2, notes: 'Meeting transcription — audio and content of meetings' },
  { domain: 'read.ai',             name: 'Read AI',    policyType: 'privacy_policy',       priority: 2 },
  { domain: 'krisp.ai',            name: 'Krisp',      policyType: 'privacy_policy',       priority: 3 },
  { domain: 'zapier.com',          name: 'Zapier',     policyType: 'privacy_policy',       priority: 2, notes: 'Automation platform with access to many connected services' },
  { domain: 'zapier.com',          name: 'Zapier',     policyType: 'terms_of_service',     priority: 2 },
  { domain: 'make.com',            name: 'Make (Integromat)', policyType: 'privacy_policy', priority: 2 },
  { domain: 'n8n.io',              name: 'n8n',        policyType: 'privacy_policy',       priority: 3 },
  { domain: 'airtable.com',        name: 'Airtable',   product: 'Automations / AI',        policyType: 'terms_of_service',          priority: 3 },

  // ── More developer / infra ────────────────────────────────────────────────
  { domain: 'github.com',          name: 'GitHub',     product: 'Advanced Security',       policyType: 'terms_of_service',          priority: 3 },
  { domain: 'gitlab.com',          name: 'GitLab',     policyType: 'privacy_policy',       priority: 2 },
  { domain: 'gitlab.com',          name: 'GitLab',     policyType: 'terms_of_service',     priority: 2 },
  { domain: 'bitbucket.org',       name: 'Bitbucket',  policyType: 'privacy_policy',       priority: 3 },
  { domain: 'hashicorp.com',       name: 'HashiCorp',  policyType: 'privacy_policy',       priority: 3 },
  { domain: 'grafana.com',         name: 'Grafana',    policyType: 'privacy_policy',       priority: 3 },
  { domain: 'elastic.co',          name: 'Elastic',    policyType: 'privacy_policy',       priority: 3 },
  { domain: 'confluent.io',        name: 'Confluent',  policyType: 'privacy_policy',       priority: 3 },
  { domain: 'dbt.com',             name: 'dbt Labs',   policyType: 'privacy_policy',       priority: 3 },
  { domain: 'retool.com',          name: 'Retool',     policyType: 'privacy_policy',       priority: 3 },
  { domain: 'linear.app',          name: 'Linear',     policyType: 'terms_of_service',     priority: 3 },
  { domain: 'jira.atlassian.com',  name: 'Jira Service Management', policyType: 'terms_of_service', priority: 3 },
  { domain: 'cursor.com',          name: 'Cursor',     policyType: 'privacy_policy',       priority: 2, notes: 'AI code editor — codebase uploaded to analyze' },
  { domain: 'cursor.com',          name: 'Cursor',     policyType: 'terms_of_service',     priority: 2 },
  { domain: 'windsurf.ai',         name: 'Windsurf',   policyType: 'privacy_policy',       priority: 2 },
  { domain: 'codeium.com',         name: 'Codeium / Windsurf', policyType: 'terms_of_service', priority: 2 },
  { domain: 'tabnine.com',         name: 'Tabnine',    policyType: 'privacy_policy',       priority: 3 },

  // ── Additional retail / CPG brands ────────────────────────────────────────
  { domain: 'target.com',          name: 'Target',     product: 'Target Circle (Loyalty)', policyType: 'privacy_policy',            priority: 2, notes: 'Loyalty program with predictive analytics (pregnancy targeting)' },
  { domain: 'kroger.com',          name: 'Kroger',     policyType: 'privacy_policy',       priority: 2, notes: 'Sells purchase data to brands and insurers' },
  { domain: 'kroger.com',          name: 'Kroger',     product: 'Kroger Plus (Loyalty)',   policyType: 'privacy_policy',            priority: 2 },
  { domain: 'walgreens.com',       name: 'Walgreens',  policyType: 'privacy_policy',       priority: 2, notes: 'Pharmacy data — prescription history' },
  { domain: 'cvs.com',             name: 'CVS',        policyType: 'privacy_policy',       priority: 2 },
  { domain: 'samsclub.com',        name: "Sam's Club",  policyType: 'privacy_policy',      priority: 3 },
  { domain: 'apple.com',           name: 'Apple',      product: 'Apple Store Retail',      policyType: 'privacy_policy',            priority: 3 },

  // ── Social commerce / newer platforms ────────────────────────────────────
  { domain: 'pinterest.com',       name: 'Pinterest',  product: 'Shopping / Checkout',     policyType: 'terms_of_service',          priority: 3 },
  { domain: 'instagram.com',       name: 'Meta',       product: 'Instagram Shopping',      policyType: 'terms_of_service',          priority: 2 },
  { domain: 'facebook.com',        name: 'Meta',       product: 'Facebook Shops',          policyType: 'terms_of_service',          priority: 2 },
  { domain: 'x.com',               name: 'X',          product: 'X Shopping / Payments',   policyType: 'privacy_policy',            priority: 2 },
  { domain: 'youtube.com',         name: 'YouTube',    product: 'YouTube Shopping',        policyType: 'terms_of_service',          priority: 3 },

  // ── More health / pharma ─────────────────────────────────────────────────
  { domain: 'hinge.health',        name: 'Hinge Health', policyType: 'privacy_policy',     priority: 2 },
  { domain: 'cerebral.com',        name: 'Cerebral',   policyType: 'privacy_policy',       priority: 2, notes: 'Mental health telehealth — previously shared mental health data with advertisers' },
  { domain: 'betterhelp.com',      name: 'BetterHelp', policyType: 'privacy_policy',       priority: 1, notes: 'Therapy platform — shared mental health data with Facebook' },
  { domain: 'betterhelp.com',      name: 'BetterHelp', policyType: 'terms_of_service',     priority: 2 },
  { domain: 'talkspace.com',       name: 'Talkspace',  policyType: 'privacy_policy',       priority: 2 },
  { domain: 'noom.com',            name: 'Noom',       policyType: 'terms_of_service',     priority: 3 },
  { domain: 'ro.co',               name: 'Ro Health',  policyType: 'privacy_policy',       priority: 2 },
  { domain: 'hims.com',            name: 'Hims & Hers', policyType: 'privacy_policy',      priority: 2 },
  { domain: 'coachcare.com',       name: 'CoachCare',  policyType: 'privacy_policy',       priority: 3 },

  // ── Education (more) ──────────────────────────────────────────────────────
  { domain: 'google.com',          name: 'Google',     product: 'Classroom / Education',   policyType: 'privacy_policy',            priority: 2, notes: 'Student data — FERPA regulated' },
  { domain: 'google.com',          name: 'Google',     product: 'Classroom / Education',   policyType: 'data_processing_agreement', priority: 2 },
  { domain: 'microsoft.com',       name: 'Microsoft',  product: 'Teams for Education',     policyType: 'privacy_policy',            priority: 2 },
  { domain: 'apple.com',           name: 'Apple',      product: 'School Manager',          policyType: 'privacy_policy',            priority: 3 },
  { domain: 'zoom.us',             name: 'Zoom',       product: 'Zoom for Education',      policyType: 'privacy_policy',            priority: 2 },
  { domain: 'schoology.com',       name: 'Schoology',  policyType: 'privacy_policy',       priority: 3 },
  { domain: 'clevr.com',           name: 'Clever',     policyType: 'privacy_policy',       priority: 3, notes: 'SSO for K-12 — manages student data access to apps' },
  { domain: 'renaissance.com',     name: 'Renaissance Learning', policyType: 'privacy_policy', priority: 3 },

  // ── B2C finance (more) ────────────────────────────────────────────────────
  { domain: 'paypal.com',          name: 'PayPal',     product: 'Honey (Browser Extension)', policyType: 'privacy_policy',         priority: 1, notes: 'Browser extension reads browsing and purchase data' },
  { domain: 'intuit.com',          name: 'Intuit',     policyType: 'privacy_policy',       priority: 1, notes: 'Parent of TurboTax, Mint, QuickBooks, Credit Karma' },
  { domain: 'quickbooks.intuit.com', name: 'QuickBooks', policyType: 'privacy_policy',     priority: 2 },
  { domain: 'quickbooks.intuit.com', name: 'QuickBooks', policyType: 'terms_of_service',   priority: 2 },
  { domain: 'freshbooks.com',      name: 'FreshBooks', policyType: 'privacy_policy',       priority: 3 },
  { domain: 'xero.com',            name: 'Xero',       policyType: 'privacy_policy',       priority: 3 },
  { domain: 'ynab.com',            name: 'YNAB',       policyType: 'privacy_policy',       priority: 3 },
  { domain: 'personalcapital.com', name: 'Empower (Personal Capital)', policyType: 'privacy_policy', priority: 2 },

  // ── Miscellaneous high-value ───────────────────────────────────────────────
  { domain: 'reddit.com',          name: 'Reddit',     product: 'Reddit Ads',              policyType: 'privacy_policy',            priority: 2 },
  { domain: 'reddit.com',          name: 'Reddit',     product: 'Developer / Data API',    policyType: 'terms_of_service',          priority: 2 },
  { domain: 'reddit.com',          name: 'Reddit',     product: 'Reddit Premium / Gold',   policyType: 'terms_of_service',          priority: 4 },
  { domain: 'discord.com',         name: 'Discord',    product: 'Discord Nitro',           policyType: 'terms_of_service',          priority: 4 },
  { domain: 'discord.com',         name: 'Discord',    product: 'Server Subscriptions',    policyType: 'terms_of_service',          priority: 3 },
  { domain: 'spotify.com',         name: 'Spotify',    product: 'Spotify Ads Studio',      policyType: 'privacy_policy',            priority: 3 },
  { domain: 'linkedin.com',        name: 'LinkedIn',   product: 'Premium Career / Sales Navigator', policyType: 'terms_of_service', priority: 3 },
  { domain: 'expedia.com',         name: 'Expedia',    product: 'Partner / Hotel',         policyType: 'terms_of_service',          priority: 3 },
  { domain: 'doordash.com',        name: 'DoorDash',   product: 'DashPass',                policyType: 'terms_of_service',          priority: 3 },
  { domain: 'uber.com',            name: 'Uber',       product: 'Uber One / Pass',         policyType: 'terms_of_service',          priority: 3 },
  { domain: 'apple.com',           name: 'Apple',      product: 'Apple One (Bundle)',       policyType: 'terms_of_service',          priority: 3 },
  { domain: 'samsung.com',         name: 'Samsung',    product: 'SmartThings / IoT',       policyType: 'privacy_policy',            priority: 2 },
  { domain: 'samsung.com',         name: 'Samsung',    product: 'Samsung Health',          policyType: 'privacy_policy',            priority: 2 },
  { domain: 'samsung.com',         name: 'Samsung',    product: 'Samsung Pay',             policyType: 'privacy_policy',            priority: 2 },
  { domain: 'google.com',          name: 'Google',     product: 'Wallet / Pay',            policyType: 'privacy_policy',            priority: 2 },
];

async function add(c: C) {
  const res = await fetch(`${BASE}/admin/candidates`, {
    method: 'POST', headers,
    body: JSON.stringify({ domain: c.domain, name: c.name, product: c.product ?? null, policyType: c.policyType, priority: c.priority, notes: c.notes ?? null }),
  });
  const data = await res.json() as any;
  const label = `${c.domain}${c.product ? ' / ' + c.product : ''} [${c.policyType}]`;
  console.log(res.status === 201 ? `  ✓  ${label}` : `  ✗  ${label}: ${JSON.stringify(data?.error ?? data)}`);
}

async function run() {
  console.log(`\nPart 3: ${CANDIDATES.length} candidates...\n`);
  for (const c of CANDIDATES) await add(c);
  console.log('\nPart 3 done.');
}
run().catch(err => { console.error(err); process.exit(1); });
