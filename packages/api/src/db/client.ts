import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected pg pool error', err);
});

/**
 * Anything the query helpers can run against: the pool (each call its own
 * implicit transaction) or a checked-out client inside an explicit one. Query
 * helpers take this as a trailing optional arg defaulting to `pool`, so callers
 * that don't care are unaffected.
 */
export type Queryable = {
  query<R extends pg.QueryResultRow = any>(
    text: string,
    values?: unknown[],
  ): Promise<pg.QueryResult<R>>;
};

/**
 * Run `fn` inside a single transaction on one checked-out client, committing on
 * success and rolling back on any throw.
 *
 * Ingest writes span four tables (sites -> policy_sources -> policies ->
 * policy_analyses). Run loose against the pool, a mid-sequence failure (a
 * connection timeout, say) leaves a site and source with no policy behind them:
 * inert, but invisible until something goes looking. Wrapping the sequence makes
 * it all-or-nothing.
 */
export async function withTransaction<T>(
  fn: (tx: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    // A rollback can itself fail if the connection is already gone; the original
    // error is the one worth propagating.
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
}
