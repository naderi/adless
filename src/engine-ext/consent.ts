/**
 * Cookie banners: the content script (src/entrypoints/consent.content.ts) runs DuckDuckGo's
 * autoconsent in every frame, which finds the banner's provider and clicks "reject". This side
 * gives it the rules and the settings, runs its page snippets and notes the result for the popup.
 */
import { evalSnippets, filterCompactRules } from '@duckduckgo/autoconsent';
import type { BackgroundMessage, Config, ContentScriptMessage } from '@duckduckgo/autoconsent';
import compactRules from '@duckduckgo/autoconsent/rules/compact-rules.json';

import { CONSENT_KEY, readState, type TabConsent } from '../lib/store';
import { Level } from '../lib/ubol';
import { getFilteringMode } from './engine';

/** Messages between the two sides; uBO Lite ignores a `what` with a colon. */
export const CONSENT_MESSAGE = 'adless:consent';

const CONFIG: Partial<Config> = {
    autoAction: 'optOut',
    enablePrehide: true,
    enableCosmeticRules: true,
    detectRetries: 20,
    isMainWorld: false,
    prehideTimeout: 2000,
    // Banners of unknown providers: only a button that clearly rejects is clicked.
    enableHeuristicDetection: true,
    heuristicMode: 'reject',
    logs: { lifecycle: false, rulesteps: false, detectionsteps: false, evals: false, errors: false, messages: false, waits: false },
};

const hostnameOf = (url: string | undefined) => {
    try {
        return new URL(url ?? '').hostname;
    } catch {
        return '';
    }
};

/** Off when switched off in the settings, or when AdLess does not filter the tab's site. */
const enabledFor = async (tab: chrome.tabs.Tab | undefined) => {
    const hostname = hostnameOf(tab?.url);
    if (!hostname || (await readState()).cookieBanners === false) {
        return false;
    }
    return (await getFilteringMode(hostname)) !== Level.None;
};

// Serialized like the blocked counts, so frames reporting at once do not overwrite each other.
let saving = Promise.resolve();
const saveConsent = (tabId: number, consent: TabConsent | undefined) => {
    saving = saving.then(async () => {
        const all = ((await chrome.storage.session.get(CONSENT_KEY))[CONSENT_KEY] ?? {}) as Record<number, TabConsent>;
        if (consent) {
            all[tabId] = consent;
        } else {
            delete all[tabId];
        }
        await chrome.storage.session.set({ [CONSENT_KEY]: all });
    }).catch((e) => console.error('AdLess:', e));
};

export const forgetConsent = (tabId: number) => saveConsent(tabId, undefined);

const reply = (tabId: number, frameId: number, msg: BackgroundMessage) =>
    chrome.tabs.sendMessage(tabId, { what: CONSENT_MESSAGE, msg }, { frameId }).catch(() => undefined);

/** Runs one of autoconsent's page snippets in the frame's own JavaScript world. */
const runSnippet = async (tabId: number, frameId: number, snippetId: string | undefined) => {
    const func = snippetId ? evalSnippets[snippetId as keyof typeof evalSnippets] : undefined;
    // Rules without a snippet would need eval() of a string, which extensions must not do.
    if (!func) {
        return false;
    }
    const [result] = await chrome.scripting.executeScript({
        target: { tabId, frameIds: [frameId] },
        world: 'MAIN',
        func: func as () => unknown,
    });
    return result?.result ?? false;
};

export const onConsentMessage = async (msg: ContentScriptMessage, sender: chrome.runtime.MessageSender) => {
    const tabId = sender.tab?.id;
    const frameId = sender.frameId ?? 0;
    if (tabId === undefined) {
        return;
    }
    switch (msg.type) {
        case 'init': {
            const enabled = await enabledFor(sender.tab);
            const url = sender.url ?? sender.tab?.url ?? '';
            await reply(tabId, frameId, {
                type: 'initResp',
                config: { ...CONFIG, enabled } as Config,
                rules: enabled
                    ? { autoconsent: [], compact: filterCompactRules(compactRules as never, { url, mainFrame: frameId === 0 }) }
                    : { autoconsent: [] },
            });
            break;
        }
        case 'eval': {
            const result = await runSnippet(tabId, frameId, msg.snippetId).catch(() => false);
            await reply(tabId, frameId, { type: 'evalResp', id: msg.id, result });
            break;
        }
        case 'popupFound':
            saveConsent(tabId, { cmp: msg.cmp, result: 'found' });
            break;
        case 'optOutResult':
            if (!msg.result) {
                saveConsent(tabId, { cmp: msg.cmp, result: 'found' });
            }
            break;
        case 'autoconsentDone':
            saveConsent(tabId, { cmp: msg.cmp, result: msg.isCosmetic ? 'hidden' : 'rejected' });
            break;
        default:
            break;
    }
};
