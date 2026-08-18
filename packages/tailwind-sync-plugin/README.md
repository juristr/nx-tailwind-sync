# Nx Tailwind Sync

Nx [sync generator](https://nx.dev/docs/concepts/sync-generators) that auto-manages `@source` directives in CSS files for Tailwind v4 monorepos.

## Problem

Tailwind v4 [requires to define `@source` directives](https://tailwindcss.com/docs/detecting-classes-in-source-files#explicitly-registering-sources) for dependencies that might be outside its own project configuration. Something that is common in monorepos. Manually maintaining these in a monorepo is error-prone. See [this blog post](https://nx.dev/blog/setup-tailwind-4-npm-workspace) for more background.

## Solution

This plugin traverses the Nx project graph and generates `@source` directives for all transitive dependencies.

## Detection

A project is detected as using Tailwind v4 if:

1. Has a CSS file with `@import 'tailwindcss'`
2. Has a Vite config using `tailwindcss()` from `@tailwindcss/vite`

## CSS File Search Paths

Default locations checked:

- `src/styles.css`
- `.storybook/styles.css`

Additional paths can be configured via the `additionalStylePaths` option.

## Output

The generator inserts/updates a managed block in CSS files:

```css
@import 'tailwindcss';

/* nx-tailwind-sources:start */
@source "../../../packages/shared/daypulse-ui";
@source "../../../packages/daypulse/styles";
/* nx-tailwind-sources:end */
```

## Usage

Register the sync generator on tasks that need it (e.g., `build`, `dev`):

```json
{
  "nx": {
    "targets": {
      "build": {
        "syncGenerators": ["@juristr/nx-tailwind-sync:source-directives"]
      }
    }
  }
}
```

Run manually:

```bash
pnpm nx sync
```

## Options

| Option                 | Type       | Description                                                |
| ---------------------- | ---------- | ---------------------------------------------------------- |
| `additionalStylePaths` | `string[]` | Extra relative paths to search for styles.css              |
| `exclude`              | `string[]` | Projects whose `@source` directives should not be emitted. |

Configure options in `nx.json` under `sync.generatorOptions` — Nx invokes sync generators without options, so this is where they are read from during `nx sync`:

```json
{
  "sync": {
    "generatorOptions": {
      "@juristr/nx-tailwind-sync:source-directives": {
        "exclude": ["tag:scope:server", "apps/*-e2e", "name:legacy-lib"]
      }
    }
  }
}
```

### `exclude` syntax

`exclude` uses the same project matching syntax as Nx itself (`nx run-many --exclude`, `targetDefaults`, release groups):

- `my-lib` — project name (also matches name segments and project roots)
- `name:my-lib` — strict name-only matching
- `tag:scope:server` — projects with the tag `scope:server` (globs work too: `tag:scope:*`)
- `apps/*-e2e` — glob matched against names and project roots (`directory:libs/legacy/*` forces root matching)
- `!pattern` — negation

An excluded project only has its own `@source` directive skipped; its transitive dependencies are still included (they may be reachable through other paths).

## Building

```bash
nx build @juristr/nx-tailwind-sync
```
