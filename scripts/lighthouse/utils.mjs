/**
 * Shared utilities — scoring, port finding, timestamps, logging.
 */

import { createServer } from 'net';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { THRESHOLDS } from './config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const ROOT = resolve(__dirname, '../..');

/**
 * Format a 0-1 Lighthouse score as "**XX** 🟢/🟡/🔴".
 */
export function scoreEmoji(score) {
  if (score === null || score === undefined) return '**N/A** ⚪';
  const value = Math.round(score * 100);
  if (value >= THRESHOLDS.green) return `**${value}** 🟢`;
  if (value >= THRESHOLDS.yellow) return `**${value}** 🟡`;
  return `**${value}** 🔴`;
}

/**
 * Numeric score (0-100) from a 0-1 Lighthouse score.
 */
export function numericScore(score) {
  if (score === null || score === undefined) return null;
  return Math.round(score * 100);
}

/**
 * Find a free TCP port, starting from the preferred port.
 */
export function findFreePort(preferred = 3000) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(preferred, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      // Port taken — try a random one
      const server2 = createServer();
      server2.listen(0, () => {
        const { port } = server2.address();
        server2.close(() => resolve(port));
      });
      server2.on('error', reject);
    });
  });
}

/**
 * Timestamp string for folder names: YYYY-MM-DD_HHmmss
 */
export function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/**
 * Human-readable date for report headers.
 */
export function formattedDate() {
  return new Date().toLocaleString('en-GB', {
    dateStyle: 'full',
    timeStyle: 'short',
  });
}

const PREFIX = '[lighthouse]';

export function log(...args) {
  console.log(PREFIX, ...args);
}

export function logError(...args) {
  console.error(PREFIX, '❌', ...args);
}
