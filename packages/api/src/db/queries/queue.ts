import { pool } from '../client.js';
import type { ProcessingQueueRow } from '@term-checker/shared';

export async function enqueueJob(
  siteId: string,
  action: 'crawl_and_analyze' | 'reanalyze',
  triggeredBy: string,
  policySourceId?: string | null,
): Promise<ProcessingQueueRow> {
  const { rows } = await pool.query<ProcessingQueueRow>(
    `INSERT INTO processing_queue (site_id, action, triggered_by, policy_source_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [siteId, action, triggeredBy, policySourceId ?? null]
  );
  return rows[0]!;
}

export async function claimNextJob(): Promise<ProcessingQueueRow | null> {
  const { rows } = await pool.query<ProcessingQueueRow>(`
    UPDATE processing_queue
    SET status = 'processing', started_at = NOW()
    WHERE id = (
      SELECT id FROM processing_queue
      WHERE status = 'pending'
      ORDER BY created_at
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `);
  return rows[0] ?? null;
}

export async function completeJob(id: string): Promise<void> {
  await pool.query(
    `UPDATE processing_queue SET status = 'done', completed_at = NOW() WHERE id = $1`,
    [id]
  );
}

export async function failJob(id: string, errorMessage: string): Promise<void> {
  await pool.query(
    `UPDATE processing_queue SET status = 'failed', completed_at = NOW(), error_message = $2 WHERE id = $1`,
    [id, errorMessage]
  );
}

export async function recoverStaleJobs(staleAfterMs: number): Promise<number> {
  const { rowCount } = await pool.query(`
    UPDATE processing_queue
    SET status = 'pending', started_at = NULL
    WHERE status = 'processing'
      AND started_at < NOW() - ($1 || ' milliseconds')::INTERVAL
  `, [staleAfterMs]);
  return rowCount ?? 0;
}

export async function listQueue(
  status?: string,
  limit = 50,
  offset = 0,
): Promise<Array<ProcessingQueueRow & { domain: string }>> {
  const conditions = status ? `AND pq.status = $3` : '';
  const args: unknown[] = [limit, offset];
  if (status) args.push(status);

  const { rows } = await pool.query(
    `SELECT pq.*, s.domain
     FROM processing_queue pq
     JOIN sites s ON s.id = pq.site_id
     WHERE 1=1 ${conditions}
     ORDER BY pq.created_at DESC
     LIMIT $1 OFFSET $2`,
    args
  );
  return rows;
}
