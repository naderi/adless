import { useEffect, useState } from 'preact/hooks';

import { ubol } from '@/lib/ubol';
import { Button, Row, t } from '@/ui/components';

import { TextEditor } from './text-editor';

export const UserRules = () => {
    const [rules, setRules] = useState<string>();
    const [picked, setPicked] = useState<[string, string[]][]>([]);

    const loadPicked = async () => setPicked((await ubol.getAllCustomFilters()).filter(([, selectors]) => selectors.length > 0));

    useEffect(() => {
        void ubol.getSandboxFilters().then((text) => setRules(text ?? ''));
        void loadPicked();
    }, []);

    if (rules === undefined) {
        return null;
    }

    return (
        <>
            <p class="hint">{t('rulesHint')}</p>
            <p class="examples">
                {t('rulesExamples')}:<br />
                <code>||ads.example.com^</code> – {t('exampleBlock')}<br />
                <code>example.com##.banner</code> – {t('exampleHide')}<br />
                <code>@@||example.com^</code> – {t('exampleAllow')}
            </p>
            <TextEditor
                value={rules}
                placeholder="||ads.example.com^"
                onSave={async (text) => {
                    await ubol.setSandboxFilters(text);
                    setRules(text.trim());
                }}
            />

            <h3 class="section-title">{t('pickedTitle')}</h3>
            <p class="hint">{t('pickedHint')}</p>
            <div class="card">
                {picked.length === 0 && <Row title={<span class="sub">{t('pickedNone')}</span>} />}
                {picked.flatMap(([hostname, selectors]) => selectors.map((selector) => (
                    <Row key={`${hostname} ${selector}`} title={hostname} description={<code>{selector}</code>}>
                        <Button
                            icon="trash"
                            subtle
                            title={t('remove')}
                            onClick={async () => {
                                await ubol.removeCustomFilters(hostname, [selector]);
                                await loadPicked();
                            }}
                        />
                    </Row>
                )))}
            </div>
        </>
    );
};
