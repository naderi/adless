import { useEffect, useState } from 'preact/hooks';

import { type ImportedList, ubol } from '@/lib/ubol';
import { Button, Row, t, Toggle } from '@/ui/components';


const isHttpUrl = (value: string) => {
    try {
        return ['http:', 'https:'].includes(new URL(value).protocol);
    } catch {
        return false;
    }
};

export const CustomLists = () => {
    const [lists, setLists] = useState<ImportedList[]>([]);
    const [enabled, setEnabled] = useState<string[]>([]);
    const [url, setUrl] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const load = async () => {
        const [imported, page] = await Promise.all([ubol.getImportedLists(), ubol.getOptionsPageData()]);
        setLists(imported);
        setEnabled(page.enabledRulesets);
    };

    useEffect(() => {
        void load();
        // Lists are downloaded and compiled in the background; show their progress.
        const timer = setInterval(() => void load(), 3000);
        return () => clearInterval(timer);
    }, []);

    const add = async () => {
        const value = url.trim();
        if (!isHttpUrl(value)) {
            setError(t('errorInvalidUrl'));
            return;
        }
        if (lists.some((list) => list.id === value)) {
            setError(t('errorDuplicate'));
            return;
        }
        setBusy(true);
        setError('');
        await ubol.importFilterList(value);
        setUrl('');
        await load();
        setBusy(false);
    };

    const setListEnabled = async (id: string, on: boolean) => {
        const others = enabled.filter((e) => e !== id);
        await ubol.applyRulesets(on ? [...others, id] : others);
        await load();
    };

    const removeList = async (id: string) => {
        await ubol.applyRulesets(enabled.filter((e) => e !== id), [id]);
        await load();
    };

    const update = async () => {
        setBusy(true);
        await ubol.forceUpdateImportedLists();
        await load();
        setBusy(false);
    };

    return (
        <>
            <p class="hint">{t('customListsHint')}</p>
            <form
                class="toolbar"
                onSubmit={(e) => {
                    e.preventDefault();
                    void add();
                }}
            >
                <input
                    class="input"
                    type="url"
                    placeholder="https://example.com/filters.txt"
                    value={url}
                    onInput={(e) => setUrl(e.currentTarget.value)}
                    disabled={busy}
                />
                <Button icon="plus" primary disabled={busy || !url.trim()} onClick={() => void add()}>
                    {busy ? t('adding') : t('add')}
                </Button>
            </form>
            {error && <p class="hint error">{error}</p>}

            <div class="card">
                {lists.length === 0 && <Row title={<span class="sub">{t('noCustomLists')}</span>} />}
                {lists.map((list) => (
                    <Row
                        key={list.id}
                        title={list.name}
                        description={
                            <>
                                <a href={list.homeURL || list.id} target="_blank" rel="noreferrer">{list.id}</a>
                                <br />
                                {list.time.updated
                                    ? t('listInfo', list.filters.accepted.toLocaleString(), new Date(list.time.updated).toLocaleString())
                                    : t('listPending')}
                            </>
                        }
                    >
                        <Button icon="trash" subtle title={t('remove')} onClick={() => void removeList(list.id)} />
                        <Toggle
                            checked={enabled.includes(list.id)}
                            label={list.name}
                            onChange={(on) => void setListEnabled(list.id, on)}
                        />
                    </Row>
                ))}
            </div>

            {lists.length > 0 && (
                <div class="footer-buttons">
                    <Button icon="refresh" disabled={busy} onClick={() => void update()}>{t('updateNow')}</Button>
                </div>
            )}
        </>
    );
};
