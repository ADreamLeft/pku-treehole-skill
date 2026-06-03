#!/usr/bin/env node

import { spawn } from 'node:child_process';
import {
  access,
  copyFile,
  mkdir,
  readFile,
  readdir,
  readlink,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { constants, existsSync } from 'node:fs';
import { delimiter, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir, platform } from 'node:os';

const REQUIRED_COMMANDS = ['comment', 'export-markdown', 'latest', 'post', 'search', 'tags', 'write'];
const USER_RUNTIME_PACKAGE = {
  name: 'opencli-user-runtime',
  private: true,
  type: 'module',
};

function packageRootFromHere() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

function formatTimestamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function assertReadable(path, label) {
  try {
    await access(path, constants.R_OK);
  } catch {
    throw new Error(`${label} not found: ${path}`);
  }
}

export async function collectRuntimeFiles(packageRoot = packageRootFromHere()) {
  const sourceDir = join(packageRoot, 'opencli', 'clis', 'treehole');
  const entries = await readdir(sourceDir);
  return entries
    .filter((entry) => entry.endsWith('.js') && !entry.endsWith('.test.js'))
    .sort();
}

async function findExecutable(name, envPath = process.env.PATH ?? '') {
  if (name.includes('/') || name.includes('\\')) {
    await assertReadable(name, 'opencli executable');
    return name;
  }

  const extensions = platform() === 'win32' ? ['', '.cmd', '.exe', '.bat'] : [''];
  for (const dir of envPath.split(delimiter).filter(Boolean)) {
    for (const ext of extensions) {
      const candidate = join(dir, `${name}${ext}`);
      try {
        await access(candidate, constants.X_OK);
        return candidate;
      } catch {
        if (platform() === 'win32' && existsSync(candidate)) return candidate;
      }
    }
  }
  throw new Error(`Could not find ${name} on PATH. Install OpenCLI first: npm install -g @jackwener/opencli`);
}

export async function findOpencliPackageRoot(opencliBin) {
  const resolvedBin = await realpath(opencliBin);
  let dir = dirname(resolvedBin);
  while (true) {
    const pkgPath = join(dir, 'package.json');
    try {
      const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
      if (pkg.name === '@jackwener/opencli') return dir;
    } catch {
      // Keep walking.
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`Could not find @jackwener/opencli package root above ${resolvedBin}`);
    }
    dir = parent;
  }
}

async function ensureUserRuntime({ opencliRoot, opencliDir, dryRun }) {
  const packageJsonPath = join(opencliDir, 'package.json');
  const symlinkDir = join(opencliDir, 'node_modules', '@jackwener');
  const symlinkPath = join(symlinkDir, 'opencli');
  const packageJson = `${JSON.stringify(USER_RUNTIME_PACKAGE, null, 2)}\n`;

  if (dryRun) {
    return {
      packageJsonPath,
      symlinkPath,
      opencliRoot,
    };
  }

  await mkdir(symlinkDir, { recursive: true });
  await writeFile(packageJsonPath, packageJson, 'utf8');

  let needsLink = true;
  try {
    const current = await readlink(symlinkPath);
    needsLink = resolve(symlinkDir, current) !== resolve(opencliRoot);
  } catch {
    needsLink = true;
  }
  if (needsLink) {
    await rm(symlinkPath, { recursive: true, force: true });
    await symlink(opencliRoot, symlinkPath, platform() === 'win32' ? 'junction' : 'dir');
  }

  return {
    packageJsonPath,
    symlinkPath,
    opencliRoot,
  };
}

async function copyRuntimeFiles({ packageRoot, destination, files }) {
  const sourceDir = join(packageRoot, 'opencli', 'clis', 'treehole');
  await mkdir(destination, { recursive: true });
  for (const file of files) {
    await copyFile(join(sourceDir, file), join(destination, file));
  }
}

function extractCommandNames(helpText) {
  const names = [];
  let inCommands = false;
  for (const line of helpText.split(/\r?\n/)) {
    if (line === 'commands:') {
      inCommands = true;
      continue;
    }
    if (inCommands && line && !line.startsWith(' ')) break;
    if (!inCommands) continue;
    const match = line.match(/^  - name:\s*['"]?([^'"\s]+)['"]?\s*$/);
    if (match) names.push(match[1]);
  }
  return [...new Set(names)].sort();
}

function validateCommands(commands) {
  const missing = REQUIRED_COMMANDS.filter((name) => !commands.includes(name));
  if (missing.length) {
    throw new Error(`opencli treehole is missing commands: ${missing.join(', ')}`);
  }
}

function defaultRunCommand(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
      } else {
        reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}\n${stderr}`));
      }
    });
  });
}

export async function doctor({
  homeDir = homedir(),
  opencliBin,
  runCommand = defaultRunCommand,
} = {}) {
  const resolvedOpencliBin = opencliBin ?? await findExecutable('opencli');
  const opencliRoot = await findOpencliPackageRoot(resolvedOpencliBin);
  const opencliDir = join(homeDir, '.opencli');
  const treeholeDir = join(opencliDir, 'clis', 'treehole');
  const result = await runCommand(resolvedOpencliBin, ['treehole', '--help', '-f', 'yaml']);
  const commands = extractCommandNames(result.stdout);
  validateCommands(commands);
  return {
    ok: true,
    opencliBin: resolvedOpencliBin,
    opencliRoot,
    treeholeDir,
    commands,
  };
}

export async function installAdapter({
  homeDir = homedir(),
  opencliBin,
  packageRoot = packageRootFromHere(),
  dryRun = false,
  verify = true,
  now = new Date(),
  runCommand = defaultRunCommand,
} = {}) {
  const resolvedOpencliBin = opencliBin ?? await findExecutable('opencli');
  const opencliRoot = await findOpencliPackageRoot(resolvedOpencliBin);
  const opencliDir = join(homeDir, '.opencli');
  const destination = join(opencliDir, 'clis', 'treehole');
  const backup = join(opencliDir, 'backups', `treehole-${formatTimestamp(now)}`);
  const files = await collectRuntimeFiles(packageRoot);

  if (dryRun) {
    return {
      dryRun: true,
      opencliBin: resolvedOpencliBin,
      opencliRoot,
      destination,
      backup: await pathExists(destination) ? backup : null,
      files,
      runtime: await ensureUserRuntime({ opencliRoot, opencliDir, dryRun: true }),
      verified: false,
    };
  }

  const runtime = await ensureUserRuntime({ opencliRoot, opencliDir, dryRun: false });
  let actualBackup = null;
  if (await pathExists(destination)) {
    await mkdir(dirname(backup), { recursive: true });
    await rm(backup, { recursive: true, force: true });
    await rename(destination, backup);
    actualBackup = backup;
  }
  await copyRuntimeFiles({ packageRoot, destination, files });

  let verification = null;
  if (verify) {
    verification = await doctor({
      homeDir,
      opencliBin: resolvedOpencliBin,
      runCommand,
    });
  }

  return {
    dryRun: false,
    opencliBin: resolvedOpencliBin,
    opencliRoot,
    destination,
    backup: actualBackup,
    files,
    runtime,
    verified: Boolean(verification?.ok),
    commands: verification?.commands ?? [],
  };
}

function printInstallResult(result) {
  const lines = [
    result.dryRun ? 'Treehole adapter install dry-run:' : 'Treehole adapter installed:',
    `- OpenCLI: ${result.opencliRoot}`,
    `- Destination: ${result.destination}`,
    `- Files: ${result.files.join(', ')}`,
  ];
  if (result.backup) lines.push(`- Backup: ${result.backup}`);
  if (result.verified) lines.push(`- Verified commands: ${result.commands.join(', ')}`);
  console.log(lines.join('\n'));
}

function printDoctorResult(result) {
  console.log([
    'Treehole adapter doctor:',
    `- OpenCLI: ${result.opencliRoot}`,
    `- Adapter dir: ${result.treeholeDir}`,
    `- Commands: ${result.commands.join(', ')}`,
  ].join('\n'));
}

function usage() {
  return [
    'Usage:',
    '  opencli-treehole-adapter install [--dry-run]',
    '  opencli-treehole-adapter doctor',
    '',
    'Install OpenCLI first:',
    '  npm install -g @jackwener/opencli',
  ].join('\n');
}

async function main(argv) {
  const command = argv.find((arg) => !arg.startsWith('-')) ?? 'help';
  const dryRun = argv.includes('--dry-run');
  if (command === 'install') {
    printInstallResult(await installAdapter({ dryRun }));
    return;
  }
  if (command === 'doctor') {
    printDoctorResult(await doctor());
    return;
  }
  if (command === 'help' || command === '--help' || command === '-h') {
    console.log(usage());
    return;
  }
  throw new Error(`Unknown command: ${command}\n${usage()}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
