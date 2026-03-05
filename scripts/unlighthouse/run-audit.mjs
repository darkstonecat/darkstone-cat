#!/usr/bin/env node

/**
 * Unlighthouse audit runner — interactive HTML dashboard.
 *
 * Usage:
 *   node scripts/unlighthouse/run-audit.mjs           # local mode (build + start + audit)
 *   node scripts/unlighthouse/run-audit.mjs --prod     # production mode (audit darkstone.cat)
 */

import { spawn } from 'child_process';
import { join } from 'path';
import { PRODUCTION_BASE_URL, PAGES } from '../lighthouse/config.mjs';
import { ROOT, log } from '../lighthouse/utils.mjs';
import { buildProject, startServer } from '../lighthouse/server.mjs';

const args = process.argv.slice(2);
const isProd = args.includes('--prod') || args.includes('--production');

async function main() {
  let server = null;
  let siteUrl;

  try {
    if (isProd) {
      siteUrl = PRODUCTION_BASE_URL;
      log('Auditing production: ' + siteUrl);
    } else {
      await buildProject();
      server = await startServer();
      siteUrl = `http://localhost:${server.port}`;
    }

    log(`Running Unlighthouse on ${siteUrl}...`);

    const outputPath = join(ROOT, 'audits', 'unlighthouse');
    const urls = PAGES.map((p) => p.path).join(',');

    const child = spawn(
      'npx', [
        'unlighthouse-ci',
        '--site', siteUrl,
        '--output-path', outputPath,
        '--urls', urls,
        '--build-static', outputPath,
        '--reporter', 'jsonExpanded',
        '--no-cache',
      ],
      { stdio: 'inherit', shell: true, cwd: ROOT }
    );

    await new Promise((resolve, reject) => {
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Unlighthouse exited with code ${code}`));
      });
      child.on('error', reject);
    });

    log('Reports generated:');
    log(`  Dashboard: ${outputPath} (open index.html in browser)`);
    log(`  JSON:      ${join(outputPath, 'ci-result.json')}`);
  } finally {
    if (server) {
      log('Stopping local server...');
      server.kill();
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
