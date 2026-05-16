import 'dotenv/config';

const BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? '';

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Secret': ADMIN_SECRET,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${JSON.stringify(json)}`);
  }
  return json as T;
}

export const api = {
  submit: (policyUrl: string, domain?: string) =>
    request<{ domain: string; jobId: string; status: string }>('POST', '/admin/sites', { policyUrl, domain }),

  reprocess: (domain: string, force = false) =>
    request<{ domain: string; jobId: string; status: string }>('POST', `/admin/sites/${domain}/reprocess`, { force }),

  listSites: (page = 1, limit = 50) =>
    request<{ sites: unknown[] }>('GET', `/admin/sites?page=${page}&limit=${limit}`),

  listQueue: (status?: string, limit = 50) => {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (status) qs.set('status', status);
    return request<{ items: unknown[] }>('GET', `/admin/queue?${qs}`);
  },

  deleteSite: (domain: string) =>
    request<{ deleted: boolean }>('DELETE', `/admin/sites/${domain}`),

  check: (domain: string) =>
    request<unknown>('GET', `/api/v1/check/${domain}`),
};
