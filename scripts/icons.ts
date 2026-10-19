/**
 * Renders assets/logo.svg to the PNG icons of the extension, under the names uBO Lite's engine uses:
 *   public/img/icon_<size>.png       light browser themes (also the manifest icons)
 *   public/img/icon_<size>_off.png   gray, for sites where AdLess is paused (set by the engine)
 *   public/img/dark/icon_<size>.png  lighter blues for dark browser themes
 * Also writes public/logo.svg and public/logo-dark.svg for the extension pages.
 */
import fs from 'node:fs';
import path from 'node:path';

import { Resvg } from '@resvg/resvg-js';

const ROOT = path.resolve(import.meta.dirname, '..');
const SIZES = [16, 32, 64, 128];

/** Replaces the two blues of the shield. */
const recolor = (svg: string, left: string, right: string) => svg.replaceAll('#1d4b78', left).replaceAll('#163a66', right);

const light = fs.readFileSync(path.join(ROOT, 'assets/logo.svg'), 'utf8');
const dark = recolor(light, '#4d8fd6', '#3a78bf');
const variants = [
    { svg: light, dir: 'img', suffix: '' },
    { svg: recolor(light, '#8a8a8a', '#767676'), dir: 'img', suffix: '_off' },
    { svg: dark, dir: 'img/dark', suffix: '' },
];

for (const { svg, dir, suffix } of variants) {
    const outDir = path.join(ROOT, 'public', dir);
    fs.mkdirSync(outDir, { recursive: true });
    for (const size of SIZES) {
        const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
        fs.writeFileSync(path.join(outDir, `icon_${size}${suffix}.png`), png);
    }
}
fs.writeFileSync(path.join(ROOT, 'public/logo.svg'), light);
fs.writeFileSync(path.join(ROOT, 'public/logo-dark.svg'), dark);
console.log('Icons written to public/img');
