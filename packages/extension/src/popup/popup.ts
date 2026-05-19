import { normalizeDomain } from '../utils/domain.js';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'https://terms-vzh0.onrender.com';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min cache per domain

function show(id: string) {
  ['state-loading', 'state-not-found', 'state-error', 'state-found'].forEach(s => {
    const el = document.getElementById(s);
    if (el) el.classList.toggle('hidden', s !== id);
  });
}

function boolDisplay(val: boolean | null, el: HTMLElement) {
  if (val === null) {
    el.textContent = 'Unknown';
    el.className = 'finding-value unknown';
  } else if (val) {
    el.textContent = 'YES';
    el.className = 'finding-value yes';
  } else {
    el.textContent = 'NO';
    el.className = 'finding-value no';
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

async function getCurrentDomain(): Promise<string | null> {
  return new Promise(resolve => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const url = tabs[0]?.url;
      if (!url) { resolve(null); return; }
      resolve(normalizeDomain(url));
    });
  });
}

async function fetchAnalysis(domain: string): Promise<any> {
  // Check session cache first
  const cacheKey = `cache:${domain}`;
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

function renderFound(domain: string, result: any) {
  const a = result.analysis;

  (document.getElementById('found-domain') as HTMLElement).textContent = domain;

  const badge = document.getElementById('score-badge') as HTMLElement;
  badge.textContent = String(a.overallScore);
  badge.className = `score-badge ${scoreTierClass(a.overallScore)}`;

  (document.getElementById('score-tier') as HTMLElement).textContent = scoreTierLabel(a.overallScore);

  boolDisplay(a.sharesWithThirdParties.value, document.getElementById('f-shares') as HTMLElement);
  boolDisplay(a.sellsData.value, document.getElementById('f-sells') as HTMLElement);
  boolDisplay(a.dataAnonymized.value, document.getElementById('f-anon') as HTMLElement);

  const retentionEl = document.getElementById('f-retention') as HTMLElement;
  retentionEl.replaceChildren();
  const retention = a.dataRetention ?? null;
  if (!retention) {
    retentionEl.textContent = 'Not specified';
  } else {
    const sentences = retention
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map(s => s.trim())
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

  const highlightsSection = document.getElementById('highlights-section') as HTMLElement;
  const highlightsList = document.getElementById('highlights-list') as HTMLElement;
  highlightsList.replaceChildren();
  const highlights: Array<{ kind: 'good' | 'bad'; text: string }> = Array.isArray(a.highlights) ? a.highlights : [];
  if (highlights.length === 0) {
    highlightsSection.classList.add('hidden');
  } else {
    highlightsSection.classList.remove('hidden');
    for (const h of highlights) {
      const li = document.createElement('li');
      li.className = h.kind === 'good' ? 'good' : 'bad';
      const kind = document.createElement('span');
      kind.className = 'hl-kind';
      kind.textContent = h.kind === 'good' ? 'Good' : 'Watch';
      li.appendChild(kind);
      li.appendChild(document.createTextNode(h.text));
      highlightsList.appendChild(li);
    }
  }

  const summaryEl = document.getElementById('summary-text') as HTMLElement;
  summaryEl.replaceChildren();
  const summary = (a.summary ?? '').trim();
  const sentences = summary
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map(s => s.trim())
    .filter(Boolean);
  const chunks = sentences.length > 0 ? sentences : [summary];
  for (const chunk of chunks) {
    const p = document.createElement('p');
    p.textContent = chunk;
    summaryEl.appendChild(p);
  }

  (document.getElementById('last-analyzed') as HTMLElement).textContent =
    new Date(result.lastAnalyzed).toLocaleDateString();

  show('state-found');
}

async function getCurrentTabUrl(): Promise<string | null> {
  return new Promise(resolve => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      resolve(tabs[0]?.url ?? null);
    });
  });
}

async function requestAnalysis(domain: string, url: string | null) {
  const btn = document.getElementById('request-btn') as HTMLButtonElement | null;
  const status = document.getElementById('request-status') as HTMLElement | null;
  if (!btn || !status) return;

  btn.disabled = true;
  btn.textContent = 'Requesting...';
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
    const domain = await getCurrentDomain();
    if (!domain) {
      show('state-error');
      return;
    }

    const result = await fetchAnalysis(domain);

    if (!result.found) {
      (document.getElementById('nf-domain') as HTMLElement).textContent = domain;
      show('state-not-found');

      const tabUrl = await getCurrentTabUrl();
      const btn = document.getElementById('request-btn');
      btn?.addEventListener('click', () => requestAnalysis(domain, tabUrl));
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
