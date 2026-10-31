#!/usr/bin/env node
import { runCli } from './cli.js';

runCli().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[wannabe:fatal] ${msg}\n`);
  process.exit(1);
});
