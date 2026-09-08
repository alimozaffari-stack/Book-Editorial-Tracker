const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const args = process.argv.slice(2);

function valueFor(name, fallback = undefined) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  if (index + 1 >= args.length) throw new Error(`Missing value for ${name}`);
  return args[index + 1];
}

function hasFlag(name) {
  return args.includes(name);
}

const sourceRoot = path.resolve(valueFor('--source', process.cwd()));
const destinationRoot = valueFor('--destination');
const variant = valueFor('--variant', process.env.VITE_APP_VARIANT || 'team');
const logPath = path.resolve(valueFor('--log', path.join(sourceRoot, '.tmp_staging.log')));
const force = hasFlag('--force');
const skipInstall = hasFlag('--skip-install');

if (!destinationRoot) {
  throw new Error('Missing required --destination argument.');
}

const destinationResolved = path.resolve(destinationRoot);

const summary = {
  input: {
    sourceRoot,
    destinationRoot: destinationResolved,
    variant,
    skipInstall,
  },
  output: {
    copiedFiles: 0,
    copiedDirectories: 0,
    skippedPaths: [],
    failures: 0,
  },
  npm: {
    installAttempted: !skipInstall,
    installRan: false,
    exitCode: null,
  },
  checks: {
    nodeModulesPresent: false,
    jszipPresent: false,
  },
};

function log(message) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`, 'utf8');
}

function copyFile(sourcePath, targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
  summary.output.copiedFiles += 1;
}

function copyDirectory(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath)) return;
  for (const entry of fs.readdirSync(sourcePath, { withFileTypes: true })) {
    const resolvedSource = path.join(sourcePath, entry.name);
    const resolvedTarget = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(resolvedSource, resolvedTarget);
      continue;
    }
    if (!entry.isFile() && !entry.isSymbolicLink()) continue;
    if (entry.isSymbolicLink()) continue;
    copyFile(resolvedSource, resolvedTarget);
  }
}

function copyEntry(entry) {
  const sourcePath = path.join(sourceRoot, entry.source);
  const destinationPath = path.join(destinationResolved, entry.source);

  if (!fs.existsSync(sourcePath)) {
    if (entry.required) {
      throw new Error(`Missing required staging input: ${entry.source}`);
    }
    summary.output.skippedPaths.push(entry.source);
    return;
  }

  const stat = fs.statSync(sourcePath);
  if (stat.isDirectory()) {
    summary.output.copiedDirectories += 1;
    copyDirectory(sourcePath, destinationPath);
    return;
  }
  copyFile(sourcePath, destinationPath);
}

function runNpmInstall() {
  if (skipInstall) {
    log(`status=skip_install destination=${destinationResolved}`);
    return;
  }
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const probe = spawnSync(npmCmd, ['--version'], { encoding: 'utf8', shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  if (probe.status !== 0) {
    throw new Error(`Unable to invoke npm from destination context (${probe.error?.message || 'unknown error'}).`);
  }
  const result = spawnSync(
    npmCmd,
    ['install', '--omit=dev', '--ignore-scripts'],
    {
      cwd: destinationResolved,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    },
  );
  summary.npm.installRan = true;
  summary.npm.exitCode = result.status;
  if (typeof result.stdout === 'string' && result.stdout.length > 0) log(`npm_stdout=${JSON.stringify(result.stdout)}`);
  if (typeof result.stderr === 'string' && result.stderr.length > 0) log(`npm_stderr=${JSON.stringify(result.stderr)}`);
  if (result.status !== 0) {
    throw new Error(`npm install failed with exit code ${result.status}.`);
  }
}

function verifyRuntimeBoundary() {
  const nodeModulesRoot = path.join(destinationResolved, 'node_modules');
  summary.checks.nodeModulesPresent = fs.existsSync(nodeModulesRoot);
  summary.checks.jszipPresent = fs.existsSync(path.join(nodeModulesRoot, 'jszip', 'package.json'));
  return summary.checks.nodeModulesPresent && summary.checks.jszipPresent;
}

function printSummary() {
  log(
    `status=complete source=${summary.input.sourceRoot} destination=${summary.input.destinationRoot} `
      + `copiedFiles=${summary.output.copiedFiles} copiedDirectories=${summary.output.copiedDirectories} `
      + `skipped=${summary.output.skippedPaths.length} npmRan=${summary.npm.installRan} `
      + `npmExit=${summary.npm.exitCode} nodeModules=${summary.checks.nodeModulesPresent} jszip=${summary.checks.jszipPresent}`,
  );
  process.stdout.write(JSON.stringify(summary));
}

function fail(message) {
  summary.output.failures = 1;
  log(`status=fatal message=${JSON.stringify(message)}`);
  process.stderr.write(`${message}\n`);
  process.stdout.write(JSON.stringify(summary));
  process.exit(1);
}

function run() {
  if (fs.existsSync(destinationResolved) && !force) {
    throw new Error(`Destination already exists. Use --force to overwrite: ${destinationResolved}`);
  }

  if (fs.existsSync(destinationResolved)) {
    fs.rmSync(destinationResolved, { recursive: true, force: true });
  }

  log(
    `status=start source=${sourceRoot} destination=${destinationResolved} `
    + `variant=${variant} skipInstall=${skipInstall}`,
  );

  fs.mkdirSync(destinationResolved, { recursive: true });

  const entries = [
    { source: 'package.json', required: true },
    { source: 'forge.config.js', required: true },
    { source: 'package-lock.json', required: false },
    { source: 'dist', required: true },
    { source: 'electron', required: true },
    { source: 'assets', required: true },
  ];

  for (const entry of entries) {
    copyEntry(entry);
  }

  if (variant === 'public') {
    const publicConfigPath = path.join(destinationResolved, 'firebase-applet-config.json');
    if (fs.existsSync(publicConfigPath)) {
      fs.rmSync(publicConfigPath);
      summary.output.skippedPaths.push('firebase-applet-config.json');
    }
  }

  runNpmInstall();
  const runtimeReady = verifyRuntimeBoundary();
  if (!runtimeReady && !skipInstall) {
    throw new Error('Staged output does not contain runtime dependency module jszip.');
  }
  printSummary();
  if (summary.npm.exitCode === null && skipInstall) {
    log('status=complete_note=manual_install_needed');
  } else {
    log('status=complete_note=install_required_and_done');
  }
}

try {
  run();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
