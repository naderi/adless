import { useEffect, useState } from 'preact/hooks';

import { type FilteringModes, ubol } from '@/lib/ubol';
import { t } from '@/ui/components';

import { TextEditor } from './text-editor';

/** Marks "paused everywhere" in uBO Lite's list of unfiltered sites (AdLess switched off). */
const ALL_URLS = 'all-urls';

/** Accepts plain domains as well as pasted addresses. */
const toHostname = (line: string) => {
    try {
        return new URL(line.includes('://') ? line : `https://${line}`).hostname;
    } catch {
        return null;
    }
};

export const Allowlist = () => {
    const [modes, setModes] = useState<FilteringModes>();

    useEffect(() => {
        void ubol.getFilteringModeDetails().then(setModes);
    }, []);

    if (!modes) {
        return null;
    }

    const sites = modes.none.filter((site) => site !== ALL_URLS);

    return (
        <>
            <p class="hint">{t('allowlistHint')}</p>
            <TextEditor
                value={sites.join('\n')}
                placeholder="example.com"
                onSave={async (text) => {
                    const hostnames = [...new Set(text.split('\n')
                        .map((line) => line.trim())
                        .filter(Boolean)
                        .map(toHostname)
                        .filter((hostname): hostname is string => hostname !== null))];
                    const keep = modes.none.includes(ALL_URLS) ? [ALL_URLS] : [];
                    const without = (list: string[]) => list.filter((site) => !hostnames.includes(site));
                    setModes(await ubol.setFilteringModeDetails({
                        none: [...keep, ...hostnames],
                        basic: without(modes.basic),
                        optimal: without(modes.optimal),
                        complete: without(modes.complete),
                    }));
                }}
            />
        </>
    );
};
