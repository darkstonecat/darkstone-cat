#!/usr/bin/env node

/**
 * Lighthouse audit orchestrator.
 *
 * Usage:
 *   node scripts/lighthouse/run-audit.mjs           # local mode (build + start + audit)
 *   node scripts/lighthouse/run-audit.mjs --prod     # production mode (audit darkstone.cat)
 */

import { mkdir } from 'fs/promises';
import { join } from 'path';
import { PRODUCTION_BASE_URL } from './config.mjs';
import { timestamp, log, logError, ROOT } from './utils.mjs';
import { buildProject, startServer } from './server.mjs';
import { runAllAudits } from './auditor.mjs';
import { generateMarkdownReport } from './report.mjs';

const args = process.argv.slice(2);
const isProd = args.includes('--prod') || args.includes('--production');
const mode = isProd ? 'prod' : 'local';

const ts = timestamp();
const outputDir = join(ROOT, 'audits', 'lighthouse', ts);

async function main() {
  const startTime = Date.now();
  log(`Starting Lighthouse audit (${mode} mode)`);

  await mkdir(outputDir, { recursive: true });

  let server = null;
  let baseUrl;

  try {
    if (isProd) {
      baseUrl = PRODUCTION_BASE_URL;
      log(`Auditing production: ${baseUrl}`);
    } else {
      await buildProject();
      server = await startServer();
      baseUrl = `http://localhost:${server.port}`;
    }

    const results = await runAllAudits(baseUrl, outputDir);
    const reportPath = await generateMarkdownReport(results, mode, outputDir);

    // Print summary
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const passed = results.filter((r) => !r.error).length;
    const failed = results.filter((r) => r.error).length;

    console.log('');
    log('═══════════════════════════════════════');
    log(`  Audits complete: ${passed} passed, ${failed} failed`);
    log(`  Time: ${elapsed}s`);
    log(`  Report: ${reportPath}`);
    log(`  Raw files: ${join(outputDir, 'raw')}`);
    log('═══════════════════════════════════════');
  } catch (err) {
    logError('Fatal error:', err.message);
    process.exitCode = 1;
  } finally {
    if (server) {
      log('Stopping local server...');
      server.kill();
    }
  }
}

main();
