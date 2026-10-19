/**
 * Requests to the uBO Lite engine in the service worker (its messages are routed by `what`).
 * Only the calls AdLess's pages need, with the shapes uBO Lite returns.
 */

/** uBO Lite filtering levels. */
export const Level = { None: 0, Basic: 1, Optimal: 2, Complete: 3 } as const;

export type RulesetDetails = {
    id: string;
    name: string;
    group?: string;
    /** Space-separated language codes of regional lists. */
    lang?: string;
    enabled: boolean;
    homeURL?: string;
    filters?: { total: number; accepted: number };
};

export type ImportedList = {
    id: string;
    name: string;
    enabled: boolean;
    homeURL: string;
    time: { added: number; updated: number };
    filters: { total: number; accepted: number; rejected: number };
};

export type FilteringModes = { none: string[]; basic: string[]; optimal: string[]; complete: string[] };

const ask = <T>(what: string, details: Record<string, unknown> = {}): Promise<T> =>
    chrome.runtime.sendMessage({ ...details, what });

export const ubol = {
    popupPanelData: (hostname: string) =>
        ask<{ level: number; hasOmnipotence: boolean; autoReload: boolean }>('popupPanelData', { hostname }),
    getDefaultFilteringMode: () => ask<number>('getDefaultFilteringMode'),
    setDefaultFilteringMode: (level: number) => ask<number>('setDefaultFilteringMode', { level }),
    setFilteringMode: (hostname: string, level: number) => ask<number>('setFilteringMode', { hostname, level }),
    getFilteringModeDetails: () => ask<FilteringModes>('getFilteringModeDetails'),
    setFilteringModeDetails: (modes: FilteringModes) => ask<FilteringModes>('setFilteringModeDetails', { modes }),

    getOptionsPageData: () => ask<{
        rulesetDetails: RulesetDetails[];
        enabledRulesets: string[];
        maxNumberOfEnabledRulesets: number;
        defaultFilteringMode: number;
        hasOmnipotence: boolean;
    }>('getOptionsPageData'),
    getDefaultConfig: () => ask<{ rulesets: string[] }>('getDefaultConfig'),
    applyRulesets: (enabledRulesets: string[], toRemove?: string[]) =>
        ask<void>('applyRulesets', { enabledRulesets, toRemove }),

    importFilterList: (url: string) => ask<void>('importFilterList', { url }),
    getImportedLists: () => ask<ImportedList[]>('getImportedLists'),
    updateImportedLists: () => ask<void>('updateImportedLists'),
    /**
     * uBO Lite only reloads imported lists whose expiry has passed; marking them as never updated
     * (its storage key "rulesets.imported") makes it reload all of them now.
     */
    forceUpdateImportedLists: async () => {
        const key = 'rulesets.imported';
        const lists = ((await chrome.storage.local.get(key))[key] ?? []) as ImportedList[];
        if (lists.length === 0) {
            return;
        }
        lists.forEach((list) => { list.time.updated = 0; });
        await chrome.storage.local.set({ [key]: lists });
        await ask<void>('updateImportedLists');
    },

    getSandboxFilters: () => ask<string | undefined>('getSandboxFilters'),
    setSandboxFilters: (text: string) => ask<void>('setSandboxFilters', { text }),

    /** Elements hidden with the picker, per hostname. */
    getAllCustomFilters: () => ask<[string, string[]][]>('getAllCustomFilters'),
    removeCustomFilters: (hostname: string, selectors: string[]) =>
        ask<void>('removeCustomFilters', { hostname, selectors }),
    addManyCustomFilters: (entries: [string, string[]][]) => ask<void>('addManyCustomFilters', { entries }),
};

/** Starts uBO Lite's element picker in a tab. */
export const startPicker = (tabId: number) => chrome.scripting.executeScript({
    files: ['/js/scripting/css-procedural-api.js', '/js/scripting/tool-overlay.js', '/js/scripting/picker.js'],
    target: { tabId },
});
