import { readFile } from 'fs/promises';
import chalk from 'chalk';
import { api } from '../client.js';

export async function bulkCommand(filePath: string) {
  const content = await readFile(filePath, 'utf-8');
  const urls = content
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));

  console.log(chalk.dim(`Submitting ${urls.length} URLs...`));
  let ok = 0;
  let failed = 0;

  for (const url of urls) {
    try {
      const result = await api.submit(url);
      console.log(chalk.green('✓'), result.domain);
      ok++;
    } catch (err) {
      console.log(chalk.red('✗'), url, '-', (err as Error).message);
      failed++;
    }
  }

  console.log(`\nDone: ${chalk.green(ok + ' succeeded')}, ${chalk.red(failed + ' failed')}`);
}
