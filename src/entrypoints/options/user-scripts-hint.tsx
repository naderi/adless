import { useEffect, useState } from 'preact/hooks';

import { t } from '@/ui/components';

/**
 * Cosmetic filters and scriptlets from own rules and lists run as user scripts, which the browser
 * only allows after the user switched them on for the extension.
 */
export const UserScriptsHint = () => {
    const [allowed, setAllowed] = useState(true);

    useEffect(() => {
        try {
            // Throws while user scripts are not allowed.
            void chrome.userScripts.getScripts().then(() => setAllowed(true), () => setAllowed(false));
        } catch {
            setAllowed(false);
        }
    }, []);

    return allowed ? null : <p class="hint warning-box">{t('userScriptsHint')}</p>;
};
