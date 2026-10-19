/**
 * Cookie banners, page side: DuckDuckGo's autoconsent finds the banner and clicks "reject"; the
 * rules and settings come from the service worker (src/engine-ext/consent.ts).
 */
import AutoConsent from '@duckduckgo/autoconsent';
import type { BackgroundMessage } from '@duckduckgo/autoconsent';

const CONSENT_MESSAGE = 'adless:consent';

export default defineContentScript({
    matches: ['<all_urls>'],
    allFrames: true,
    // Banners in frames without an address of their own (about:blank, srcdoc) too.
    matchOriginAsFallback: true,
    runAt: 'document_start',
    main() {
        const consent = new AutoConsent(async (msg) => {
            await chrome.runtime.sendMessage({ what: CONSENT_MESSAGE, msg });
        });
        chrome.runtime.onMessage.addListener((message: { what?: string; msg: BackgroundMessage }) => {
            if (message?.what === CONSENT_MESSAGE) {
                void consent.receiveMessageCallback(message.msg);
            }
            return undefined;
        });
    },
});
