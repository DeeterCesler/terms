import { pool, type Queryable } from '../client.js';
import type { PolicyRow } from '@term-checker/shared';

/**
 * The version of a source's policy that is in force right now.
 *
 * Usually the is_current row. But an announced policy (insertUpcomingPolicy)
 * is stored with is_current = FALSE and takes over silently when its
 * effective_at passes, with nothing flipping the flag. So candidates are the
 * is_current row plus any upcoming row whose date has arrived, and the newest
 * wins: the is_current row by when it was stored, an upcoming row by when it
 * took effect. That way a refresh stored after the switch-over still beats it.
 */
export async function getCurrentPolicy(
  policySourceId: string,
  db: Queryable = pool,
): Promise<PolicyRow | null> {
  const { rows } = await db.query<PolicyRow>(
    `SELECT * FROM policies
     WHERE policy_source_id = $1
       AND (is_current = TRUE OR (effective_at IS NOT NULL AND effective_at <= NOW()))
     ORDER BY CASE WHEN is_current THEN created_at ELSE effective_at END DESC
     LIMIT 1`,
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

/**
 * Store an announced policy that takes effect later (migration 010).
 *
 * Unlike insertNewPolicy this does NOT demote the current policy: the old text
 * stays in force until effectiveAt, and public read paths hide this row until
 * then. It is inserted with is_current = FALSE so the one-current-per-source
 * unique index is unaffected. `url` is only needed when the upcoming text lives
 * somewhere other than the source URL.
 *
 * Idempotent on (source, content_hash, effective_at): re-running an ingest
 * returns the existing row instead of stacking duplicates.
 */
export async function insertUpcomingPolicy(
  policySourceId: string,
  rawText: string,
  contentHash: string,
  httpStatus: number | null,
  effectiveAt: Date,
  url: string | null,
  db: Queryable = pool,
): Promise<{ policy: PolicyRow; created: boolean }> {
  const existing = await db.query<PolicyRow>(
    `SELECT * FROM policies
     WHERE policy_source_id = $1 AND content_hash = $2 AND effective_at = $3`,
    [policySourceId, contentHash, effectiveAt]
  );
  if (existing.rows[0]) return { policy: existing.rows[0], created: false };

  const { rows } = await db.query<PolicyRow>(
    `INSERT INTO policies
       (policy_source_id, raw_text, content_hash, char_count, http_status, is_current, effective_at, url)
     VALUES ($1, $2, $3, $4, $5, FALSE, $6, $7)
     RETURNING *`,
    [policySourceId, rawText, contentHash, rawText.length, httpStatus, effectiveAt, url]
  );
  return { policy: rows[0]!, created: true };
}
