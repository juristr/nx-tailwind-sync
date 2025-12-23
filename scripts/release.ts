#!/usr/bin/env tsx
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import * as fs from 'fs-extra';
import * as path from 'path';

const LARGE_BUFFER = 1024 * 1000000;

interface Options {
  version: string;
  dryRun: boolean;
  local: boolean;
  clearLocalRegistry: boolean;
  firstRelease: boolean;
  from?: string;
  gitRemote: string;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    version: 'minor',
    dryRun: false,
    local: false,
    clearLocalRegistry: true,
    firstRelease: false,
    gitRemote: 'origin',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--local' || arg === '-l') {
      options.local = true;
    } else if (arg === '--first-release') {
      options.firstRelease = true;
    } else if (arg === '--clearLocalRegistry=false' || arg === '--no-clearLocalRegistry') {
      options.clearLocalRegistry = false;
    } else if (arg.startsWith('--from=')) {
      options.from = arg.split('=')[1];
    } else if (arg.startsWith('--git-remote=')) {
      options.gitRemote = arg.split('=')[1];
    } else if (!arg.startsWith('--') && !arg.startsWith('-')) {
      options.version = arg;
    }
  }

  return options;
}

function getRegistry(): URL {
  return new URL(
    execSync('npm config get registry').toString().trim()
  );
}

function isRelativeVersionKeyword(version: string): boolean {
  return [
    'major',
    'minor',
    'patch',
    'premajor',
    'preminor',
    'prepatch',
    'prerelease',
  ].includes(version);
}

async function copyPackagesToBuild() {
  const buildDir = path.join(process.cwd(), 'build');
  const packagesDir = path.join(process.cwd(), 'packages');

  await fs.remove(buildDir);
  await fs.ensureDir(path.join(buildDir, 'packages'));

  const packageDirs = await fs.readdir(packagesDir);

  for (const pkg of packageDirs) {
    const srcDir = path.join(packagesDir, pkg);
    const destDir = path.join(buildDir, 'packages', pkg);

    const stats = await fs.stat(srcDir);
    if (!stats.isDirectory()) continue;

    await fs.copy(srcDir, destDir, {
      filter: (src) => {
        return !src.includes('node_modules') && !src.includes('__tests__');
      },
    });
  }
}

function determineDistTag(version: string): string {
  if (version.includes('-')) {
    const prerelease = version.split('-')[1];
    if (
      prerelease.startsWith('beta') ||
      prerelease.startsWith('rc') ||
      prerelease.startsWith('alpha')
    ) {
      return 'next';
    }
  }

  try {
    const latestVersion = execSync(
      'npm view @juristr/nx-tailwind-sync version 2>/dev/null'
    )
      .toString()
      .trim();
    if (latestVersion) {
      const currentMajor = parseInt(version.split('.')[0], 10);
      const latestMajor = parseInt(latestVersion.split('.')[0], 10);
      if (currentMajor < latestMajor) {
        return 'previous';
      }
    }
  } catch {
    // Package not yet published
  }

  return 'latest';
}

async function publishToLocalRegistry(options: Options) {
  const registry = getRegistry();

  if (registry.hostname !== 'localhost') {
    console.error(
      'Error: --local was passed but npm registry is not localhost.'
    );
    console.error('Run: pnpm nx local-registry');
    console.error(`Current registry: ${registry.href}`);
    process.exit(1);
  }

  if (options.clearLocalRegistry) {
    console.log('Clearing local registry storage...');
    rmSync(path.join(process.cwd(), 'tmp/local-registry/storage'), {
      recursive: true,
      force: true,
    });
  }

  console.log('Copying packages to build directory...');
  await copyPackagesToBuild();

  console.log(`Bumping versions to ${options.version}...`);
  let versionCmd = `pnpm nx release version --specifier ${options.version}`;
  if (options.firstRelease) versionCmd += ' --first-release';
  execSync(versionCmd, {
    stdio: [0, 1, 2],
    maxBuffer: LARGE_BUFFER,
  });

  const distTag = determineDistTag(options.version);
  console.log(`Publishing to local registry with tag: ${distTag}`);

  const publishCmd = `pnpm nx release publish --registry=${registry.href} --tag=${distTag}`;

  if (options.dryRun) {
    console.log(`[DRY RUN] Would execute: ${publishCmd}`);
    process.exit(0);
  }

  execSync(publishCmd, { stdio: [0, 1, 2], maxBuffer: LARGE_BUFFER });
  console.log('\nPublished to local registry successfully!');
}

async function createGitHubRelease(options: Options) {
  if (isRelativeVersionKeyword(options.version)) {
    throw new Error('Must use exact semver version for releases (e.g., 1.2.0)');
  }

  console.log('Copying packages to build directory...');
  await copyPackagesToBuild();

  console.log(`Bumping versions to ${options.version}...`);
  let versionCmd = `pnpm nx release version --specifier ${options.version}`;
  if (options.firstRelease) versionCmd += ' --first-release';
  execSync(versionCmd, {
    stdio: [0, 1, 2],
    maxBuffer: LARGE_BUFFER,
  });

  console.log('Creating changelog and GitHub Release...');
  let cmd = `pnpm nx release changelog ${options.version} --interactive workspace`;
  if (options.from) cmd += ` --from ${options.from}`;
  if (options.gitRemote) cmd += ` --git-remote ${options.gitRemote}`;

  execSync(cmd, { stdio: [0, 1, 2], maxBuffer: LARGE_BUFFER });

  console.log(
    '\nGitHub Release created! Check GitHub Actions for publish status.'
  );
  process.exit(0);
}

async function publishToNpm(options: Options) {
  console.log('Copying packages to build directory...');
  await copyPackagesToBuild();

  console.log(`Bumping versions to ${options.version}...`);
  let versionCmd = `pnpm nx release version --specifier ${options.version}`;
  if (options.firstRelease) versionCmd += ' --first-release';
  execSync(versionCmd, {
    stdio: 'ignore',
    maxBuffer: LARGE_BUFFER,
  });

  const distTag = determineDistTag(options.version);
  console.log(`Publishing with tag: ${distTag}`);

  const publishCmd = `pnpm nx release publish --registry=https://registry.npmjs.org --tag=${distTag}`;

  if (options.dryRun) {
    console.log(`[DRY RUN] Would execute: ${publishCmd}`);
    process.exit(0);
  }

  execSync(publishCmd, { stdio: [0, 1, 2], maxBuffer: LARGE_BUFFER });
}

(async () => {
  const options = parseArgs();

  // Local publishing to verdaccio (default)
  if (options.local) {
    await publishToLocalRegistry(options);
    process.exit(0);
  }

  // Real publishing
  if (!process.env.CI) {
    await createGitHubRelease(options);
  } else {
    await publishToNpm(options);
  }
})();
