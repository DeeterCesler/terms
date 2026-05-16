import chalk from 'chalk';
import Table from 'cli-table3';
import { api } from '../client.js';

export async function listCommand(options: { status?: string; queue?: boolean }) {
  try {
    if (options.queue) {
      const data = await api.listQueue(options.status) as any;
      const table = new Table({
        head: ['Domain', 'Action', 'Status', 'Created', 'Error'],
        colWidths: [25, 20, 12, 22, 30],
      });
      for (const item of data.items) {
        table.push([
          item.domain,
          item.action,
          colorStatus(item.status),
          new Date(item.created_at).toLocaleString(),
          item.error_message ?? '',
        ]);
      }
      console.log(table.toString());
    } else {
      const data = await api.listSites() as any;
      const table = new Table({
        head: ['Domain', 'Score', 'Queue', 'Last Analyzed'],
        colWidths: [30, 8, 12, 22],
      });
      for (const site of data.sites) {
        table.push([
          site.domain,
          site.overallScore != null ? String(site.overallScore) : '-',
          colorStatus(site.queueStatus ?? '-'),
          site.lastAnalyzed ? new Date(site.lastAnalyzed).toLocaleString() : '-',
        ]);
      }
      console.log(table.toString());
    }
  } catch (err) {
    console.error(chalk.red('✗ Failed:'), (err as Error).message);
    process.exit(1);
  }
}

function colorStatus(status: string): string {
  switch (status) {
    case 'done': return chalk.green(status);
    case 'failed': return chalk.red(status);
    case 'processing': return chalk.yellow(status);
    default: return status;
  }
}
