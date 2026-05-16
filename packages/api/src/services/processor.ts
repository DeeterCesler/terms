import { listPolicySourcesBySite } from '../db/queries/policy_sources.js';
import { getCurrentPolicy, insertNewPolicy } from '../db/queries/policies.js';
import { insertAnalysis, insertFailedAnalysis } from '../db/queries/analyses.js';
import { claimNextJob, completeJob, failJob, recoverStaleJobs } from '../db/queries/queue.js';
import { pool } from '../db/client.js';
import { crawlPolicyUrl } from './crawler.js';
import { analyzePolicy } from './analyzer.js';
import { config } from '../config.js';
import type { PolicySourceRow } from '@term-checker/shared';

async function processPolicySource(
  source: PolicySourceRow,
  siteId: string,
  forceReanalyze: boolean,
): Promise<void> {
  const crawl = await crawlPolicyUrl(source.url);
  const existing = await getCurrentPolicy(source.id);

  if (existing && existing.content_hash === crawl.contentHash && !forceReanalyze) {
    console.log(`[processor] No change detected for ${source.url}, skipping`);
    return;
  }

  const policy = await insertNewPolicy(source.id, crawl.text, crawl.contentHash, crawl.httpStatus);

  try {
    const analysis = await analyzePolicy(crawl.text);
    await insertAnalysis(
      policy.id,
      siteId,
      source.id,
      analysis.result,
      analysis.rawResponse,
      analysis.modelUsed,
      analysis.promptVersion,
    );
    console.log(`[processor] Analysis complete for ${source.url} score=${analysis.result.overall_score}`);
  } catch (analysisErr) {
    const msg = (analysisErr as Error).message;
    console.error(`[processor] Analysis failed for ${source.url}: ${msg}`);
    await insertFailedAnalysis(policy.id, siteId, source.id, msg, {}, 'unknown', 'unknown');
    throw analysisErr;
  }
}

export async function processNextJob(): Promise<boolean> {
  const job = await claimNextJob();
  if (!job) return false;

  console.log(`[processor] Starting job ${job.id} action=${job.action} site=${job.site_id}`);

  try {
    const { rows: siteRows } = await pool.query(
      'SELECT * FROM sites WHERE id = $1',
      [job.site_id]
    );
    const site = siteRows[0];
    if (!site) throw new Error(`Site ${job.site_id} not found`);

    let sources: PolicySourceRow[];
    if (job.policy_source_id) {
      const { rows } = await pool.query<PolicySourceRow>(
        'SELECT * FROM policy_sources WHERE id = $1',
        [job.policy_source_id]
      );
      sources = rows;
    } else {
      sources = await listPolicySourcesBySite(job.site_id);
    }

    if (sources.length === 0) {
      throw new Error(`No policy sources found for site ${job.site_id}`);
    }

    const forceReanalyze = job.action === 'reanalyze';
    for (const source of sources) {
      await processPolicySource(source, job.site_id, forceReanalyze);
    }

    await completeJob(job.id);
    return true;
  } catch (err) {
    const msg = (err as Error).message;
    console.error(`[processor] Job ${job.id} failed: ${msg}`);
    await failJob(job.id, msg);
    return true;
  }
}

export function startWorker(): NodeJS.Timeout {
  console.log(`[worker] Starting, poll interval=${config.workerPollIntervalMs}ms`);

  recoverStaleJobs(config.workerStaleJobTimeoutMs).then(n => {
    if (n > 0) console.log(`[worker] Recovered ${n} stale jobs`);
  });

  const interval = setInterval(async () => {
    try {
      let processed = true;
      while (processed) {
        processed = await processNextJob();
      }
    } catch (err) {
      console.error('[worker] Unexpected error in poll loop:', err);
    }
  }, config.workerPollIntervalMs);

  return interval;
}
