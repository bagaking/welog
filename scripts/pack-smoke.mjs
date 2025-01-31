import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('..', import.meta.url);
const rootPath = fileURLToPath(root);
const tempDir = mkdtempSync(join(tmpdir(), 'welog-pack-smoke-'));
let tarballPath;

try {
  execFileSync('npm', ['run', 'build'], { cwd: rootPath, stdio: 'inherit' });

  const tarball = execFileSync('npm', ['pack', '--json'], {
    cwd: rootPath,
    encoding: 'utf8'
  });
  const [{ filename }] = JSON.parse(tarball);
  tarballPath = join(rootPath, filename);

  execFileSync('npm', ['init', '-y'], { cwd: tempDir, stdio: 'ignore' });
  execFileSync('npm', ['install', '--ignore-scripts', tarballPath], {
    cwd: tempDir,
    stdio: 'inherit'
  });

  writeFileSync(
    join(tempDir, 'smoke.mjs'),
    `
      const welog = await import('@bagaking/welog');
      const ctx = welog.newContext({
        module: 'smoke',
        logger: { middlewares: [] }
      });
      const span = ctx.startSpan('root-import');
      ctx.logger.info('package smoke', { ok: true });
      span.end();

      const child = ctx.fork({ module: 'child', params: { requestId: 'smoke' } });
      if (child.params.requestId !== 'smoke') {
        throw new Error('fork params were not preserved');
      }
      if (typeof welog.createLogger !== 'function') {
        throw new Error('createLogger export missing');
      }
    `
  );

  execFileSync('node', ['smoke.mjs'], { cwd: tempDir, stdio: 'inherit' });
} finally {
  rmSync(tempDir, { recursive: true, force: true });
  if (tarballPath) {
    rmSync(tarballPath, { force: true });
  }
}
