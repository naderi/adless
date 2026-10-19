// Stand-in for fetch() during the uBO Lite build: Node's built-in client aborts on some
// filter list servers (assertion in undici), curl does not.
import { execFile } from 'node:child_process';

globalThis.fetch = (url) => new Promise((resolve, reject) => {
    execFile('curl', ['-sSL', '--compressed', '-w', '\n%{http_code}', String(url)], { maxBuffer: 512 * 1024 * 1024 }, (error, stdout) => {
        if (error) {
            reject(error);
            return;
        }
        const cut = stdout.lastIndexOf('\n');
        resolve(new Response(stdout.slice(0, cut), { status: Number(stdout.slice(cut + 1)) }));
    });
});
