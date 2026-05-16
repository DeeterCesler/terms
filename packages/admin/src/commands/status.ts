import chalk from 'chalk';
import { api } from '../client.js';
import { getScoreTier } from '@term-checker/shared';

export async function statusCommand(domain: string) {
  try {
    const result = await api.check(domain) as any;
    if (!result.found) {
      console.log(chalk.yellow(`No analysis found for ${chalk.bold(domain)}`));
      return;
    }
    const tier = getScoreTier(result.analysis.overallScore);
    const scoreColor = tier.color === '#22c55e' ? chalk.green : tier.color === '#f59e0b' ? chalk.yellow : chalk.red;
    console.log(`\n${chalk.bold(domain)}`);
    console.log(`  Score:    ${scoreColor(result.analysis.overallScore + '/10')} (${tier.label})`);
    console.log(`  Analyzed: ${new Date(result.lastAnalyzed).toLocaleString()}`);
    console.log(`  Shares with 3rd parties: ${fmt(result.analysis.sharesWithThirdParties.value)}`);
    console.log(`  Sells data:              ${fmt(result.analysis.sellsData.value)}`);
    console.log(`  Data anonymized:         ${fmt(result.analysis.dataAnonymized.value)}`);
    console.log(`  Retention: ${result.analysis.dataRetention ?? 'not specified'}`);
    console.log(`  Summary: ${result.analysis.summary}`);
  } catch (err) {
    console.error(chalk.red('✗ Failed:'), (err as Error).message);
    process.exit(1);
  }
}

function fmt(val: boolean | null): string {
  if (val === null) return chalk.dim('unknown');
  return val ? chalk.red('YES') : chalk.green('NO');
}
