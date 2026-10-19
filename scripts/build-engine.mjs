/**
 * Builds the filtering engine of AdLess: uBlock Origin Lite from vendor/uBlock (git submodule,
 * pinned), compiled with uBO's own build script, into engine/. The rulesets are generated from
 * the latest filter lists on every run. uBO Lite's own popup and dashboard are left out; AdLess
 * brings its own pages (see src/entrypoints) and the build:done hook in wxt.config.ts merges both.
 *
 *   node scripts/build-engine.mjs
 *
 * Needs bash (Git Bash on Windows), git and curl.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const UBO = path.join(ROOT, 'vendor/uBlock');
const UBOL_BUILD = path.join(UBO, 'dist/build/uBOLite.chromium');
const ENGINE = path.join(ROOT, 'engine');
const SHIM = path.join(ROOT, 'scripts/build-shim');

/** uBO Lite files AdLess does not ship: its own UI pages, their editor library, debug output. */
const LEFT_OUT = [
    'popup.html',
    'dashboard.html',
    'matched-rules.html',
    'report.html',
    'lib/codemirror',
    'rulesets/debug',
    'log.txt',
    'README.md',
    'img/flags-of-the-world',
];

const run = (cmd, args, options = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...options });

// uBO's build copies files from these nested submodules.
run('git', ['-C', UBO, 'submodule', 'update', '--init', '--depth', '1',
    'platform/mv3/extension/lib/codemirror/codemirror-ubol',
    'platform/mv3/extension/lib/s14e-serializer']);

/** Git Bash on Windows (plain `bash` there may be WSL), found next to git's own files. */
const findBash = () => {
    if (process.platform !== 'win32') {
        return 'bash';
    }
    let dir = execFileSync('git', ['--exec-path']).toString().trim();
    while (path.dirname(dir) !== dir) {
        for (const candidate of ['bin/bash.exe', 'usr/bin/bash.exe']) {
            if (fs.existsSync(path.join(dir, candidate))) {
                return path.join(dir, candidate);
            }
        }
        dir = path.dirname(dir);
    }
    throw new Error('Git Bash not found');
};
const bash = findBash();

// uBO's build caches downloaded filter lists; every engine build should use the current ones.
fs.rmSync(path.join(UBO, 'dist/build/mv3-data'), { recursive: true, force: true });

run(bash, ['--noprofile', '--norc', '-c', 'bash tools/make-mv3.sh chromium'], {
    cwd: UBO,
    env: {
        ...process.env,
        // jq is only used for local manifest tweaks, which AdLess makes itself.
        PATH: `${SHIM}${path.delimiter}${process.env.PATH}`,
        // Node's own fetch aborts on some filter list servers; curl does not.
        NODE_OPTIONS: `--import=${new URL('file:///' + path.join(SHIM, 'curl-fetch.mjs').replaceAll('\\', '/')).href}`,
    },
});

fs.rmSync(ENGINE, { recursive: true, force: true });
fs.cpSync(UBOL_BUILD, ENGINE, {
    recursive: true,
    filter: (src) => !LEFT_OUT.includes(path.relative(UBOL_BUILD, src).replaceAll('\\', '/')),
});
// The manifest is not shipped as is; wxt.config.ts takes permissions and rulesets from it.
fs.renameSync(path.join(ENGINE, 'manifest.json'), path.join(ENGINE, 'engine-manifest.json'));
// When the bundled filter lists were fetched, shown on the filter lists page.
fs.writeFileSync(path.join(ENGINE, 'filters-info.json'), JSON.stringify({ built: new Date().toISOString() }));

const size = (dir) => fs.readdirSync(dir, { withFileTypes: true })
    .reduce((sum, e) => sum + (e.isDirectory() ? size(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0);
console.log(`Engine ready in engine/ (${(size(ENGINE) / 1e6).toFixed(1)} MB)`);
