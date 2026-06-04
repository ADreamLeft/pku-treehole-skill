import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, symlink, writeFile } from 'node:fs/promises';
import { existsSync, lstatSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

import {
  collectRuntimeFiles,
  doctor,
  installAdapter,
  shouldRunCli,
} from './opencli-treehole-adapter.mjs';

async function makeFakeOpencliRoot(root) {
  const packageRoot = join(root, 'fake-opencli');
  const main = join(packageRoot, 'dist', 'src', 'main.js');
  await mkdir(join(packageRoot, 'dist', 'src'), { recursive: true });
  await writeFile(
    join(packageRoot, 'package.json'),
    JSON.stringify({
      name: '@jackwener/opencli',
      version: '1.8.2',
      type: 'module',
      bin: { opencli: 'dist/src/main.js' },
    }),
  );
  await writeFile(main, '#!/usr/bin/env node\n');
  return { packageRoot, main };
}

test('collectRuntimeFiles excludes adapter tests', async () => {
  const root = resolve(new URL('..', import.meta.url).pathname);

  const files = await collectRuntimeFiles(root);

  assert.ok(files.includes('client.js'));
  assert.ok(files.includes('write.js'));
  assert.ok(files.includes('comment.js'));
  assert.ok(!files.some((file) => file.endsWith('.test.js')));
});

test('dry-run install reports intended work without writing files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'treehole-installer-dry-'));
  const { main } = await makeFakeOpencliRoot(root);
  const home = join(root, 'home');

  const result = await installAdapter({
    homeDir: home,
    opencliBin: main,
    dryRun: true,
    verify: false,
    now: new Date('2026-06-03T12:34:56Z'),
  });

  assert.equal(result.dryRun, true);
  assert.equal(result.destination, join(home, '.opencli', 'clis', 'treehole'));
  assert.ok(result.files.includes('client.js'));
  assert.ok(!existsSync(join(home, '.opencli')));
});

test('install backs up existing adapter and copies runtime files only', async () => {
  const root = await mkdtemp(join(tmpdir(), 'treehole-installer-install-'));
  const { packageRoot, main } = await makeFakeOpencliRoot(root);
  const home = join(root, 'home');
  const existing = join(home, '.opencli', 'clis', 'treehole');
  await mkdir(existing, { recursive: true });
  await writeFile(join(existing, 'old.js'), 'old adapter');

  const result = await installAdapter({
    homeDir: home,
    opencliBin: main,
    dryRun: false,
    verify: false,
    now: new Date('2026-06-03T12:34:56Z'),
  });

  assert.equal(result.backup, join(home, '.opencli', 'backups', 'treehole-20260603-123456'));
  assert.equal(await readFile(join(result.backup, 'old.js'), 'utf8'), 'old adapter');
  assert.ok(existsSync(join(existing, 'client.js')));
  assert.ok(existsSync(join(existing, 'write.js')));
  assert.ok(!existsSync(join(existing, 'client.test.js')));
  assert.deepEqual(JSON.parse(await readFile(join(home, '.opencli', 'package.json'), 'utf8')), {
    name: 'opencli-user-runtime',
    private: true,
    type: 'module',
  });
  const link = join(home, '.opencli', 'node_modules', '@jackwener', 'opencli');
  assert.equal(lstatSync(link).isSymbolicLink(), true);
  assert.equal(resolve(await readFile(join(link, 'package.json'), 'utf8') && packageRoot), resolve(packageRoot));
});

test('doctor validates the treehole command set', async () => {
  const root = await mkdtemp(join(tmpdir(), 'treehole-installer-doctor-'));
  const { main } = await makeFakeOpencliRoot(root);
  const home = join(root, 'home');
  const commandOutput = [
    'site: treehole',
    'command_count: 7',
    'commands:',
    '  - name: comment',
    '    command_options:',
    '      - name: confirm',
    '  - name: export-markdown',
    '  - name: latest',
    '  - name: post',
    '  - name: search',
    '  - name: tags',
    '  - name: write',
    '',
  ].join('\n');

  const result = await doctor({
    homeDir: home,
    opencliBin: main,
    runCommand: async () => ({ stdout: commandOutput }),
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.commands.sort(), ['comment', 'export-markdown', 'latest', 'post', 'search', 'tags', 'write']);
});

test('CLI entrypoint runs when invoked through an npm bin symlink', () => {
  const modulePath = resolve(new URL('./opencli-treehole-adapter.mjs', import.meta.url).pathname);
  const symlinkPath = join(dirname(modulePath), '..', 'node_modules', '.bin', 'opencli-treehole-adapter');

  assert.equal(shouldRunCli(modulePath, modulePath), true);
  assert.equal(shouldRunCli(symlinkPath, modulePath), true);
});
