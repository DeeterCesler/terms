#!/usr/bin/env node
import { Command } from 'commander';
import { statusCommand } from './commands/status.js';
import { listCommand } from './commands/list.js';

const program = new Command()
  .name('term-checker-admin')
  .description('Admin CLI for Term Checker — privacy policy analyzer (read-only; analysis happens locally via scripts/insert-direct.ts)')
  .version('1.0.0');

program
  .command('status <domain>')
  .description('Show the latest analysis for a domain')
  .action(statusCommand);

program
  .command('list')
  .description('List all sites in the DB')
  .action(listCommand);

program.parseAsync(process.argv).catch(err => {
  console.error(err);
  process.exit(1);
});
