import { normalizeDomain } from '../utils/domain.js';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:3000';

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

  (document.getElementById('f-retention') as HTMLElement).textContent =
    a.dataRetention ?? 'Not specified';

  const rightsEl = document.getElementById('f-rights') as HTMLElement;
  rightsEl.textContent = a.userRights.length > 0 ? a.userRights.join(', ') : 'None mentioned';

  (document.getElementById('summary-text') as HTMLElement).textContent = a.summary;

  (document.getElementById('last-analyzed') as HTMLElement).textContent =
    new Date(result.lastAnalyzed).toLocaleDateString();

  show('state-found');
}

async function main() {
  show('state-loading');

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
      return;
    }

    renderFound(domain, result);

    // Update badge
    chrome.runtime.sendMessage({ type: 'SET_BADGE', score: result.analysis.overallScore });
  } catch {
    show('state-error');
  }
}

document.addEventListener('DOMContentLoaded', main);
