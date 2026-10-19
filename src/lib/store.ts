/**
 * AdLess's own state, next to uBO Lite's. The pages write it, the service worker additions
 * (src/engine-ext) react to changes. Blocked counts live in session storage.
 */

/**
 * Kinds of blocked content shown in the popup, with the browser resource types they cover.
 * "cosmetic" is element hiding; it is switched with uBO Lite's filtering mode, not with a rule.
 */
export const BLOCK_TYPES = {
    script: ['script'],
    image: ['image'],
    frame: ['sub_frame'],
    media: ['media'],
    connection: ['xmlhttprequest', 'ping', 'websocket', 'other', 'object'],
    style: ['stylesheet', 'font'],
    cosmetic: [],
} as const satisfies Record<string, readonly string[]>;

export type BlockType = keyof typeof BLOCK_TYPES;

export const blockTypeOf = (resourceType: string): BlockType | undefined =>
    (Object.keys(BLOCK_TYPES) as BlockType[]).find((type) =>
        (BLOCK_TYPES[type] as readonly string[]).includes(resourceType));

export type AdLessState = {
    /** Per hostname: network content types that are not blocked there. */
    siteTypes: Record<string, BlockType[]>;
    /** Bundled filter lists the user removed from the list ("Reset" restores them). */
    hiddenRulesets: string[];
    /** Default filtering level before AdLess was switched off completely. */
    levelBeforeOff?: number;
    /** Cookie banners are answered with "reject"; on unless switched off. */
    cookieBanners?: boolean;
    /** The AdLess filter list is applied; on unless switched off. */
    ownList?: boolean;
    /** Browser theme, reported by the extension pages; picks the toolbar icon. */
    colorScheme?: 'light' | 'dark';
};

const KEY = 'adless';

export const readState = async (): Promise<AdLessState> => ({
    siteTypes: {},
    hiddenRulesets: [],
    ...(await chrome.storage.local.get(KEY))[KEY] as Partial<AdLessState> | undefined,
});

export const updateState = async (change: (state: AdLessState) => void) => {
    const state = await readState();
    change(state);
    await chrome.storage.local.set({ [KEY]: state });
    return state;
};

export const onStateChanged = (listener: (state: AdLessState) => void) => {
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[KEY]) {
            void readState().then(listener);
        }
    });
};

/** Blocked requests per tab and content type. */
export type TabCounts = Partial<Record<BlockType, number>>;
export const COUNTS_KEY = 'adlessBlocked';

export const readCounts = async (tabId: number): Promise<TabCounts> =>
    ((await chrome.storage.session.get(COUNTS_KEY))[COUNTS_KEY] as Record<number, TabCounts> | undefined)?.[tabId] ?? {};

/** Addresses blocked per tab and content type, the most recent ones, for the popup's lists. */
export type TabUrls = Partial<Record<BlockType, string[]>>;
export const URLS_KEY = 'adlessBlockedUrls';
export const MAX_URLS_PER_TYPE = 100;

export const readUrls = async (tabId: number): Promise<TabUrls> =>
    ((await chrome.storage.session.get(URLS_KEY))[URLS_KEY] as Record<number, TabUrls> | undefined)?.[tabId] ?? {};

/**
 * The cookie banner of a tab and its provider: found (not answered, or rejecting failed),
 * rejected, or only hidden (providers without a reject button).
 */
export type TabConsent = { cmp: string; result: 'found' | 'rejected' | 'hidden' };
export const CONSENT_KEY = 'adlessConsent';

export const readConsent = async (tabId: number): Promise<TabConsent | undefined> =>
    ((await chrome.storage.session.get(CONSENT_KEY))[CONSENT_KEY] as Record<number, TabConsent> | undefined)?.[tabId];
