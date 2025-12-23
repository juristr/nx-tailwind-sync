# Contributing

## Setup

```bash
pnpm install
```

## Build

```bash
pnpm nx build @juristr/nx-tailwind-sync
```

## Local Testing with Verdaccio

1. Start local registry:
   ```bash
   pnpm nx local-registry
   ```

2. In another terminal, publish locally:
   ```bash
   pnpm release --local
   ```

   Options:
   - `--local` / `-l`: Publish to local verdaccio
   - `--dry-run`: Preview without publishing
   - `--first-release`: Use for first release (no previous version)
   - `--no-clearLocalRegistry`: Keep existing packages in local registry
   - `minor` / `patch` / `major`: Version bump (default: minor)

3. Test in another project:
   ```bash
   npm config set registry http://localhost:4873
   pnpm add @juristr/nx-tailwind-sync
   ```

4. Reset registry when done:
   ```bash
   npm config delete registry
   ```

## Release

Releases are triggered via GitHub Actions. Locally:

```bash
pnpm release 1.0.0
```

This creates a GitHub Release with changelog. CI handles npm publish.
