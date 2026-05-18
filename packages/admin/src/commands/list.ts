import chalk from 'chalk';
import Table from 'cli-table3';
import { api } from '../client.js';

export async function listCommand() {
  try {
    const data = await api.listSites() as any;
    const table = new Table({
      head: ['Domain', 'Score', 'Last Analyzed'],
      colWidths: [30, 8, 24],
    });
    for (const site of data.sites) {
      table.push([
        site.domain,
        site.overallScore != null ? String(site.overallScore) : '-',
        site.lastAnalyzed ? new Date(site.lastAnalyzed).toLocaleString() : '-',
      ]);
    }
    console.log(table.toString());
  } catch (err) {
    console.error(chalk.red('✗ Failed:'), (err as Error).message);
    process.exit(1);
  }
}
