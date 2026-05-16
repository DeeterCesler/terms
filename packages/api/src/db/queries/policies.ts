import { pool } from '../client.js';
import type { PolicyRow } from '@term-checker/shared';

export async function getCurrentPolicy(policySourceId: string): Promise<PolicyRow | null> {
  const { rows } = await pool.query<PolicyRow>(
    'SELECT * FROM policies WHERE policy_source_id = $1 AND is_current = TRUE',
    [policySourceId]
  );
  return rows[0] ?? null;
}

export async function insertNewPolicy(
  policySourceId: string,
  rawText: string,
  contentHash: string,
  httpStatus: number | null,
): Promise<PolicyRow> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      'UPDATE policies SET is_current = FALSE WHERE policy_source_id = $1 AND is_current = TRUE',
      [policySourceId]
    );

    const { rows } = await client.query<PolicyRow>(
      `INSERT INTO policies (policy_source_id, raw_text, content_hash, char_count, http_status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [policySourceId, rawText, contentHash, rawText.length, httpStatus]
    );

    await client.query('COMMIT');
    return rows[0]!;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
