import fs from 'node:fs';
import path from 'node:path';

import preact from '@preact/preset-vite';
import { build as esbuild } from 'esbuild';
import { defineConfig } from 'wxt';

/** uBO Lite, built by scripts/build-engine.mjs. */
const ENGINE = path.resolve(import.meta.dirname, 'engine');
const LOCALES = ['en', 'de'];

const engineManifest = () => {
    const file = path.join(ENGINE, 'engine-manifest.json');
    if (!fs.existsSync(file)) {
        throw new Error('engine/ is missing, run "pnpm engine" first');
    }
    return JSON.parse(fs.readFileSync(file, 'utf8'));
};

/**
 * Package paths without the leading slash uBO Lite writes: browsers read both the same way, but
 * the Edge Add-ons validator looks for a file literally named "/rulesets/...".
 */
const relative = (p: string) => p.replace(/^\//, '');

const packagePaths = (engine: ReturnType<typeof engineManifest>) => ({
    declarative_net_request: {
        ...engine.declarative_net_request,
        rule_resources: engine.declarative_net_request.rule_resources.map((r: { path: string }) => ({ ...r, path: relative(r.path) })),
    },
    web_accessible_resources: engine.web_accessible_resources.map((w: { resources: string[] }) => ({
        ...w,
        resources: w.resources.map(relative),
    })),
});

/** Copies the engine into the build without replacing AdLess's own files (pages, icons). */
const copyEngine = (outDir: string) => {
    fs.cpSync(ENGINE, outDir, {
        recursive: true,
        force: false,
        filter: (src) => !['engine-manifest.json', '_locales'].includes(path.relative(ENGINE, src)),
    });
};

/** uBO Lite's texts (picker, blocking page, ...) under the AdLess name, overridden by AdLess's own. */
const mergeLocales = (outDir: string) => {
    for (const locale of LOCALES) {
        const engine = JSON.parse(fs.readFileSync(path.join(ENGINE, '_locales', locale, 'messages.json'), 'utf8'));
        const ownFile = path.join(outDir, '_locales', locale, 'messages.json');
        const own = JSON.parse(fs.readFileSync(ownFile, 'utf8'));
        for (const entry of Object.values(engine) as { message: string }[]) {
            entry.message = entry.message.replace(/uBlock Origin Lite|uBO Lite/g, 'AdLess');
        }
        fs.writeFileSync(ownFile, JSON.stringify({ ...engine, ...own }));
    }
};

/** AdLess additions to the service worker, next to uBO Lite's background script. */
const buildServiceWorker = async (outDir: string) => {
    const dir = path.join(outDir, 'js/adless');
    await esbuild({
        entryPoints: [path.resolve(import.meta.dirname, 'src/engine-ext/features.ts')],
        outfile: path.join(dir, 'features.js'),
        bundle: true,
        format: 'esm',
        target: 'chrome122',
        // uBO Lite's modules, loaded by its background script (see src/engine-ext/engine.ts).
        external: ['../mode-manager.js'],
    });
    fs.copyFileSync(path.resolve(import.meta.dirname, 'src/engine-ext/sw.js'), path.join(dir, 'sw.js'));
};

export default defineConfig({
    srcDir: 'src',
    outDir: 'dist',
    // Named after the manifest version, which releases extend with a build number.
    zip: { artifactTemplate: '{{name}}-{{version}}-{{browser}}.zip' },
    vite: () => ({
        plugins: [preact()],
        // Preload links with crossorigin do not match how extension pages load their modules,
        // so Chrome discards them with a warning; the files are local anyway.
        build: { modulePreload: false },
    }),
    manifest: () => {
        const engine = engineManifest();
        return {
            name: '__MSG_extName__',
            description: '__MSG_extDescription__',
            default_locale: 'en',
            // Releases append a build number to the version in package.json (see .github/workflows/release.yml).
            ...(process.env.ADLESS_VERSION ? { version: process.env.ADLESS_VERSION } : {}),
            author: 'Ali Naderi',
            homepage_url: 'https://digitalent.dev/en/projects/adless/',
            minimum_chrome_version: engine.minimum_chrome_version,
            icons: { 16: 'img/icon_16.png', 32: 'img/icon_32.png', 64: 'img/icon_64.png', 128: 'img/icon_128.png' },
            action: {
                default_title: '__MSG_extName__',
                default_icon: { 16: 'img/icon_16.png', 32: 'img/icon_32.png', 64: 'img/icon_64.png' },
            },
            background: { service_worker: 'js/adless/sw.js', type: 'module' },
            // The engine's permissions, plus what the per-type counts in the popup need. Not
            // userScripts: it would run scripts generated from downloaded filter lists, which the
            // Chrome Web Store counts as remotely hosted code.
            permissions: [...engine.permissions.filter((p: string) => p !== 'userScripts'), 'webRequest', 'webNavigation'],
            host_permissions: engine.host_permissions,
            commands: engine.commands,
            ...packagePaths(engine),
            storage: engine.storage,
            incognito: engine.incognito,
        };
    },
    hooks: {
        'build:done': async (wxt) => {
            const outDir = wxt.config.outDir;
            copyEngine(outDir);
            mergeLocales(outDir);
            await buildServiceWorker(outDir);
        },
    },
});
