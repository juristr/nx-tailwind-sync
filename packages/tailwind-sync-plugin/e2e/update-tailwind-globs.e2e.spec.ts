import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  ensureNxProject,
  runNxCommand,
  runCommand,
  updateFile,
  readFile,
  cleanup,
  uniq,
} from '@nx/plugin/testing';

describe('update-tailwind-globs e2e', () => {
  beforeAll(() => {
    ensureNxProject(
      '@juristr/nx-tailwind-sync',
      'dist/packages/tailwind-sync-plugin'
    );
  });

  afterAll(() => {
    cleanup();
  });

  beforeEach(() => {
    // Reset Nx daemon to clear project graph cache between tests
    runCommand('npx nx reset', {});
  });

  it('should add @source directive for single dependency', () => {
    const app = uniq('app');
    const lib = uniq('lib');

    // Create app project with tailwind CSS
    updateFile(
      `apps/${app}/project.json`,
      JSON.stringify({
        name: app,
        root: `apps/${app}`,
        sourceRoot: `apps/${app}/src`,
        implicitDependencies: [lib],
      })
    );
    updateFile(`apps/${app}/src/styles.css`, `@import 'tailwindcss';`);
    updateFile(`apps/${app}/src/main.ts`, `console.log('app');`);

    // Create lib project
    updateFile(
      `libs/${lib}/project.json`,
      JSON.stringify({
        name: lib,
        root: `libs/${lib}`,
        sourceRoot: `libs/${lib}/src`,
      })
    );
    updateFile(`libs/${lib}/src/index.ts`, `export const x = 1;`);

    // Run the sync generator (silenceError because sync generators have different return format)
    runNxCommand(`g @juristr/nx-tailwind-sync:update-tailwind-globs`, {
      silenceError: true,
    });

    // Verify CSS was updated
    const css = readFile(`apps/${app}/src/styles.css`);
    expect(css).toContain('nx-tailwind-sources:start');
    expect(css).toContain('nx-tailwind-sources:end');
    expect(css).toContain(`@source`);
    expect(css).toContain(lib);
  });

  it('should add @source for transitive dependencies', () => {
    const app = uniq('app');
    const libA = uniq('lib-a');
    const libB = uniq('lib-b');

    // app -> lib-a -> lib-b
    updateFile(
      `apps/${app}/project.json`,
      JSON.stringify({
        name: app,
        root: `apps/${app}`,
        sourceRoot: `apps/${app}/src`,
        implicitDependencies: [libA],
      })
    );
    updateFile(`apps/${app}/src/styles.css`, `@import 'tailwindcss';`);
    updateFile(`apps/${app}/src/main.ts`, `console.log('app');`);

    updateFile(
      `libs/${libA}/project.json`,
      JSON.stringify({
        name: libA,
        root: `libs/${libA}`,
        sourceRoot: `libs/${libA}/src`,
        implicitDependencies: [libB],
      })
    );
    updateFile(`libs/${libA}/src/index.ts`, `export const a = 1;`);

    updateFile(
      `libs/${libB}/project.json`,
      JSON.stringify({
        name: libB,
        root: `libs/${libB}`,
        sourceRoot: `libs/${libB}/src`,
      })
    );
    updateFile(`libs/${libB}/src/index.ts`, `export const b = 1;`);

    // Run generator
    runNxCommand(`g @juristr/nx-tailwind-sync:update-tailwind-globs`, {
      silenceError: true,
    });

    // Verify both deps in CSS
    const css = readFile(`apps/${app}/src/styles.css`);
    expect(css).toContain(libA);
    expect(css).toContain(libB);
  });

  it('should not add block when no dependencies', () => {
    const app = uniq('app');

    updateFile(
      `apps/${app}/project.json`,
      JSON.stringify({
        name: app,
        root: `apps/${app}`,
        sourceRoot: `apps/${app}/src`,
      })
    );
    updateFile(`apps/${app}/src/styles.css`, `@import 'tailwindcss';`);
    updateFile(`apps/${app}/src/main.ts`, `console.log('app');`);

    runNxCommand(`g @juristr/nx-tailwind-sync:update-tailwind-globs`, {
      silenceError: true,
    });

    const css = readFile(`apps/${app}/src/styles.css`);
    // Should not have @source directives if no deps (empty managed block is ok)
    expect(css).not.toContain('@source');
  });

  it('should update existing managed block', () => {
    const app = uniq('app');
    const oldLib = uniq('old-lib');
    const newLib = uniq('new-lib');

    // Create app with existing managed block pointing to oldLib
    updateFile(
      `apps/${app}/project.json`,
      JSON.stringify({
        name: app,
        root: `apps/${app}`,
        sourceRoot: `apps/${app}/src`,
        implicitDependencies: [newLib], // Now depends on newLib
      })
    );
    updateFile(
      `apps/${app}/src/styles.css`,
      `@import 'tailwindcss';

/* nx-tailwind-sources:start */
@source "../../libs/${oldLib}";
/* nx-tailwind-sources:end */
`
    );
    updateFile(`apps/${app}/src/main.ts`, `console.log('app');`);

    // Create newLib
    updateFile(
      `libs/${newLib}/project.json`,
      JSON.stringify({
        name: newLib,
        root: `libs/${newLib}`,
        sourceRoot: `libs/${newLib}/src`,
      })
    );
    updateFile(`libs/${newLib}/src/index.ts`, `export const x = 1;`);

    runNxCommand(`g @juristr/nx-tailwind-sync:update-tailwind-globs`, {
      silenceError: true,
    });

    const css = readFile(`apps/${app}/src/styles.css`);
    // Should have newLib, not oldLib
    expect(css).toContain(newLib);
    expect(css).not.toContain(oldLib);
    // Should only have one start marker
    const startCount = (css.match(/nx-tailwind-sources:start/g) || []).length;
    expect(startCount).toBe(1);
  });

  it('should detect vite plugin projects', () => {
    const app = uniq('app');
    const lib = uniq('lib');

    // Create app with vite config using @tailwindcss/vite
    updateFile(
      `apps/${app}/project.json`,
      JSON.stringify({
        name: app,
        root: `apps/${app}`,
        sourceRoot: `apps/${app}/src`,
        implicitDependencies: [lib],
      })
    );
    updateFile(
      `apps/${app}/vite.config.ts`,
      `import tailwindcss from '@tailwindcss/vite';
export default { plugins: [tailwindcss()] };`
    );
    updateFile(`apps/${app}/src/styles.css`, ``); // Empty CSS, no @import
    updateFile(`apps/${app}/src/main.ts`, `console.log('app');`);

    // Create lib
    updateFile(
      `libs/${lib}/project.json`,
      JSON.stringify({
        name: lib,
        root: `libs/${lib}`,
        sourceRoot: `libs/${lib}/src`,
      })
    );
    updateFile(`libs/${lib}/src/index.ts`, `export const x = 1;`);

    runNxCommand(`g @juristr/nx-tailwind-sync:update-tailwind-globs`, {
      silenceError: true,
    });

    const css = readFile(`apps/${app}/src/styles.css`);
    expect(css).toContain('nx-tailwind-sources:start');
    expect(css).toContain(lib);
  });
});
