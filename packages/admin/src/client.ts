import 'dotenv/config';

const BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? '';

async function request<T>(
  method: string,
  path: string,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Secret': ADMIN_SECRET,
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${JSON.stringify(json)}`);
  }
  return json as T;
}

export const api = {
  listSites: (page = 1, limit = 50) =>
    request<{ sites: unknown[] }>('GET', `/admin/sites?page=${page}&limit=${limit}`),

  check: (domain: string) =>
    request<unknown>('GET', `/api/v1/check/${domain}`),
};
