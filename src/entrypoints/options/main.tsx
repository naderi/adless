import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';

import { Icon, type IconName, Logo, reportColorScheme, t } from '@/ui/components';
import '@/ui/theme.css';
import './options.css';

import { About } from './about';
import { Allowlist } from './allowlist';
import { CustomLists } from './custom-lists';
import { FilterLists } from './filter-lists';
import { General } from './general';
import { UserRules } from './user-rules';

const PAGES: { id: string; label: string; icon: IconName; Page: () => preact.JSX.Element | null }[] = [
    { id: 'filters', label: t('navFilters'), icon: 'shield', Page: FilterLists },
    { id: 'lists', label: t('navCustomLists'), icon: 'list', Page: CustomLists },
    { id: 'rules', label: t('navRules'), icon: 'code', Page: UserRules },
    { id: 'allowlist', label: t('navAllowlist'), icon: 'check', Page: Allowlist },
    { id: 'general', label: t('navGeneral'), icon: 'gear', Page: General },
    { id: 'about', label: t('navAbout'), icon: 'info', Page: About },
];

const currentPage = () => PAGES.find((page) => `#${page.id}` === location.hash) ?? PAGES[0]!;

const Options = () => {
    const [page, setPage] = useState(currentPage);

    useEffect(() => {
        reportColorScheme();
        const onHash = () => setPage(currentPage());
        window.addEventListener('hashchange', onHash);
        return () => window.removeEventListener('hashchange', onHash);
    }, []);

    useEffect(() => {
        document.title = `${page.label} – AdLess`;
    }, [page]);

    return (
        <div class="layout">
            <nav class="nav">
                <div class="brand">
                    <Logo size={28} />
                    <span>AdLess</span>
                </div>
                {PAGES.map((p) => (
                    <a
                        key={p.id}
                        href={`#${p.id}`}
                        class={p === page ? 'nav-item selected' : 'nav-item'}
                        aria-current={p === page ? 'page' : undefined}
                    >
                        <Icon name={p.icon} />
                        {p.label}
                    </a>
                ))}
            </nav>
            <main class="content">
                <h2>{page.label}</h2>
                <page.Page key={page.id} />
            </main>
        </div>
    );
};

render(<Options />, document.getElementById('app')!);
