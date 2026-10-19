import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';

import {
    BLOCK_TYPES,
    type BlockType,
    readConsent,
    readCounts,
    readState,
    readUrls,
    type TabConsent,
    updateState,
} from '@/lib/store';
import { Level, startPicker, ubol } from '@/lib/ubol';
import { Button, Icon, Logo, reportColorScheme, t, Toggle } from '@/ui/components';
import '@/ui/theme.css';
import './popup.css';

const TYPE_LABELS: Record<BlockType, string> = {
    script: 'typeScript',
    image: 'typeImage',
    frame: 'typeFrame',
    media: 'typeMedia',
    connection: 'typeConnection',
    style: 'typeStyle',
    cosmetic: 'typeCosmetic',
};

type State = {
    /** Default filtering level; None means AdLess is switched off. */
    defaultLevel: number;
    /** Filtering level of the current site; null on pages AdLess cannot filter. */
    level: number | null;
    hostname: string;
    types: { type: BlockType; blocked: number; enabled: boolean; urls: string[] }[];
    /** The cookie banner AdLess answered, if any and if that is switched on. */
    consent?: TabConsent;
};

const REPOSITORY = 'https://github.com/naderi/adless';

const CONSENT_LABELS: Record<TabConsent['result'], string> = {
    rejected: 'cookieRejected',
    hidden: 'cookieHidden',
    found: 'cookieFound',
};

/** Browser name and major version, e.g. "Microsoft Edge 141". */
const browserName = () => {
    const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string; version: string }[] } })
        .userAgentData?.brands ?? [];
    const brand = brands.find((b) => !/Not.?A.?Brand|Chromium/i.test(b.brand)) ?? brands.find((b) => b.brand === 'Chromium');
    return brand ? `${brand.brand} ${brand.version}` : navigator.userAgent;
};

/**
 * Opens a prefilled issue in the repository (template .github/ISSUE_TEMPLATE/site-problem.yml).
 * Only what the user sees in the form is sent: the page without query and fragment, which may
 * hold personal data, and the settings that matter for the page.
 */
const reportProblem = async (tab: chrome.tabs.Tab, state: State) => {
    const url = new URL(tab.url ?? '');
    const [{ enabledRulesets }, stored] = await Promise.all([ubol.getOptionsPageData(), readState()]);
    const levels = ['none', 'basic', 'optimal', 'complete'];
    const settings = [
        `Filtering on this site: ${levels[state.level ?? 0]} (default: ${levels[state.defaultLevel]})`,
        `Content types allowed on this site: ${(stored.siteTypes[state.hostname] ?? []).join(', ') || '-'}`,
        `Cookie banners: ${stored.cookieBanners === false ? 'off' : 'on'}${state.consent ? ` (${state.consent.cmp}: ${state.consent.result})` : ''}`,
        `AdLess filter list: ${stored.ownList === false ? 'off' : 'on'}`,
        `Filter lists: ${enabledRulesets.join(', ')}`,
    ].join('\n');
    const params = new URLSearchParams({
        template: 'site-problem.yml',
        title: `${state.hostname.replace(/^www\./, '')}: `,
        url: `${url.origin}${url.pathname}`,
        version: chrome.runtime.getManifest().version,
        browser: browserName(),
        settings,
    });
    await chrome.tabs.create({ url: `${REPOSITORY}/issues/new?${params}` });
    window.close();
};

/** An address in the list of blocked requests: the host in front, the rest shortened by the layout. */
const BlockedUrl = ({ url }: { url: string }) => {
    let host = url;
    let rest = '';
    try {
        const parsed = new URL(url);
        host = parsed.host;
        rest = `${parsed.pathname}${parsed.search}`;
    } catch {
        // Shown as it is.
    }
    return (
        <li title={url}>
            <span class="url-host">{host}</span>
            <span class="url-rest">{rest}</span>
        </li>
    );
};

const hostnameOf = (url: string | undefined) => {
    try {
        const { protocol, hostname } = new URL(url ?? '');
        return protocol === 'http:' || protocol === 'https:' ? hostname : '';
    } catch {
        return '';
    }
};

const loadState = async (tab: chrome.tabs.Tab): Promise<State> => {
    const hostname = hostnameOf(tab.url);
    const [defaultLevel, panel, counts, urls, consent, stored] = await Promise.all([
        ubol.getDefaultFilteringMode(),
        hostname ? ubol.popupPanelData(hostname) : undefined,
        readCounts(tab.id!),
        readUrls(tab.id!),
        readConsent(tab.id!),
        readState(),
    ]);
    const level = panel?.level ?? null;
    const off = stored.siteTypes[hostname] ?? [];
    return {
        defaultLevel,
        level,
        hostname,
        types: (Object.keys(BLOCK_TYPES) as BlockType[]).map((type) => ({
            type,
            blocked: counts[type] ?? 0,
            enabled: type === 'cosmetic' ? (level ?? 0) >= Level.Optimal : !off.includes(type),
            urls: urls[type] ?? [],
        })),
        consent: stored.cookieBanners === false ? undefined : consent,
    };
};

const openOptions = (hash = '') => {
    void chrome.tabs.create({ url: chrome.runtime.getURL(`/options.html${hash}`) });
    window.close();
};

const Popup = () => {
    const [tab, setTab] = useState<chrome.tabs.Tab>();
    const [state, setState] = useState<State>();
    const [expanded, setExpanded] = useState<BlockType[]>([]);

    useEffect(() => {
        reportColorScheme();
        void chrome.tabs.query({ active: true, currentWindow: true }).then(([active]) => {
            if (active?.id !== undefined) {
                setTab(active);
            }
        });
    }, []);

    // Requests keep being blocked while the page loads.
    useEffect(() => {
        if (!tab) {
            return undefined;
        }
        const refresh = () => void loadState(tab).then(setState);
        refresh();
        const timer = setInterval(refresh, 1500);
        return () => clearInterval(timer);
    }, [tab]);

    if (!state || !tab?.id) {
        return null;
    }
    const tabId = tab.id;

    const enabled = state.defaultLevel !== Level.None;
    const siteFiltered = state.level !== null && state.level !== Level.None;
    const active = enabled && siteFiltered;
    const blocked = state.types.reduce((sum, type) => sum + type.blocked, 0);
    // Element hiding is not counted, so that row is shown whenever it can be switched.
    const shownTypes = state.types.filter((type) =>
        (type.type === 'cosmetic' ? state.level !== null : type.blocked > 0 || !type.enabled));

    const reload = () => chrome.tabs.reload(tabId);

    const setEnabled = async (on: boolean) => {
        setState({ ...state, defaultLevel: on ? Level.Optimal : Level.None });
        if (on) {
            const { levelBeforeOff } = await readState();
            await ubol.setDefaultFilteringMode(levelBeforeOff ?? Level.Optimal);
        } else {
            await updateState((s) => { s.levelBeforeOff = state.defaultLevel; });
            await ubol.setDefaultFilteringMode(Level.None);
        }
        await reload();
    };

    const setSiteFiltered = async (on: boolean) => {
        setState({ ...state, level: on ? state.defaultLevel : Level.None });
        await ubol.setFilteringMode(state.hostname, on ? state.defaultLevel : Level.None);
        await reload();
    };

    const setTypeBlocked = async (type: BlockType, block: boolean) => {
        setState({ ...state, types: state.types.map((t) => (t.type === type ? { ...t, enabled: block } : t)) });
        if (type === 'cosmetic') {
            // Element hiding and scriptlets need the optimal level; basic filters the network only.
            await ubol.setFilteringMode(state.hostname, block ? Math.max(state.defaultLevel, Level.Optimal) : Level.Basic);
        } else {
            await updateState((s) => {
                const types = (s.siteTypes[state.hostname] ?? []).filter((t) => t !== type);
                if (!block) {
                    types.push(type);
                }
                if (types.length > 0) {
                    s.siteTypes[state.hostname] = types;
                } else {
                    delete s.siteTypes[state.hostname];
                }
            });
        }
        await reload();
    };

    const toggleExpanded = (type: BlockType) =>
        setExpanded(expanded.includes(type) ? expanded.filter((e) => e !== type) : [...expanded, type]);

    const hideElement = async () => {
        await startPicker(tabId);
        window.close();
    };

    return (
        <>
            <header class="header">
                <Logo size={24} />
                <span class="title">AdLess</span>
                <Toggle checked={enabled} label={t('toggleAdLess')} onChange={(on) => void setEnabled(on)} />
            </header>

            <main class="card site">
                {!enabled && <p class="message">{t('protectionPaused')}</p>}
                {enabled && state.level === null && <p class="message">{t('siteUnavailable')}</p>}
                {enabled && state.level !== null && (
                    <>
                        <div class="row">
                            <div class="row-text">
                                <div class="site-name" title={state.hostname}>{state.hostname.replace(/^www\./, '')}</div>
                                <div class="sub">{t('blockOnSite')}</div>
                            </div>
                            <Toggle checked={siteFiltered} label={t('blockOnSite')} onChange={(on) => void setSiteFiltered(on)} />
                        </div>
                        <div class={`row counter${active ? '' : ' inactive'}`}>
                            <Icon name="shield" size={20} />
                            <span class="count">{blocked.toLocaleString()}</span>
                            <span class="sub">{t('blockedOnPage')}</span>
                        </div>
                        {active && state.consent && (
                            <div class="row type-row consent">
                                <Icon name="cookie" />
                                <div class="row-text">
                                    <div>{t(CONSENT_LABELS[state.consent.result])}</div>
                                    <div class="sub">{state.consent.cmp}</div>
                                </div>
                            </div>
                        )}
                        {active && shownTypes.map((type) => {
                            // Element hiding is done by the browser and has no addresses to list.
                            const expandable = type.type !== 'cosmetic' && type.urls.length > 0;
                            const open = expandable && expanded.includes(type.type);
                            const label = t(TYPE_LABELS[type.type]);
                            const text = (
                                <span class="row-text">
                                    <span class="type-label">{label}</span>
                                    {!type.enabled && <span class="sub">{t('typeOff')}</span>}
                                </span>
                            );
                            return (
                                <div key={type.type} class="type-group">
                                    <div class="row type-row">
                                        {expandable ? (
                                            <button
                                                type="button"
                                                class={`expand${open ? ' open' : ''}`}
                                                aria-expanded={open}
                                                title={open ? t('hideBlocked') : t('showBlocked')}
                                                onClick={() => toggleExpanded(type.type)}
                                            >
                                                <Icon name="chevron" size={14} />
                                                {text}
                                            </button>
                                        ) : (
                                            <span class="expand-placeholder">{text}</span>
                                        )}
                                        {type.type !== 'cosmetic' && <span class="type-count">{type.blocked.toLocaleString()}</span>}
                                        <Toggle
                                            checked={type.enabled}
                                            label={label}
                                            onChange={(block) => void setTypeBlocked(type.type, block)}
                                        />
                                    </div>
                                    {open && (
                                        <ul class="url-list">
                                            {type.urls.map((url) => <BlockedUrl key={url} url={url} />)}
                                        </ul>
                                    )}
                                </div>
                            );
                        })}
                    </>
                )}
            </main>

            <div class="actions">
                <Button icon="target" disabled={!active} onClick={() => void hideElement()}>{t('hideElement')}</Button>
                <Button
                    icon="flag"
                    title={t('reportProblemHint')}
                    disabled={state.level === null}
                    onClick={() => void reportProblem(tab, state)}
                >
                    {t('reportProblem')}
                </Button>
            </div>

            <footer class="footer">
                <Button icon="info" subtle title={t('info')} onClick={() => openOptions('#about')} />
                <Button icon="sliders" subtle onClick={() => openOptions()}>{t('settings')}</Button>
            </footer>
        </>
    );
};

render(<Popup />, document.getElementById('app')!);
