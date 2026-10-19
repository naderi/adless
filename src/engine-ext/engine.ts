/**
 * uBO Lite's own modules, which the service worker already loaded. Not bundled (see the external
 * list in wxt.config.ts): the same module instance has to be used, with its caches.
 */
// @ts-expect-error js/mode-manager.js of the engine, next to js/adless/ in the build.
import { getFilteringMode as engineFilteringMode } from '../mode-manager.js';

/** Filtering level of a hostname, as the popup shows it (Level in src/lib/ubol.ts). */
export const getFilteringMode: (hostname: string) => Promise<number> = engineFilteringMode;
