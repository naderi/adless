/**
 * Uploads a release ZIP to the Chrome Web Store and the Edge Add-ons and submits it for review.
 * A store is skipped when its credentials are not set.
 *
 *   node scripts/publish-stores.mjs dist/adless-<version>-chrome.zip
 *   node scripts/publish-stores.mjs --check     only signs in and shows the item's status
 *
 * Chrome Web Store API v2: CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN, CWS_PUBLISHER_ID
 * Edge Add-ons API v1.1:   EDGE_CLIENT_ID, EDGE_API_KEY, EDGE_PRODUCT_ID
 */
import fs from 'node:fs';

const CHROME_ITEM = 'mfddbnkcgfcpnchpekbgolnbjckbhmmm';

const check = process.argv[2] === '--check';
const zipFile = process.argv[2];
if (!check && (!zipFile || !fs.existsSync(zipFile))) {
    throw new Error(`ZIP not found: ${zipFile}`);
}
const zip = check ? undefined : fs.readFileSync(zipFile);
const env = process.env;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** fetch that throws with the response body on an HTTP error. */
const request = async (url, options) => {
    const response = await fetch(url, options);
    const text = await response.text();
    if (!response.ok) {
        throw new Error(`${options?.method ?? 'GET'} ${url}: ${response.status} ${text}`);
    }
    return { response, body: text ? JSON.parse(text) : {} };
};

const chrome = async () => {
    const { body: token } = await request('https://oauth2.googleapis.com/token', {
        method: 'POST',
        body: new URLSearchParams({
            client_id: env.CWS_CLIENT_ID,
            client_secret: env.CWS_CLIENT_SECRET,
            refresh_token: env.CWS_REFRESH_TOKEN,
            grant_type: 'refresh_token',
        }),
    });
    const headers = { Authorization: `Bearer ${token.access_token}` };
    const item = `publishers/${env.CWS_PUBLISHER_ID}/items/${CHROME_ITEM}`;
    if (check) {
        const { body } = await request(`https://chromewebstore.googleapis.com/v2/${item}:fetchStatus`, { headers });
        console.log('Chrome Web Store: signed in', JSON.stringify(body));
        return;
    }

    let upload;
    try {
        ({ body: upload } = await request(`https://chromewebstore.googleapis.com/upload/v2/${item}:upload`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/zip' },
            body: zip,
        }));
    } catch (error) {
        // While an earlier version is in review the store takes no new package; that is not a failure.
        if (error.message.includes('NOT_UPDATEABLE')) {
            console.log('Chrome Web Store: an earlier version is still in review, not uploaded - upload the release ZIP once it is approved');
            return;
        }
        throw error;
    }
    let state = upload.uploadState;
    for (let i = 0; state === 'IN_PROGRESS' && i < 30; i++) {
        await sleep(10_000);
        state = (await request(`https://chromewebstore.googleapis.com/v2/${item}:fetchStatus`, { headers })).body.lastAsyncUploadState;
    }
    if (state !== 'SUCCEEDED') {
        throw new Error(`Chrome Web Store upload: ${state} ${JSON.stringify(upload)}`);
    }

    const { body: publish } = await request(`https://chromewebstore.googleapis.com/v2/${item}:publish`, { method: 'POST', headers });
    console.log('Chrome Web Store: submitted for review', JSON.stringify(publish));
};

const edge = async () => {
    const api = `https://api.addons.microsoftedge.microsoft.com/v1/products/${env.EDGE_PRODUCT_ID}/submissions`;
    const headers = { Authorization: `ApiKey ${env.EDGE_API_KEY}`, 'X-ClientID': env.EDGE_CLIENT_ID };
    if (check) {
        // The API has no read-only status call, so ask for an operation that does not exist: bad
        // credentials answer 401/403, valid ones get a "not found" for the made-up operation.
        const probe = await fetch(`${api}/draft/package/operations/00000000-0000-0000-0000-000000000000`, { headers });
        const text = await probe.text();
        if (probe.status === 401 || probe.status === 403) {
            throw new Error(`credentials rejected: ${probe.status} ${text}`);
        }
        console.log(`Edge Add-ons: credentials accepted (probe answered ${probe.status} ${text})`);
        return;
    }

    /** Edge answers 202 with the operation in the Location header and is polled until it is done. */
    const operation = async (url, response) => {
        const id = response.headers.get('location').split('/').pop();
        for (let i = 0; i < 60; i++) {
            await sleep(10_000);
            const { body } = await request(`${url}/operations/${id}`, { headers });
            if (body.status !== 'InProgress') {
                if (body.status !== 'Succeeded') {
                    throw new Error(`Edge Add-ons: ${JSON.stringify(body)}`);
                }
                return;
            }
        }
        throw new Error(`Edge Add-ons: operation ${id} did not finish`);
    };

    const upload = await request(`${api}/draft/package`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/zip' },
        body: zip,
    });
    await operation(`${api}/draft/package`, upload.response);

    const publish = await request(api, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Updated filter lists.' }),
    });
    await operation(api, publish.response);
    console.log('Edge Add-ons: submitted for review');
};

let failed = false;
for (const [name, publish, keys] of [
    ['Chrome Web Store', chrome, ['CWS_CLIENT_ID', 'CWS_CLIENT_SECRET', 'CWS_REFRESH_TOKEN', 'CWS_PUBLISHER_ID']],
    ['Edge Add-ons', edge, ['EDGE_CLIENT_ID', 'EDGE_API_KEY', 'EDGE_PRODUCT_ID']],
]) {
    if (!keys.every((key) => env[key])) {
        console.log(`${name}: skipped, credentials not set`);
        continue;
    }
    try {
        await publish();
    } catch (error) {
        // One store failing must not keep the other from getting the update.
        console.error(`${name}: ${error.message}`);
        failed = true;
    }
}
process.exitCode = failed ? 1 : 0;
