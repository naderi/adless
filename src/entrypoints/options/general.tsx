import { useEffect, useState } from 'preact/hooks';

import { type AdLessState, readState, updateState } from '@/lib/store';
import { type FilteringModes, Level, ubol } from '@/lib/ubol';
import { Button, Row, t, Toggle } from '@/ui/components';

const BACKUP_FORMAT = 'adless-settings';
const BACKUP_VERSION = 2;

type Backup = {
    format: typeof BACKUP_FORMAT;
    version: number;
    enabledRulesets: string[];
    importedLists: string[];
    sandboxFilters: string;
    customFilters: [string, string[]][];
    filteringModes: FilteringModes;
    adless: Pick<AdLessState, 'siteTypes' | 'hiddenRulesets' | 'cookieBanners' | 'ownList'>;
};

const collectBackup = async (): Promise<Backup> => {
    const [page, imported, sandbox, custom, modes, state] = await Promise.all([
        ubol.getOptionsPageData(),
        ubol.getImportedLists(),
        ubol.getSandboxFilters(),
        ubol.getAllCustomFilters(),
        ubol.getFilteringModeDetails(),
        readState(),
    ]);
    return {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        enabledRulesets: page.enabledRulesets,
        importedLists: imported.map((list) => list.id),
        sandboxFilters: sandbox ?? '',
        customFilters: custom.filter(([, selectors]) => selectors.length > 0),
        filteringModes: modes,
        adless: {
            siteTypes: state.siteTypes,
            hiddenRulesets: state.hiddenRulesets,
            cookieBanners: state.cookieBanners,
            ownList: state.ownList,
        },
    };
};

const restoreBackup = async (backup: Backup) => {
    const known = new Set((await ubol.getImportedLists()).map((list) => list.id));
    for (const url of backup.importedLists.filter((u) => !known.has(u))) {
        await ubol.importFilterList(url);
    }
    await ubol.applyRulesets(backup.enabledRulesets);
    await ubol.setSandboxFilters(backup.sandboxFilters);
    await ubol.addManyCustomFilters(backup.customFilters);
    await ubol.setFilteringModeDetails(backup.filteringModes);
    await updateState((s) => Object.assign(s, backup.adless));
};

const parseBackup = (text: string): Backup | null => {
    try {
        const backup = JSON.parse(text);
        const valid = backup?.format === BACKUP_FORMAT && backup.version === BACKUP_VERSION
            && Array.isArray(backup.enabledRulesets) && Array.isArray(backup.importedLists)
            && Array.isArray(backup.customFilters) && typeof backup.filteringModes === 'object';
        return valid ? backup as Backup : null;
    } catch {
        return null;
    }
};

const download = (backup: Backup) => {
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `adless-settings-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
};

export const General = () => {
    const [level, setLevel] = useState<number>();
    const [cookieBanners, setCookieBanners] = useState(true);
    const [message, setMessage] = useState<{ text: string; error: boolean }>();

    useEffect(() => {
        void ubol.getDefaultFilteringMode().then(setLevel);
        void readState().then((s) => setCookieBanners(s.cookieBanners !== false));
    }, []);

    if (level === undefined) {
        return null;
    }

    const changeCookieBanners = async (on: boolean) => {
        setCookieBanners(on);
        await updateState((s) => { s.cookieBanners = on; });
    };

    const setEnabled = async (on: boolean) => {
        if (on) {
            const { levelBeforeOff } = await readState();
            setLevel(await ubol.setDefaultFilteringMode(levelBeforeOff ?? Level.Optimal));
        } else {
            await updateState((s) => { s.levelBeforeOff = level; });
            setLevel(await ubol.setDefaultFilteringMode(Level.None));
        }
    };

    const importSettings = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) {
                return;
            }
            const backup = parseBackup(await file.text());
            if (!backup) {
                setMessage({ text: t('importFailed'), error: true });
                return;
            }
            await restoreBackup(backup);
            setMessage({ text: t('imported'), error: false });
        };
        input.click();
    };

    return (
        <>
            <div class="card">
                <Row title={t('enableAdLess')} description={t('enableAdLessHint')}>
                    <Toggle checked={level !== Level.None} label={t('enableAdLess')} onChange={(on) => void setEnabled(on)} />
                </Row>
                <Row title={t('cookieBanners')} description={t('cookieBannersHint')}>
                    <Toggle checked={cookieBanners} label={t('cookieBanners')} onChange={(on) => void changeCookieBanners(on)} />
                </Row>
            </div>

            <h3 class="section-title">{t('backup')}</h3>
            <div class="card">
                <Row title={t('exportSettings')} description={t('exportHint')}>
                    <Button icon="download" onClick={() => void collectBackup().then(download)}>{t('exportButton')}</Button>
                </Row>
                <Row title={t('importSettings')} description={t('importHint')}>
                    <Button icon="upload" onClick={importSettings}>{t('importButton')}</Button>
                </Row>
            </div>
            {message && <p class={message.error ? 'hint error' : 'hint'} style={{ marginTop: 12 }}>{message.text}</p>}
        </>
    );
};
