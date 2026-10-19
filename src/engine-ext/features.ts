/**
 * AdLess additions to uBO Lite's service worker (loaded by sw.js after uBO Lite's background):
 *  - counts blocked requests per tab and content type for the popup, with their addresses,
 *  - turns the content types switched off per site into allow rules,
 *  - applies the AdLess filter list (src/lib/own-list.ts),
 *  - answers cookie banners (./consent.ts),
 *  - shows the toolbar icon that fits the browser's light or dark theme.
 */
import {
    compileList,
    cssFor,
    OWN_LIST_BUNDLED,
    OWN_LIST_KEY,
    OWN_LIST_URL,
    type StoredList,
} from '../lib/own-list';
import {
    type AdLessState,
    BLOCK_TYPES,
    type BlockType,
    blockTypeOf,
    COUNTS_KEY,
    MAX_URLS_PER_TYPE,
    onStateChanged,
    readState,
    type TabCounts,
    type TabUrls,
    URLS_KEY,
} from '../lib/store';
import { Level } from '../lib/ubol';
import { CONSENT_MESSAGE, forgetConsent, onConsentMessage } from './consent';
import { getFilteringMode } from './engine';

// Dynamic rule ids uBO Lite leaves alone: its own use 5,000,000+ (special), 8,000,000+ (trusted
// sites) and 9,000,000+ (user rules). The first half is for the per-site content types, the
// second for the AdLess filter list.
const FIRST_RULE_ID = 7_000_000;
const LAST_RULE_ID = 7_499_999;
const FIRST_LIST_RULE_ID = 7_500_000;
const LAST_LIST_RULE_ID = 7_999_999;
// Above uBO Lite's filter and user rules, so an allowed content type always loads.
const ALLOW_PRIORITY = 4_000_000;

const ICON_SIZES = [16, 32, 64, 128];

const syncSiteTypeRules = async ({ siteTypes }: AdLessState) => {
    const current = await chrome.declarativeNetRequest.getDynamicRules();
    let id = FIRST_RULE_ID;
    const addRules: chrome.declarativeNetRequest.Rule[] = Object.entries(siteTypes).flatMap(([site, types]) =>
        types.filter((type) => type !== 'cosmetic').map((type) => ({
            id: id++,
            priority: ALLOW_PRIORITY,
            action: { type: 'allow' as chrome.declarativeNetRequest.RuleActionType },
            condition: {
                initiatorDomains: [site],
                resourceTypes: [...BLOCK_TYPES[type]] as chrome.declarativeNetRequest.ResourceType[],
            },
        })));
    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: current.filter((r) => r.id >= FIRST_RULE_ID && r.id <= LAST_RULE_ID).map((r) => r.id),
        addRules,
    });
};

const applyIcon = ({ colorScheme }: AdLessState) => chrome.action.setIcon({
    path: Object.fromEntries(ICON_SIZES.map((size) =>
        [size, `/img/${colorScheme === 'dark' ? 'dark/' : ''}icon_${size}.png`])),
});

/* ---------------------------------------------------------------- AdLess filter list */

const OWN_LIST_ALARM = 'adless-own-list';
const OWN_LIST_MAX_AGE = 12 * 60 * 60 * 1000;

const readOwnList = async () => (await chrome.storage.local.get(OWN_LIST_KEY))[OWN_LIST_KEY] as StoredList | undefined;

const isListRule = (id: number) => id >= FIRST_LIST_RULE_ID && id <= LAST_LIST_RULE_ID;

const syncOwnListRules = async ({ ownList }: AdLessState) => {
    const stored = await readOwnList();
    const current = (await chrome.declarativeNetRequest.getDynamicRules()).filter((r) => isListRule(r.id));
    const addRules = ownList === false || !stored
        ? []
        : stored.compiled.rules.map((rule, i) => ({ ...rule, id: FIRST_LIST_RULE_ID + i }) as chrome.declarativeNetRequest.Rule);
    if (current.length === 0 && addRules.length === 0) {
        return;
    }
    const removeRuleIds = current.map((r) => r.id);
    try {
        await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
    } catch {
        // One rule the browser rejects fails the whole update; then the others are added one by one.
        await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
        for (const rule of addRules) {
            await chrome.declarativeNetRequest.updateDynamicRules({ addRules: [rule] })
                .catch(() => console.warn('AdLess: rule rejected', JSON.stringify(rule.condition)));
        }
    }
};

/**
 * Downloads the AdLess filter list; the copy in the extension package is used until the first
 * download works. Returns whether a list is in place.
 */
const updateOwnList = async (force = false) => {
    const stored = await readOwnList();
    if (!force && stored?.source === 'remote' && Date.now() - stored.updated < OWN_LIST_MAX_AGE) {
        return true;
    }
    let next: StoredList | undefined;
    try {
        const response = await fetch(OWN_LIST_URL, { cache: 'no-cache' });
        const text = await response.text();
        // A page that is not the list (error pages, captive portals) leaves the current one in place.
        if (response.ok && text.includes('! Title: AdLess')) {
            next = { compiled: compileList(text), updated: Date.now(), source: 'remote' };
        }
    } catch {
        // Offline: the current list stays.
    }
    if (!next && !stored) {
        const text = await (await fetch(chrome.runtime.getURL(OWN_LIST_BUNDLED))).text();
        next = { compiled: compileList(text), updated: Date.now(), source: 'bundled' };
    }
    if (next) {
        await chrome.storage.local.set({ [OWN_LIST_KEY]: next });
        await syncOwnListRules(await readState());
    }
    return Boolean(next ?? stored);
};

void chrome.alarms.get(OWN_LIST_ALARM).then((alarm) => {
    if (!alarm) {
        void chrome.alarms.create(OWN_LIST_ALARM, { periodInMinutes: OWN_LIST_MAX_AGE / 60_000, delayInMinutes: 1 });
    }
});
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === OWN_LIST_ALARM) {
        void updateOwnList().catch((e) => console.error('AdLess:', e));
    }
});
void updateOwnList().catch((e) => console.error('AdLess:', e));

/** Hides the list's elements in a frame that starts loading, where element hiding is on. */
const hideElements = async (tabId: number, frameId: number, url: string) => {
    const [state, stored] = await Promise.all([readState(), readOwnList()]);
    if (state.ownList === false || !stored) {
        return;
    }
    const hostname = new URL(url).hostname;
    // Like uBO Lite: the level of the tab's site decides, also for the frames in it.
    const site = frameId === 0 ? hostname : new URL((await chrome.tabs.get(tabId)).url ?? url).hostname;
    if (!hostname || (await getFilteringMode(site)) < Level.Optimal) {
        return;
    }
    const css = cssFor(stored.compiled, hostname);
    if (css) {
        await chrome.scripting.insertCSS({ target: { tabId, frameIds: [frameId] }, css, origin: 'USER' });
    }
};

chrome.webNavigation.onCommitted.addListener(({ tabId, frameId, url }) => {
    if (url.startsWith('http')) {
        void hideElements(tabId, frameId, url).catch(() => undefined);
    }
});

/* ---------------------------------------------------------------- messages */

// The pages and the content script use `what: 'adless:...'`; uBO Lite's own messages are left to it.
chrome.runtime.onMessage.addListener((request, sender, respond) => {
    if (request?.what === CONSENT_MESSAGE) {
        void onConsentMessage(request.msg, sender).catch((e) => console.error('AdLess:', e));
        return undefined;
    }
    if (request?.what === 'adless:updateOwnList') {
        void updateOwnList(true).then(respond, () => respond(false));
        return true;
    }
    return undefined;
});

const apply = (state: AdLessState) => Promise.all([syncSiteTypeRules(state), syncOwnListRules(state), applyIcon(state)])
    .catch((e) => console.error('AdLess:', e));

void readState().then(apply);
onStateChanged(apply);

/* ---------------------------------------------------------------- blocked counts */

// Serialized, so concurrent events do not overwrite each other's counts.
let counting = Promise.resolve();
const changeCounts = (change: (counts: Record<number, TabCounts>, urls: Record<number, TabUrls>) => void) => {
    counting = counting.then(async () => {
        const stored = await chrome.storage.session.get([COUNTS_KEY, URLS_KEY]);
        const counts = (stored[COUNTS_KEY] ?? {}) as Record<number, TabCounts>;
        const urls = (stored[URLS_KEY] ?? {}) as Record<number, TabUrls>;
        change(counts, urls);
        await chrome.storage.session.set({ [COUNTS_KEY]: counts, [URLS_KEY]: urls });
    }).catch((e) => console.error('AdLess:', e));
};

const count = (tabId: number, resourceType: string, url: string) => {
    const type: BlockType | undefined = blockTypeOf(resourceType);
    if (tabId < 0 || !type) {
        return;
    }
    changeCounts((counts, urls) => {
        const tab = counts[tabId] ??= {};
        tab[type] = (tab[type] ?? 0) + 1;
        // Newest first, each address once.
        const tabUrls = urls[tabId] ??= {};
        tabUrls[type] = [url, ...(tabUrls[type] ?? []).filter((u) => u !== url)].slice(0, MAX_URLS_PER_TYPE);
    });
};

const forgetTab = (tabId: number) => {
    changeCounts((counts, urls) => {
        delete counts[tabId];
        delete urls[tabId];
    });
    forgetConsent(tabId);
};

chrome.webRequest.onErrorOccurred.addListener((details) => {
    if (details.error === 'net::ERR_BLOCKED_BY_CLIENT') {
        count(details.tabId, details.type, details.url);
    }
}, { urls: ['<all_urls>'] });

// Ad and tracker scripts that pages depend on are replaced by harmless stand-ins instead of being
// blocked (redirect rules); for the user they count as blocked too. The stand-ins are served with
// dynamic extension URLs, so only the scheme identifies them.
chrome.webRequest.onBeforeRedirect.addListener((details) => {
    if (details.redirectUrl.startsWith('chrome-extension://')) {
        count(details.tabId, details.type, details.url);
    }
}, { urls: ['<all_urls>'] });

// A new page starts from zero.
chrome.webNavigation.onCommitted.addListener(({ tabId, frameId }) => {
    if (frameId === 0) {
        forgetTab(tabId);
    }
});

chrome.tabs.onRemoved.addListener(forgetTab);
