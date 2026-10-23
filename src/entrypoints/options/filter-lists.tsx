import { useEffect, useState } from 'preact/hooks';

import { OWN_LIST_KEY, type StoredList } from '@/lib/own-list';
import { readState, updateState } from '@/lib/store';
import { type RulesetDetails, ubol } from '@/lib/ubol';
import { Button, Icon, Row, t, Toggle } from '@/ui/components';

type Data = {
    rulesets: RulesetDetails[];
    enabled: string[];
    defaults: string[];
    hidden: string[];
    max: number;
    ownList: { enabled: boolean; stored?: StoredList };
};

const GROUPS: [group: string, label: string][] = [
    ['default', 'groupDefault'],
    ['ads', 'groupAds'],
    ['privacy', 'groupPrivacy'],
    ['malware', 'groupMalware'],
    ['annoyances', 'groupAnnoyances'],
    ['misc', 'groupMisc'],
    ['regions', 'groupRegions'],
];

const groupOf = (r: RulesetDetails) => r.group ?? 'misc';

/** uBO Lite's own test list, not meant for users. */
const INTERNAL_RULESETS = ['ubol-tests'];

const uiLanguage = chrome.i18n.getUILanguage();
const countryNames = new Intl.DisplayNames([uiLanguage], { type: 'region' });
const languageNames = new Intl.DisplayNames([uiLanguage], { type: 'language' });

/** Name of a country or language code, or the code itself if the browser does not know it. */
const nameOf = (names: Intl.DisplayNames, code: string) => {
    try {
        return names.of(code) ?? code;
    } catch {
        return code;
    }
};

// uBO Lite prefixes regional list names with flags and country codes ("🇩🇪de 🇨🇭ch 🇦🇹at: EasyList Germany").
const countriesOf = (r: RulesetDetails) => /^([^:]*):/.exec(r.name)?.[1]?.match(/[a-z]{2}/g) ?? [];
const listNameOf = (r: RulesetDetails) => r.name.replace(/^[^:]*:\s*/, '');

/** Regional lists are shown by country ("Germany, Switzerland, Austria"), with the list's own name below. */
const titleOf = (r: RulesetDetails) => {
    const countries = r.lang ? countriesOf(r) : [];
    return countries.length > 0 ? countries.map((c) => nameOf(countryNames, c.toUpperCase())).join(', ') : r.name;
};

/** Text the language search matches: countries, languages and the list name. */
const searchTextOf = (r: RulesetDetails) => [
    titleOf(r),
    ...(r.lang ?? '').split(' ').filter(Boolean).map((code) => nameOf(languageNames, code)),
    r.name,
].join(' ').toLowerCase();

const byTitle = (a: RulesetDetails, b: RulesetDetails) => titleOf(a).localeCompare(titleOf(b));

const load = async (): Promise<Data> => {
    const [page, defaults, state, own] = await Promise.all([
        ubol.getOptionsPageData(),
        ubol.getDefaultConfig(),
        readState(),
        chrome.storage.local.get(OWN_LIST_KEY),
    ]);
    return {
        rulesets: page.rulesetDetails.filter((r) => !INTERNAL_RULESETS.includes(r.id)),
        enabled: page.enabledRulesets,
        defaults: defaults.rulesets,
        hidden: state.hiddenRulesets,
        max: page.maxNumberOfEnabledRulesets,
        ownList: { enabled: state.ownList !== false, stored: own[OWN_LIST_KEY] as StoredList | undefined },
    };
};

/** Downloads the AdLess filter list now (src/engine-ext/features.ts). */
const updateOwnList = () => chrome.runtime.sendMessage({ what: 'adless:updateOwnList' }) as Promise<boolean>;

export const FilterLists = () => {
    const [data, setData] = useState<Data>();
    const [error, setError] = useState('');
    const [addingLanguages, setAddingLanguages] = useState(false);
    const [search, setSearch] = useState('');
    const [filtersBuilt, setFiltersBuilt] = useState<Date>();
    const [updating, setUpdating] = useState(false);
    const [updateMessage, setUpdateMessage] = useState('');

    useEffect(() => {
        void load().then(setData);
        void fetch('/filters-info.json').then((r) => r.json()).then((info) => setFiltersBuilt(new Date(info.built)));
    }, []);

    if (!data) {
        return null;
    }

    const stockIds = new Set(data.rulesets.map((r) => r.id));
    const isEnabled = (id: string) => data.enabled.includes(id);

    /** Applies enabled and hidden lists; imported lists keep their state. */
    const save = async (enabled: string[], hidden: string[]) => {
        const stockEnabled = enabled.filter((id) => stockIds.has(id) && !hidden.includes(id));
        if (stockEnabled.length > data.max) {
            setError(t('tooManyLists', data.max));
            return;
        }
        setError('');
        setData({ ...data, enabled: stockEnabled, hidden });
        await updateState((s) => { s.hiddenRulesets = hidden; });
        await ubol.applyRulesets([...stockEnabled, ...data.enabled.filter((id) => !stockIds.has(id))]);
        setData(await load());
    };

    const toggle = (id: string, on: boolean) => {
        const others = data.enabled.filter((e) => e !== id);
        void save(on ? [...others, id] : others, data.hidden);
    };

    const remove = (id: string) => void save(data.enabled.filter((e) => e !== id), [...data.hidden, id]);

    /** Restores the given lists: shown again and enabled exactly when they are enabled by default. */
    const reset = (ids: string[]) => void save(
        [...data.enabled.filter((e) => !ids.includes(e)), ...data.defaults.filter((d) => ids.includes(d))],
        data.hidden.filter((h) => !ids.includes(h)),
    );

    const isDefault = (ids: string[]) => ids.every((id) =>
        isEnabled(id) === data.defaults.includes(id) && !data.hidden.includes(id));

    /**
     * Reloads the own lists now and asks the store for a newer AdLess version, which brings new
     * bundled filter lists (the browser does not allow replacing them otherwise).
     */
    const update = async () => {
        setUpdating(true);
        setUpdateMessage('');
        await Promise.all([ubol.forceUpdateImportedLists(), updateOwnList()]);
        setData(await load());
        try {
            const { status, version } = await chrome.runtime.requestUpdateCheck();
            if (status === 'update_available') {
                setUpdateMessage(t('updateInstalling', version ?? ''));
                // Restarting the extension installs the downloaded version.
                setTimeout(() => chrome.runtime.reload(), 1500);
                return;
            }
            setUpdateMessage(t(status === 'throttled' ? 'updateThrottled' : 'upToDate'));
        } catch {
            setUpdateMessage(t('updateNotFromStore'));
        }
        setUpdating(false);
    };

    const listRow = (r: RulesetDetails, removable = true) => (
        <Row key={r.id} title={titleOf(r)} description={r.lang ? listNameOf(r) : undefined}>
            {removable && <Button icon="trash" subtle title={t('removeList')} onClick={() => remove(r.id)} />}
            <Toggle checked={isEnabled(r.id)} label={titleOf(r)} onChange={(on) => toggle(r.id, on)} />
        </Row>
    );

    const setOwnListEnabled = async (on: boolean) => {
        setData({ ...data, ownList: { ...data.ownList, enabled: on } });
        await updateState((s) => { s.ownList = on; });
    };

    const own = data.ownList.stored;
    const ownListStatus = !own
        ? t('listPending')
        : own.source === 'bundled'
            ? t('ownListBundled', own.compiled.accepted.toLocaleString())
            : t('ownListInfo', own.compiled.accepted.toLocaleString(), new Date(own.updated).toLocaleString());

    const enabledStock = data.rulesets.filter((r) => isEnabled(r.id));
    const filterCount = enabledStock.reduce((sum, r) => sum + (r.filters?.accepted ?? 0), 0);
    const allIds = data.rulesets.map((r) => r.id);

    // "All lists" leaves out languages and regions: those only help on sites in that language.
    const broadIds = data.rulesets.filter((r) => groupOf(r) !== 'regions').map((r) => r.id);
    const allListsOn = data.ownList.enabled && broadIds.every((id) => isEnabled(id) && !data.hidden.includes(id));

    const setAllLists = async (on: boolean) => {
        if (!on) {
            reset(broadIds);
            return;
        }
        if (!data.ownList.enabled) {
            await setOwnListEnabled(true);
        }
        await save([...new Set([...data.enabled, ...broadIds])], data.hidden.filter((h) => !broadIds.includes(h)));
    };

    return (
        <>
            <div class="toolbar between">
                <div>
                    <p class="status">
                        <Icon name="shield" />
                        {t('filtersActive', enabledStock.length, filterCount.toLocaleString())}
                    </p>
                    {filtersBuilt && <p class="status sub">{t('filtersDate', filtersBuilt.toLocaleDateString())}</p>}
                </div>
                <div class="buttons">
                    <Button icon="refresh" disabled={updating} onClick={() => void update()}>
                        {updating ? t('updating') : t('updateLists')}
                    </Button>
                    <Button icon="reset" disabled={isDefault(allIds)} onClick={() => reset(allIds)}>{t('resetAll')}</Button>
                </div>
            </div>
            {updateMessage && <p class="hint">{updateMessage}</p>}
            {error && <p class="hint error">{error}</p>}

            <div class="card">
                <Row title={t('allLists')} description={t('allListsHint')}>
                    <Toggle checked={allListsOn} label={t('allLists')} onChange={(on) => void setAllLists(on)} />
                </Row>
            </div>

            <h3 class="section-title">{t('ownListGroup')}</h3>
            <div class="card">
                <Row
                    title={t('ownList')}
                    description={<>{t('ownListHint')}<br />{ownListStatus}</>}
                >
                    <Toggle
                        checked={data.ownList.enabled}
                        label={t('ownList')}
                        onChange={(on) => void setOwnListEnabled(on)}
                    />
                </Row>
            </div>

            {GROUPS.map(([group, label]) => {
                const lists = data.rulesets.filter((r) => groupOf(r) === group).sort(byTitle);
                if (lists.length === 0) {
                    return null;
                }
                const ids = lists.map((r) => r.id);
                const available = lists.filter((r) => !data.hidden.includes(r.id));
                const regional = group === 'regions';
                const query = search.trim().toLowerCase();
                const shown = !regional
                    ? available
                    : addingLanguages
                        ? available.filter((r) => searchTextOf(r).includes(query))
                        : available.filter((r) => isEnabled(r.id));
                return (
                    <section key={group}>
                        <div class="group-head">
                            <h3 class="section-title">{t(label)}</h3>
                            <Button icon="reset" subtle title={t('resetGroupHint')} disabled={isDefault(ids)} onClick={() => reset(ids)}>
                                {t('resetGroup')}
                            </Button>
                        </div>
                        {regional && addingLanguages && (
                            <input
                                class="input search"
                                type="search"
                                placeholder={t('searchLanguages')}
                                value={search}
                                onInput={(e) => setSearch(e.currentTarget.value)}
                            />
                        )}
                        <div class="card">
                            {available.length === 0 && <Row title={<span class="sub">{t('groupEmpty')}</span>} />}
                            {regional && available.length > 0 && shown.length === 0 && !addingLanguages && (
                                <Row title={<span class="sub">{t('noLanguages')}</span>} />
                            )}
                            {shown.map((r) => listRow(r, !regional || !addingLanguages))}
                            {regional && available.length > 0 && (
                                <button
                                    type="button"
                                    class="expander"
                                    onClick={() => {
                                        setAddingLanguages(!addingLanguages);
                                        setSearch('');
                                    }}
                                >
                                    {addingLanguages ? t('hideLanguages') : t('addLanguages')}
                                </button>
                            )}
                        </div>
                    </section>
                );
            })}
        </>
    );
};
