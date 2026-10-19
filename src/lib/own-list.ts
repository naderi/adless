/**
 * The AdLess filter list: AdLess's own fixes for sites in Germany, Austria and Switzerland,
 * hosted in the repository and updated without a new extension version (filter lists are data,
 * not code). AdLess compiles it itself instead of handing it to uBO Lite, so its element hiding
 * works without the browser's user scripts permission.
 *
 * Supported syntax, a subset of uBlock Origin's:
 *   ||ads.example.com^                     block (any address pattern with |, ||, *, ^)
 *   ||example.com/ad/$script,third-party   with options: resource types (also ~type), third-party,
 *                                          first-party, domain=a.com|~b.com, important, match-case
 *   @@||example.com/ok.js^                 allow
 *   example.com,example.org##.ad-banner    hide elements on these sites (plain CSS selectors)
 *   ##.ad-banner                           hide elements on all sites
 *   example.com#@#.ad-banner               don't hide them there
 * Other lines (procedural filters, scriptlets, regular expressions) are skipped and counted.
 */

export const OWN_LIST_URL = 'https://raw.githubusercontent.com/naderi/adless/main/public/filters/adless.txt';
export const OWN_LIST_BUNDLED = '/filters/adless.txt';
export const OWN_LIST_KEY = 'adlessOwnList';

type Rule = chrome.declarativeNetRequest.Rule;
type ResourceType = chrome.declarativeNetRequest.ResourceType;

export type CompiledList = {
    /** Network rules without ids, which are given when they are applied. */
    rules: Omit<Rule, 'id'>[];
    /** Selectors hidden everywhere, and per hostname. */
    generic: string[];
    specific: Record<string, string[]>;
    /** Selectors not hidden per hostname; the hostname "*" stands for generic exceptions. */
    exceptions: Record<string, string[]>;
    accepted: number;
    rejected: number;
};

export type StoredList = {
    compiled: CompiledList;
    /** When the list was last downloaded (or taken from the extension package). */
    updated: number;
    source: 'remote' | 'bundled';
};

// Above the priorities of filter list rules, below uBO Lite's user rules (1,000,000+) and its
// rules for sites with filtering switched off (2,000,000+).
const BLOCK_PRIORITY = 1;
const IMPORTANT_PRIORITY = 100;
const ALLOW_PRIORITY = 900_000;

const TYPES: Record<string, ResourceType> = {
    script: 'script' as ResourceType,
    image: 'image' as ResourceType,
    stylesheet: 'stylesheet' as ResourceType,
    css: 'stylesheet' as ResourceType,
    xmlhttprequest: 'xmlhttprequest' as ResourceType,
    xhr: 'xmlhttprequest' as ResourceType,
    subdocument: 'sub_frame' as ResourceType,
    frame: 'sub_frame' as ResourceType,
    document: 'main_frame' as ResourceType,
    doc: 'main_frame' as ResourceType,
    media: 'media' as ResourceType,
    font: 'font' as ResourceType,
    ping: 'ping' as ResourceType,
    beacon: 'ping' as ResourceType,
    websocket: 'websocket' as ResourceType,
    object: 'object' as ResourceType,
    other: 'other' as ResourceType,
};

/** Pseudo-classes only uBlock Origin's own engine understands; browsers would drop such rules. */
const PROCEDURAL = /:(has-text|upward|remove|remove-attr|remove-class|style|matches-attr|matches-css|matches-css-before|matches-css-after|matches-media|matches-path|matches-prop|min-text-length|others|shadow|spath|watch-attr|xpath|-abp-[a-z-]+)\(/;

const HOSTNAME = /^[a-z0-9.-]+$/;

const parseDomains = (value: string, separator: string) => {
    const included: string[] = [];
    const excluded: string[] = [];
    for (const raw of value.split(separator)) {
        const domain = raw.trim().toLowerCase();
        const negated = domain.startsWith('~');
        const name = negated ? domain.slice(1) : domain;
        if (!HOSTNAME.test(name)) {
            return null;
        }
        (negated ? excluded : included).push(name);
    }
    return { included, excluded };
};

const compileNetwork = (line: string): Omit<Rule, 'id'> | null => {
    const allow = line.startsWith('@@');
    const body = allow ? line.slice(2) : line;
    const optionsAt = body.lastIndexOf('$');
    const pattern = optionsAt === -1 ? body : body.slice(0, optionsAt);
    const options = optionsAt === -1 ? [] : body.slice(optionsAt + 1).split(',');
    // Regular expressions and empty or non-ASCII patterns are left out.
    if (pattern.length < 3 || (pattern.startsWith('/') && pattern.endsWith('/')) || /[^\x20-\x7e]/.test(pattern)) {
        return null;
    }
    const condition: chrome.declarativeNetRequest.RuleCondition = { urlFilter: pattern };
    const types: ResourceType[] = [];
    const excludedTypes: ResourceType[] = [];
    let important = false;
    for (const option of options.map((o) => o.trim().toLowerCase())) {
        const negated = option.startsWith('~');
        const name = negated ? option.slice(1) : option;
        if (TYPES[name]) {
            (negated ? excludedTypes : types).push(TYPES[name]);
        } else if (name === 'third-party' || name === '3p') {
            condition.domainType = (negated ? 'firstParty' : 'thirdParty') as chrome.declarativeNetRequest.DomainType;
        } else if (name === 'first-party' || name === '1p') {
            condition.domainType = (negated ? 'thirdParty' : 'firstParty') as chrome.declarativeNetRequest.DomainType;
        } else if (!negated && (name.startsWith('domain=') || name.startsWith('from='))) {
            const domains = parseDomains(name.slice(name.indexOf('=') + 1), '|');
            if (!domains) {
                return null;
            }
            if (domains.included.length > 0) {
                condition.initiatorDomains = domains.included;
            }
            if (domains.excluded.length > 0) {
                condition.excludedInitiatorDomains = domains.excluded;
            }
        } else if (name === 'important' && !negated) {
            important = true;
        } else if (name === 'match-case' && !negated) {
            condition.isUrlFilterCaseSensitive = true;
        } else {
            return null;
        }
    }
    if (types.length > 0) {
        condition.resourceTypes = types;
    }
    if (excludedTypes.length > 0) {
        condition.excludedResourceTypes = excludedTypes;
    }
    return {
        priority: allow ? ALLOW_PRIORITY : important ? IMPORTANT_PRIORITY : BLOCK_PRIORITY,
        action: { type: (allow ? 'allow' : 'block') as chrome.declarativeNetRequest.RuleActionType },
        condition,
    };
};

const push = (map: Record<string, string[]>, key: string, value: string) => {
    (map[key] ??= []).push(value);
};

export const compileList = (text: string): CompiledList => {
    const list: CompiledList = { rules: [], generic: [], specific: {}, exceptions: {}, accepted: 0, rejected: 0 };
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (line === '' || line.startsWith('!') || line.startsWith('[')) {
            continue;
        }
        const cosmetic = /^([^#]*)(##|#@#)(.+)$/.exec(line);
        if (cosmetic) {
            const [, domainPart = '', separator, selector = ''] = cosmetic;
            const domains = domainPart === '' ? { included: [], excluded: [] } : parseDomains(domainPart, ',');
            // Scriptlets (+js), HTML filters (^) and procedural selectors need uBO's engine.
            if (!domains || domains.excluded.length > 0 || /^[+^]/.test(selector) || PROCEDURAL.test(selector)) {
                list.rejected++;
                continue;
            }
            if (separator === '#@#') {
                for (const domain of domains.included.length > 0 ? domains.included : ['*']) {
                    push(list.exceptions, domain, selector);
                }
            } else if (domains.included.length === 0) {
                list.generic.push(selector);
            } else {
                for (const domain of domains.included) {
                    push(list.specific, domain, selector);
                }
            }
            list.accepted++;
            continue;
        }
        // Other cosmetic syntaxes (#?#, #$#, #%#, ...).
        if (/#[?$%@]+#/.test(line)) {
            list.rejected++;
            continue;
        }
        const rule = compileNetwork(line);
        if (rule) {
            list.rules.push(rule);
            list.accepted++;
        } else {
            list.rejected++;
        }
    }
    return list;
};

/** The hostname and the domains above it: a.b.example.com, b.example.com, example.com, com. */
const hostnamesOf = (hostname: string) => hostname.split('.').map((_, i, parts) => parts.slice(i).join('.'));

/**
 * CSS hiding the list's elements on a page of the hostname. Every selector is its own rule, so an
 * invalid one only drops itself.
 */
export const cssFor = (list: CompiledList, hostname: string) => {
    const hostnames = hostnamesOf(hostname);
    const excluded = new Set([
        ...(list.exceptions['*'] ?? []),
        ...hostnames.flatMap((h) => list.exceptions[h] ?? []),
    ]);
    const selectors = new Set([...list.generic, ...hostnames.flatMap((h) => list.specific[h] ?? [])]);
    return [...selectors].filter((s) => !excluded.has(s)).map((s) => `${s}{display:none!important}`).join('\n');
};
