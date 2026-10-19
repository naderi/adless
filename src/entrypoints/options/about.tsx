import { isGerman, Logo, t } from '@/ui/components';

const WEBSITE = 'https://digitalent.dev';
const REPOSITORY = 'https://github.com/naderi/adless';

const Field = ({ label, children }: { label: string; children: preact.ComponentChildren }) => (
    <div class="row">
        <span class="row-text field-label">{label}</span>
        <span class="value">{children}</span>
    </div>
);

export const About = () => (
    <>
        <div class="about-head">
            <Logo size={48} />
            <div>
                <div class="name">AdLess</div>
                <div class="sub">{t('version', chrome.runtime.getManifest().version)}</div>
            </div>
        </div>
        <p class="hint">{t('appDescription')}</p>

        <div class="card">
            <Field label={t('developer')}>Ali Naderi</Field>
            <Field label={t('website')}>
                <a href={`${WEBSITE}/${isGerman() ? 'de' : 'en'}/`} target="_blank" rel="noreferrer">
                    {WEBSITE.replace('https://', '')}
                </a>
            </Field>
            <Field label={t('sourceCode')}>
                <a href={REPOSITORY} target="_blank" rel="noreferrer">{REPOSITORY.replace('https://', '')}</a>
            </Field>
            <Field label={t('license')}>{t('licenseValue')}</Field>
        </div>

        <h3 class="section-title">{t('credits')}</h3>
        <p class="hint">{t('creditsText')}</p>
    </>
);
