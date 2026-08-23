import { normalizeDomain } from '../utils/domain.js';
import { recheckState, type RefreshInfo } from '../utils/recheck.js';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'https://terms-vzh0.onrender.com';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min cache per domain

function show(id: string) {
  ['state-loading', 'state-not-found', 'state-error', 'state-found', 'state-local'].forEach(s => {
    const el = document.getElementById(s);
    if (el) el.classList.toggle('hidden', s !== id);
  });
}

// localhost / loopback / private-LAN hosts never leave the user's machine, so
// there's no policy to check — show the easter-egg state instead. Chrome's
// internal pages (chrome://newtab/, chrome://extensions/ — hostnames "newtab"
// and "extensions") are just as local, so they get the same treatment.
function isLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    h === 'localhost' || h.endsWith('.localhost') ||
    h === 'newtab' || h === 'extensions' ||
    h.endsWith('.local') ||
    h === '0.0.0.0' || h === '::1' ||
    h.startsWith('127.') ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  );
}

// `.yes` renders red and `.no` renders green. For most findings (shares, sells)
// a YES is the bad outcome, so YES→red/NO→green. For findings where YES is the
// good outcome (e.g. data anonymized), pass goodWhenYes to flip the colors while
// keeping the YES/NO text.
function boolDisplay(val: boolean | null, el: HTMLElement, goodWhenYes = false) {
  if (val === null) {
    el.textContent = 'Unknown';
    el.className = 'finding-value unknown';
  } else if (val) {
    el.textContent = 'YES';
    el.className = `finding-value ${goodWhenYes ? 'no' : 'yes'}`;
  } else {
    el.textContent = 'NO';
    el.className = `finding-value ${goodWhenYes ? 'yes' : 'no'}`;
  }
}

function scoreTierClass(score: number): string {
  if (score >= 8) return 'good';
  if (score >= 5) return 'fair';
  return 'poor';
}

function scoreTierLabel(score: number): string {
  if (score >= 8) return 'Good';
  if (score >= 5) return 'Fair';
  return 'Poor';
}

async function getCurrentUrl(): Promise<string | null> {
  return new Promise(resolve => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      resolve(tabs[0]?.url ?? null);
    });
  });
}

function cacheKeyFor(domain: string): string {
  return `cache:${domain}`;
}

async function fetchAnalysis(domain: string): Promise<any> {
  // Check session cache first
  const cacheKey = cacheKeyFor(domain);
  const cached = await chrome.storage.session.get(cacheKey);
  if (cached[cacheKey]) {
    const { data, ts } = cached[cacheKey] as { data: any; ts: number };
    if (Date.now() - ts < CACHE_TTL_MS) return data;
  }

  const res = await fetch(`${API_BASE}/api/v1/check/${domain}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  // Cache it
  await chrome.storage.session.set({ [cacheKey]: { data, ts: Date.now() } });
  return data;
}

type Highlight = { kind: 'good' | 'bad'; text: string };

function highlightItem(h: Highlight): HTMLLIElement {
  const li = document.createElement('li');
  li.className = h.kind === 'good' ? 'good' : 'bad';
  const kind = document.createElement('span');
  kind.className = 'hl-kind';
  kind.textContent = h.kind === 'good' ? 'Good' : 'Watch';
  li.appendChild(kind);
  li.appendChild(document.createTextNode(h.text));
  return li;
}

// Highlights collapse into a dropdown that always shows one preview highlight.
// The preview is score-dependent: a good score leads with something positive, a
// poor score leads with something to watch. The remaining highlights are
// revealed on expand.
function renderHighlights(a: any) {
  const section = document.getElementById('highlights-section') as HTMLElement;
  const previewList = document.getElementById('highlights-preview') as HTMLElement;
  const restList = document.getElementById('highlights-rest') as HTMLElement;
  previewList.replaceChildren();
  restList.replaceChildren();

  const highlights: Highlight[] = Array.isArray(a.highlights) ? a.highlights : [];
  if (highlights.length === 0) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');

  const preferredKind: 'good' | 'bad' = a.overallScore >= 5 ? 'good' : 'bad';
  let previewIdx = highlights.findIndex(h => h.kind === preferredKind);
  if (previewIdx === -1) previewIdx = 0; // no highlight of the preferred kind — fall back to the first

  previewList.appendChild(highlightItem(highlights[previewIdx]));

  const rest = highlights.filter((_, i) => i !== previewIdx);
  for (const h of rest) restList.appendChild(highlightItem(h));

  const moreEl = document.getElementById('highlights-more') as HTMLElement;
  moreEl.textContent = `Show ${rest.length} more`;

  // With nothing left to reveal, drop the expand affordance and keep it closed.
  if (rest.length === 0) {
    section.classList.add('no-toggle');
    section.removeAttribute('open');
  } else {
    section.classList.remove('no-toggle');
  }
}

function renderFound(domain: string, result: any) {
  const a = result.analysis;

  (document.getElementById('found-domain') as HTMLElement).textContent = domain;

  const badge = document.getElementById('score-badge') as HTMLElement;
  badge.textContent = String(a.overallScore);
  badge.className = `score-badge ${scoreTierClass(a.overallScore)}`;

  (document.getElementById('score-tier') as HTMLElement).textContent = scoreTierLabel(a.overallScore);

  // Sites with no meaningful privacy policy get an explicit callout — a low
  // score alone reads as "bad policy" rather than "no policy worth the name".
  // The field is absent for every site that isn't flagged.
  const noPolicyNote = document.getElementById('no-policy-note') as HTMLElement;
  noPolicyNote.classList.toggle('hidden', a.noMeaningfulPolicy !== true);

  boolDisplay(a.sharesWithThirdParties.value, document.getElementById('f-shares') as HTMLElement);
  boolDisplay(a.sellsData.value, document.getElementById('f-sells') as HTMLElement);

  // "Data anonymized" only matters when the site actually shares with third
  // parties. Hide the row otherwise (explicit NO, or Unknown). When shown, YES
  // is the good outcome, so flip its colors.
  const anonRow = document.getElementById('anon-row') as HTMLElement;
  if (a.sharesWithThirdParties.value === true) {
    anonRow.classList.remove('hidden');
    boolDisplay(a.dataAnonymized.value, document.getElementById('f-anon') as HTMLElement, true);
  } else {
    anonRow.classList.add('hidden');
  }

  const retentionEl = document.getElementById('f-retention') as HTMLElement;
  retentionEl.replaceChildren();
  const retention = a.dataRetention ?? null;
  if (!retention) {
    retentionEl.textContent = 'Not specified';
  } else {
    const sentences = retention
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map((s: string) => s.trim())
      .filter(Boolean);
    if (sentences.length <= 1) {
      retentionEl.textContent = retention;
    } else {
      const ul = document.createElement('ul');
      for (const sent of sentences) {
        const li = document.createElement('li');
        li.textContent = sent;
        ul.appendChild(li);
      }
      retentionEl.appendChild(ul);
    }
  }

  const rightsEl = document.getElementById('f-rights') as HTMLElement;
  rightsEl.replaceChildren();
  if (a.userRights.length === 0) {
    rightsEl.textContent = 'None mentioned';
  } else if (a.userRights.length <= 2) {
    rightsEl.textContent = a.userRights.join(', ');
  } else {
    const ul = document.createElement('ul');
    for (const right of a.userRights) {
      const li = document.createElement('li');
      li.textContent = right;
      ul.appendChild(li);
    }
    rightsEl.appendChild(ul);
  }

  renderHighlights(a);

  const summaryEl = document.getElementById('summary-text') as HTMLElement;
  summaryEl.replaceChildren();
  const summary = (a.summary ?? '').trim();
  const sentences = summary
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s: string) => s.trim())
    .filter(Boolean);
  const chunks = sentences.length > 0 ? sentences : [summary];
  for (const chunk of chunks) {
    const p = document.createElement('p');
    p.textContent = chunk;
    summaryEl.appendChild(p);
  }

  (document.getElementById('last-analyzed') as HTMLElement).textContent =
    new Date(result.lastAnalyzed).toLocaleDateString();

  renderRecheck(domain, result.refresh);

  show('state-found');
}

// The re-check affordance for a site we already cover. `refresh` is absent on
// responses from an older server build, in which case we show nothing rather
// than a button whose POST would be treated as a first-time request.
function renderRecheck(domain: string, refresh: RefreshInfo | undefined) {
  const btn = document.getElementById('recheck-btn') as HTMLButtonElement | null;
  const status = document.getElementById('recheck-status') as HTMLElement | null;
  if (!btn || !status) return;

  btn.classList.add('hidden');
  btn.disabled = false;
  btn.textContent = 'Policy changed?';
  status.classList.add('hidden');
  status.classList.remove('error');
  status.textContent = '';

  const state = recheckState(refresh);
  if (state.kind === 'hidden') return;

  if (state.kind === 'queued') {
    const when = state.requestedAt ? formatRequestedDate(state.requestedAt) : '';
    status.textContent = when ? `Re-check queued ${when}` : 'Re-check queued';
    status.classList.remove('hidden');
    return;
  }

  btn.classList.remove('hidden');
  btn.addEventListener('click', () => requestRecheck(domain), { once: true });
}

// Same public endpoint as a first-time request; the server recognizes an
// already-covered domain and queues a refresh against it instead.
async function requestRecheck(domain: string) {
  const btn = document.getElementById('recheck-btn') as HTMLButtonElement | null;
  const status = document.getElementById('recheck-status') as HTMLElement | null;
  if (!btn || !status) return;

  btn.disabled = true;
  btn.textContent = 'Requesting…';

  try {
    const res = await fetch(`${API_BASE}/api/v1/request/${domain}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    btn.classList.add('hidden');
    status.textContent = "Thanks — we'll re-check this policy soon.";
    status.classList.remove('hidden');
    // Drop the cached payload so the next open reflects the queued state.
    await chrome.storage.session.remove(cacheKeyFor(domain));
  } catch {
    btn.classList.add('hidden');
    status.textContent = 'Request failed. Try again later.';
    status.classList.remove('hidden');
    status.classList.add('error');
  }
}

function formatRequestedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString();
}

function renderNotFound(domain: string, requested: { at: string } | undefined) {
  (document.getElementById('nf-domain') as HTMLElement).textContent = domain;

  const msgEl = document.getElementById('nf-msg') as HTMLElement;
  const requestedEl = document.getElementById('nf-requested') as HTMLElement;
  const btn = document.getElementById('request-btn') as HTMLButtonElement | null;
  const statusEl = document.getElementById('request-status') as HTMLElement | null;

  if (statusEl) {
    statusEl.classList.add('hidden');
    statusEl.classList.remove('error');
    statusEl.textContent = '';
  }

  if (requested) {
    msgEl.textContent = "We haven't analyzed this site yet, but it's in the queue.";
    const when = formatRequestedDate(requested.at);
    requestedEl.textContent = when
      ? `Already requested on ${when}. We'll analyze it soon.`
      : "Already requested. We'll analyze it soon.";
    requestedEl.classList.remove('hidden');
    // Already queued — nothing for the user to submit.
    if (btn) { btn.classList.add('hidden'); btn.disabled = true; }
  } else {
    msgEl.textContent = "We haven't analyzed this site yet.";
    requestedEl.classList.add('hidden');
    requestedEl.textContent = '';
    // Anyone can request analysis; this adds the domain to the candidate queue.
    if (btn) { btn.classList.remove('hidden'); btn.disabled = false; btn.textContent = 'Request analysis'; }
  }

  show('state-not-found');
}

// POST the domain to the public /request endpoint, adding it to the candidate
// queue. Open to all users (rate-limited server-side); distinct from the
// admin-only site-update endpoint.
async function requestAnalysis(domain: string, url: string | null) {
  const btn = document.getElementById('request-btn') as HTMLButtonElement | null;
  const status = document.getElementById('request-status') as HTMLElement | null;
  if (!btn || !status) return;

  btn.disabled = true;
  btn.textContent = 'Requesting…';
  status.classList.add('hidden');
  status.classList.remove('error');

  try {
    const res = await fetch(`${API_BASE}/api/v1/request/${domain}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(url ? { url } : {}),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    btn.textContent = 'Requested';
    status.textContent = "Thanks — we'll analyze this site soon.";
    status.classList.remove('hidden');
    // Invalidate cache so the next popup open reflects the queued state.
    await chrome.storage.session.remove(cacheKeyFor(domain));
  } catch {
    btn.disabled = false;
    btn.textContent = 'Request analysis';
    status.textContent = 'Request failed. Try again later.';
    status.classList.remove('hidden');
    status.classList.add('error');
  }
}

async function main() {
  show('state-loading');

  // Render's free tier sleeps the server after idle; cold starts take ~10-20s.
  // Swap the loading copy if the response is taking long enough that a cold
  // start is plausible, so the user knows we're not stuck.
  const loadingMsg = document.querySelector('#state-loading p') as HTMLElement | null;
  const wakeTimer = window.setTimeout(() => {
    if (loadingMsg) loadingMsg.textContent = 'Waking the server, one moment…';
  }, 3000);

  try {
    const url = await getCurrentUrl();
    if (!url) {
      show('state-error');
      return;
    }

    let hostname: string | null = null;
    try { hostname = new URL(url).hostname; } catch {}
    if (hostname && isLocalHost(hostname)) {
      show('state-local');
      return;
    }

    const domain = normalizeDomain(url);
    if (!domain) {
      show('state-error');
      return;
    }

    const result = await fetchAnalysis(domain);

    if (!result.found) {
      renderNotFound(domain, result.requested);
      // Wire the request button only when the site isn't already queued.
      if (!result.requested) {
        const btn = document.getElementById('request-btn');
        btn?.addEventListener('click', () => requestAnalysis(domain, url));
      }
      return;
    }

    renderFound(domain, result);

    // Update badge
    chrome.runtime.sendMessage({ type: 'SET_BADGE', score: result.analysis.overallScore });
  } catch {
    show('state-error');
  } finally {
    clearTimeout(wakeTimer);
  }
}

document.addEventListener('DOMContentLoaded', main);
