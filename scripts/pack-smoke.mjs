import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('..', import.meta.url);
const rootPath = fileURLToPath(root);
const tscPath = fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url));
const tempDir = mkdtempSync(join(tmpdir(), 'welog-pack-smoke-'));
const npmSmokeEnv = { ...process.env, npm_config_dry_run: 'false' };
let tarballPath;

try {
  execFileSync('npm', ['run', 'build'], { cwd: rootPath, stdio: 'inherit' });

  const tarball = execFileSync('npm', ['pack', '--json'], {
    cwd: rootPath,
    env: npmSmokeEnv,
    encoding: 'utf8'
  });
  const [{ filename }] = JSON.parse(tarball);
  tarballPath = join(rootPath, filename);

  execFileSync('npm', ['init', '-y'], {
    cwd: tempDir,
    env: npmSmokeEnv,
    stdio: 'ignore'
  });
  execFileSync('npm', ['install', '--ignore-scripts', tarballPath], {
    cwd: tempDir,
    env: npmSmokeEnv,
    stdio: 'inherit'
  });
  execFileSync('npm', ['pkg', 'set', 'type=module'], {
    cwd: tempDir,
    env: npmSmokeEnv,
    stdio: 'ignore'
  });

  writeFileSync(
    join(tempDir, 'smoke.mjs'),
    `
      import { createRequire } from 'node:module';

      const require = createRequire(import.meta.url);
      const welog = await import('@bagaking/welog');
      const expectedExports = [
        'ConsoleMiddleware',
        'ContextImpl',
        'LogLevel',
        'SpanLogMiddleware',
        'SpanStatus',
        'createLogger',
        'newContext'
      ];
      const actualExports = Object.keys(welog).sort();

      if (JSON.stringify(actualExports) !== JSON.stringify(expectedExports)) {
        throw new Error(\`unexpected root exports: \${actualExports.join(', ')}\`);
      }

      const packageMetadata = require('@bagaking/welog/package.json');
      if (packageMetadata.name !== '@bagaking/welog') {
        throw new Error('package metadata export returned the wrong package');
      }

      try {
        await import('@bagaking/welog/src/index.js');
        throw new Error('private source subpath import unexpectedly succeeded');
      } catch (error) {
        if (error?.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') {
          throw error;
        }
      }

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

  writeFileSync(
    join(tempDir, 'smoke.ts'),
    `
      import {
        LogLevel,
        createLogger,
        newContext,
        type Context,
        type LoggerMiddleware,
        type SpanNode
      } from '@bagaking/welog';

      const middleware: LoggerMiddleware = {
        handle(record, next) {
          if (record.level !== LogLevel.INFO) {
            throw new Error('unexpected log level');
          }
          next(record);
        }
      };

      const logger = createLogger({
        minLevel: LogLevel.INFO,
        middlewares: [middleware]
      });
      const ctx: Context = newContext({
        module: 'ts-smoke',
        logger: { minLevel: LogLevel.INFO, middlewares: [middleware] }
      });
      const child = ctx.fork({ module: 'child' });
      const tree: SpanNode = child.getGlobalSpanTree();

      logger.info('type smoke', { span: tree.span.name });
    `
  );

  writeFileSync(
    join(tempDir, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          strict: true,
          target: 'ES2022',
          noEmit: true
        },
        include: ['smoke.ts']
      },
      null,
      2
    )
  );

  execFileSync('node', ['smoke.mjs'], { cwd: tempDir, stdio: 'inherit' });
  execFileSync(process.execPath, [tscPath, '--project', 'tsconfig.json'], {
    cwd: tempDir,
    stdio: 'inherit'
  });
} finally {
  rmSync(tempDir, { recursive: true, force: true });
  if (tarballPath) {
    rmSync(tarballPath, { force: true });
  }
}
