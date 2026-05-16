import chalk from 'chalk';
import { api } from '../client.js';

export async function submitCommand(policyUrl: string, options: { domain?: string }) {
  console.log(chalk.dim(`Submitting ${policyUrl}...`));
  try {
    const result = await api.submit(policyUrl, options.domain);
    console.log(chalk.green('✓ Queued'));
    console.log(`  Domain: ${chalk.bold(result.domain)}`);
    console.log(`  Job ID: ${result.jobId}`);
  } catch (err) {
    console.error(chalk.red('✗ Failed:'), (err as Error).message);
    process.exit(1);
  }
}
