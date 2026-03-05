/**
 * Chrome + Lighthouse runner — launches Chrome once and runs all audits
 * sequentially sharing the debug port.
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import { PAGES, DEVICES, CATEGORIES, LIGHTHOUSE_FLAGS } from './config.mjs';
import { log, logError } from './utils.mjs';

/**
 * Run Lighthouse audits for all pages × devices.
 * @param {string} baseUrl - e.g. "http://localhost:3000" or "https://www.darkstone.cat"
 * @param {string} outputDir - timestamped output directory
 * @returns {Array<{ slug, device, lhr?, scores?, error? }>}
 */
export async function runAllAudits(baseUrl, outputDir) {
  const rawDir = join(outputDir, 'raw');
  await mkdir(rawDir, { recursive: true });

  log('Launching Chrome...');
  const chrome = await launch({
    chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'],
  });
  log(`Chrome running on debug port ${chrome.port}`);

  const results = [];
  const total = PAGES.length * DEVICES.length;
  let current = 0;

  try {
    for (const page of PAGES) {
      for (const device of DEVICES) {
        current++;
        const url = `${baseUrl}${page.path}`;
        const label = `${page.slug} (${device})`;
        log(`[${current}/${total}] Auditing ${label} → ${url}`);

        try {
          const config = device === 'desktop' ? desktopConfig : undefined;
          const flags = {
            ...LIGHTHOUSE_FLAGS,
            port: chrome.port,
            onlyCategories: CATEGORIES,
          };

          const runnerResult = await lighthouse(url, flags, config);
          const { lhr, report } = runnerResult;

          // report is [json, html] because output: ['json', 'html']
          const [jsonReport, htmlReport] = report;
          const prefix = `${page.slug}_${device}`;

          await Promise.all([
            writeFile(join(rawDir, `${prefix}.json`), jsonReport),
            writeFile(join(rawDir, `${prefix}.html`), htmlReport),
          ]);

          const scores = {};
          for (const cat of CATEGORIES) {
            scores[cat] = lhr.categories[cat]?.score ?? null;
          }

          results.push({ slug: page.slug, device, lhr, scores });
          log(`  ✅ ${label} — Performance: ${Math.round((scores.performance ?? 0) * 100)}`);
        } catch (err) {
          logError(`${label} failed:`, err.message);
          results.push({ slug: page.slug, device, error: err.message });
        }
      }
    }
  } finally {
    log('Closing Chrome...');
    await chrome.kill();
  }

  return results;
}
