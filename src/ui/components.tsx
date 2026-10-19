import type { ComponentChildren } from 'preact';

import { readState, updateState } from '@/lib/store';

export const t = (key: string, ...substitutions: (string | number)[]) =>
    chrome.i18n.getMessage(key, substitutions.map(String)) || key;

export const isGerman = () => chrome.i18n.getUILanguage().toLowerCase().startsWith('de');

/** Tells the service worker the browser theme, which picks the toolbar icon. */
export const reportColorScheme = () => {
    const colorScheme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    void readState().then((state) => {
        if (state.colorScheme !== colorScheme) {
            void updateState((s) => { s.colorScheme = colorScheme; });
        }
    });
};

const ICONS = {
    shield: 'M12 3l7 3v5c0 4.6-3 8.6-7 10-4-1.4-7-5.4-7-10V6l7-3z',
    power: 'M12 3v8M6.4 6.4a8 8 0 1 0 11.2 0',
    sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
    info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.01',
    target: 'M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM12 2v4M12 18v4M2 12h4M18 12h4',
    list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
    code: 'M9 7l-5 5 5 5M15 7l5 5-5 5',
    check: 'M5 12l5 5 9-10',
    globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z',
    refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4',
    reset: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4',
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    plus: 'M12 5v14M5 12h14',
    download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
    upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
    chevron: 'M9 6l6 6-6 6',
    flag: 'M5 21V4M5 4h12l-2.5 4.5L17 13H5',
    cookie: 'M12 3a9 9 0 1 0 9 9 3 3 0 0 1-3.5-3A3 3 0 0 1 14 5.5 3 3 0 0 1 12 3zM8.5 10h.01M9 15h.01M14 15.5h.01M12.5 12h.01',
    gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
} as const;

export type IconName = keyof typeof ICONS;

export const Icon = ({ name, size = 16 }: { name: IconName; size?: number }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
    >
        <path d={ICONS[name]} />
    </svg>
);

/** The logo, in lighter colors on dark themes. */
export const Logo = ({ size }: { size: number }) => (
    <picture>
        <source srcset="/logo-dark.svg" media="(prefers-color-scheme: dark)" />
        <img src="/logo.svg" width={size} height={size} alt="" style={{ display: 'block' }} />
    </picture>
);

export const Toggle = ({ checked, disabled, label, onChange }: {
    checked: boolean;
    disabled?: boolean;
    label: string;
    onChange: (checked: boolean) => void;
}) => (
    <input
        type="checkbox"
        role="switch"
        class="toggle"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        title={label}
        onChange={(e) => onChange(e.currentTarget.checked)}
    />
);

export const Button = ({ icon, primary, subtle, title, disabled, onClick, children }: {
    icon?: IconName;
    primary?: boolean;
    subtle?: boolean;
    title?: string;
    disabled?: boolean;
    onClick: () => void;
    children?: ComponentChildren;
}) => (
    <button
        type="button"
        class={['button', primary && 'primary', subtle && 'subtle', !children && 'icon-only'].filter(Boolean).join(' ')}
        title={title}
        aria-label={title}
        disabled={disabled}
        onClick={onClick}
    >
        {icon && <Icon name={icon} />}
        {children}
    </button>
);

/** A settings row: caption with optional description on the left, a control on the right. */
export const Row = ({ title, description, children }: {
    title: ComponentChildren;
    description?: ComponentChildren;
    children?: ComponentChildren;
}) => (
    <div class="row">
        <div class="row-text">
            <div>{title}</div>
            {description && <div class="sub">{description}</div>}
        </div>
        {children}
    </div>
);
