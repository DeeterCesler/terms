import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') });

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  port: parseInt(optional('PORT', '3000'), 10),
  nodeEnv: optional('NODE_ENV', 'development'),
  databaseUrl: required('DATABASE_URL'),
  adminSecret: required('ADMIN_SECRET'),
  anthropicApiKey: required('ANTHROPIC_API_KEY'),
  rateLimitWindowMs: parseInt(optional('RATE_LIMIT_WINDOW_MS', '60000'), 10),
  rateLimitMax: parseInt(optional('RATE_LIMIT_MAX', '30'), 10),
  workerPollIntervalMs: parseInt(optional('WORKER_POLL_INTERVAL_MS', '5000'), 10),
  workerStaleJobTimeoutMs: parseInt(optional('WORKER_STALE_JOB_TIMEOUT_MS', '600000'), 10),
  corsOrigin: optional('CORS_ORIGIN', '*'),
};
