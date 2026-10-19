import { useEffect, useState } from 'preact/hooks';

import { Button, t } from '@/ui/components';

/** A textarea with a Save button that reports "Saved" until the next edit. */
export const TextEditor = ({ value, placeholder, onSave }: {
    value: string;
    placeholder?: string;
    onSave: (text: string) => Promise<unknown>;
}) => {
    const [text, setText] = useState(value);
    const [saved, setSaved] = useState(false);
    const [busy, setBusy] = useState(false);

    // Picks up rules added elsewhere (e.g. with "Hide element") while the page is open.
    useEffect(() => setText(value), [value]);

    const save = async () => {
        setBusy(true);
        await onSave(text);
        setBusy(false);
        setSaved(true);
    };

    return (
        <>
            <textarea
                class="textarea"
                spellcheck={false}
                placeholder={placeholder}
                value={text}
                onInput={(e) => {
                    setText(e.currentTarget.value);
                    setSaved(false);
                }}
                onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                        e.preventDefault();
                        void save();
                    }
                }}
            />
            <div class="footer-buttons">
                {saved && <span class="sub">{t('saved')}</span>}
                <Button primary disabled={busy || text === value} onClick={() => void save()}>{t('save')}</Button>
            </div>
        </>
    );
};
