/**
 * Local Next.js server management — build and start with cleanup.
 */

import { spawn } from 'child_process';
import { findFreePort, log, logError, ROOT } from './utils.mjs';

/**
 * Run `npm run build` and wait for completion.
 */
export function buildProject() {
  return new Promise((resolve, reject) => {
    log('Building project...');
    const proc = spawn('npm', ['run', 'build'], {
      cwd: ROOT,
      stdio: 'inherit',
      shell: true,
    });
    proc.on('close', (code) => {
      if (code === 0) {
        log('Build complete.');
        resolve();
      } else {
        reject(new Error(`Build failed with exit code ${code}`));
      }
    });
    proc.on('error', reject);
  });
}

/**
 * Start `next start` on a free port. Polls until the server responds.
 * Returns { port, kill() }.
 */
export async function startServer() {
  const port = await findFreePort(3000);
  log(`Starting server on port ${port}...`);

  const proc = spawn('npm', ['run', 'start', '--', '-p', String(port)], {
    cwd: ROOT,
    stdio: 'pipe',
    shell: true,
  });

  let stderr = '';
  proc.stderr.on('data', (d) => { stderr += d.toString(); });

  const kill = () => {
    try {
      if (process.platform === 'win32') {
        // On Windows, npm spawns via cmd so proc.kill() doesn't reach the child.
        spawn('taskkill', ['/f', '/t', '/pid', String(proc.pid)], {
          stdio: 'ignore',
          shell: true,
        });
      } else {
        proc.kill('SIGTERM');
      }
    } catch {
      // Already dead
    }
  };

  // Poll until server is reachable
  const timeout = 60_000;
  const start = Date.now();
  const url = `http://localhost:${port}/`;

  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok || res.status === 404) {
        log(`Server ready at ${url}`);
        return { port, kill };
      }
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  kill();
  throw new Error(`Server failed to start within ${timeout / 1000}s.\n${stderr}`);
}
