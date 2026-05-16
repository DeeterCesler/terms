#!/usr/bin/env node
import { Command } from 'commander';
import { submitCommand } from './commands/submit.js';
import { reprocessCommand } from './commands/reprocess.js';
import { statusCommand } from './commands/status.js';
import { listCommand } from './commands/list.js';
import { bulkCommand } from './commands/bulk.js';

const program = new Command()
  .name('term-checker-admin')
  .description('Admin CLI for Term Checker — privacy policy analyzer')
  .version('1.0.0');

program
  .command('submit <policyUrl>')
  .description('Register a new site and queue it for crawling and analysis')
  .option('-d, --domain <domain>', 'Override domain detection')
  .action(submitCommand);

program
  .command('reprocess <domain>')
  .description('Re-crawl and re-analyze an existing site')
  .option('--force', 'Force re-analysis even if policy text is unchanged')
  .action(reprocessCommand);

program
  .command('status <domain>')
  .description('Show the latest analysis for a domain')
  .action(statusCommand);

program
  .command('list')
  .description('List all sites or queue items')
  .option('--queue', 'Show processing queue instead of sites')
  .option('--status <status>', 'Filter by status (pending|processing|done|failed)')
  .action(listCommand);

program
  .command('bulk <file>')
  .description('Submit multiple URLs from a file (one URL per line)')
  .action(bulkCommand);

program.parseAsync(process.argv).catch(err => {
  console.error(err);
  process.exit(1);
});
