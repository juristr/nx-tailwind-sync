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

  it('should add managed block after @import tailwindcss source(none)', () => {
    const app = uniq('app');
    const lib = uniq('lib');

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
      `apps/${app}/src/styles.css`,
      `@import 'tailwindcss source(none)';

.existing-content { color: red; }`
    );
    updateFile(`apps/${app}/src/main.ts`, `console.log('app');`);

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

    // Verify managed block exists
    expect(css).toContain('nx-tailwind-sources:start');
    expect(css).toContain(lib);

    // Verify order: import should come BEFORE managed block
    const importIndex = css.indexOf("@import 'tailwindcss source(none)'");
    const managedBlockIndex = css.indexOf('nx-tailwind-sources:start');
    expect(importIndex).toBeLessThan(managedBlockIndex);

    // Verify existing content is preserved
    expect(css).toContain('.existing-content { color: red; }');
  });

  it('should update multiple apps with tailwind in monorepo', () => {
    const app1 = uniq('app1');
    const app2 = uniq('app2');
    const app3 = uniq('app3');
    const lib1 = uniq('lib1');
    const lib2 = uniq('lib2');
    const lib3 = uniq('lib3');

    // Create app1 - uses tailwind, depends on lib1
    updateFile(
      `apps/${app1}/project.json`,
      JSON.stringify({
        name: app1,
        root: `apps/${app1}`,
        sourceRoot: `apps/${app1}/src`,
        implicitDependencies: [lib1],
      })
    );
    updateFile(`apps/${app1}/src/styles.css`, `@import 'tailwindcss';`);
    updateFile(`apps/${app1}/src/main.ts`, `console.log('app1');`);

    // Create app2 - uses tailwind, depends on lib2 and lib3
    updateFile(
      `apps/${app2}/project.json`,
      JSON.stringify({
        name: app2,
        root: `apps/${app2}`,
        sourceRoot: `apps/${app2}/src`,
        implicitDependencies: [lib2, lib3],
      })
    );
    updateFile(`apps/${app2}/src/styles.css`, `@import 'tailwindcss';`);
    updateFile(`apps/${app2}/src/main.ts`, `console.log('app2');`);

    // Create app3 - no tailwind, has plain CSS
    updateFile(
      `apps/${app3}/project.json`,
      JSON.stringify({
        name: app3,
        root: `apps/${app3}`,
        sourceRoot: `apps/${app3}/src`,
      })
    );
    const app3OriginalCss = `.app3-styles { color: blue; }`;
    updateFile(`apps/${app3}/src/styles.css`, app3OriginalCss);
    updateFile(`apps/${app3}/src/main.ts`, `console.log('app3');`);

    // Create libs
    updateFile(
      `libs/${lib1}/project.json`,
      JSON.stringify({
        name: lib1,
        root: `libs/${lib1}`,
        sourceRoot: `libs/${lib1}/src`,
      })
    );
    updateFile(`libs/${lib1}/src/index.ts`, `export const lib1 = 1;`);

    updateFile(
      `libs/${lib2}/project.json`,
      JSON.stringify({
        name: lib2,
        root: `libs/${lib2}`,
        sourceRoot: `libs/${lib2}/src`,
      })
    );
    updateFile(`libs/${lib2}/src/index.ts`, `export const lib2 = 2;`);

    updateFile(
      `libs/${lib3}/project.json`,
      JSON.stringify({
        name: lib3,
        root: `libs/${lib3}`,
        sourceRoot: `libs/${lib3}/src`,
      })
    );
    updateFile(`libs/${lib3}/src/index.ts`, `export const lib3 = 3;`);

    // Run generator
    runNxCommand(`g @juristr/nx-tailwind-sync:update-tailwind-globs`, {
      silenceError: true,
    });

    // Verify app1 has managed block with lib1
    const css1 = readFile(`apps/${app1}/src/styles.css`);
    expect(css1).toContain('nx-tailwind-sources:start');
    expect(css1).toContain('nx-tailwind-sources:end');
    expect(css1).toContain(lib1);
    expect(css1).not.toContain(lib2);
    expect(css1).not.toContain(lib3);

    // Verify app2 has managed block with lib2 and lib3
    const css2 = readFile(`apps/${app2}/src/styles.css`);
    expect(css2).toContain('nx-tailwind-sources:start');
    expect(css2).toContain('nx-tailwind-sources:end');
    expect(css2).toContain(lib2);
    expect(css2).toContain(lib3);
    expect(css2).not.toContain(lib1);

    // Verify app3 is untouched (no tailwind)
    const css3 = readFile(`apps/${app3}/src/styles.css`);
    expect(css3).toBe(app3OriginalCss);
    expect(css3).not.toContain('nx-tailwind-sources:start');
  });
});
