import chalk from 'chalk';
import { api } from '../client.js';

export async function reprocessCommand(domain: string, options: { force?: boolean }) {
  console.log(chalk.dim(`Reprocessing ${domain}${options.force ? ' (forced)' : ''}...`));
  try {
    const result = await api.reprocess(domain, options.force ?? false);
    console.log(chalk.green('✓ Queued'));
    console.log(`  Job ID: ${result.jobId}`);
  } catch (err) {
    console.error(chalk.red('✗ Failed:'), (err as Error).message);
    process.exit(1);
  }
}
