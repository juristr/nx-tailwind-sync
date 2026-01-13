# Nx Tailwind Sync

[![Watch the video](https://img.youtube.com/vi/tg3LnqhNNws/maxresdefault.jpg)](https://youtu.be/tg3LnqhNNws?si=RxUebKl4n1oeAZ0i)

Nx [sync generator](https://nx.dev/docs/concepts/sync-generators) that auto-manages `@source` directives in CSS files for Tailwind v4 monorepos.

## Problem

Tailwind v4 [requires `@source` directives](https://tailwindcss.com/docs/detecting-classes-in-source-files) for dependencies outside the project root. Manually maintaining these in a monorepo is error-prone. See [this blog post](https://nx.dev/blog/setup-tailwind-4-npm-workspace) for more background.

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

```bash
npm install @juristr/nx-tailwind-sync -D
```

```json
{
  "nx": {
    "targets": {
      "build": {
        "syncGenerators": ["@juristr/nx-tailwind-sync:tailwind-source-directives"]
      }
    }
  }
}
```

See [packages/tailwind-sync-plugin/README.md](packages/tailwind-sync-plugin/README.md) for full documentation.

## Contributing

See [CONTRIBUTORS.md](CONTRIBUTORS.md) for local development setup.
