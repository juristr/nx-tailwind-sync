# @juristr/nx-tailwind-sync

Nx sync generator that auto-manages `@source` directives in CSS files for Tailwind v4 monorepos.

## Problem

Tailwind v4 requires `@source` directives for dependencies outside the project root. Manually maintaining these in a monorepo is error-prone.

## Solution

This plugin traverses the Nx project graph and generates `@source` directives for all transitive dependencies.

```css
@import 'tailwindcss';

/* nx-tailwind-sources:start */
@source "../../../packages/shared/ui";
@source "../../../packages/styles";
/* nx-tailwind-sources:end */
```

## Usage

```json
{
  "nx": {
    "targets": {
      "build": {
        "syncGenerators": ["@juristr/nx-tailwind-sync:update-tailwind-globs"]
      }
    }
  }
}
```

See [packages/tailwind-sync-plugin/README.md](packages/tailwind-sync-plugin/README.md) for full documentation.

## Contributing

See [CONTRIBUTORS.md](CONTRIBUTORS.md) for local development setup.
