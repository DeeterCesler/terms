import { pool, type Queryable } from '../client.js';
import type { PolicyRow } from '@term-checker/shared';

export async function getCurrentPolicy(
  policySourceId: string,
  db: Queryable = pool,
): Promise<PolicyRow | null> {
  const { rows } = await db.query<PolicyRow>(
    'SELECT * FROM policies WHERE policy_source_id = $1 AND is_current = TRUE',
    [policySourceId]
  );
  return rows[0] ?? null;
}

/**
 * Demote the current policy for a source and insert this one in its place.
 *
 * The demote+insert pair must be atomic or the source is briefly left with no
 * current policy. When `db` is omitted this manages its own transaction; when
 * the caller passes a transaction client (see `withTransaction`) it runs inline
 * instead, since Postgres has no nested BEGIN and issuing one here would emit a
 * "there is already a transaction in progress" warning and, worse, the inner
 * COMMIT would commit the caller's whole outer transaction early.
 */
export async function insertNewPolicy(
  policySourceId: string,
  rawText: string,
  contentHash: string,
  httpStatus: number | null,
  db?: Queryable,
): Promise<PolicyRow> {
  const write = async (exec: Queryable): Promise<PolicyRow> => {
    await exec.query(
      'UPDATE policies SET is_current = FALSE WHERE policy_source_id = $1 AND is_current = TRUE',
      [policySourceId]
    );

    const { rows } = await exec.query<PolicyRow>(
      `INSERT INTO policies (policy_source_id, raw_text, content_hash, char_count, http_status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [policySourceId, rawText, contentHash, rawText.length, httpStatus]
    );
    return rows[0]!;
  };

  if (db) return write(db);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const row = await write(client);
    await client.query('COMMIT');
    return row;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore — original error matters more */
    }
    throw err;
  } finally {
    client.release();
  }
}
