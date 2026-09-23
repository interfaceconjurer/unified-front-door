import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { browserSuites } from './suites.mjs';
const label = process.argv[2] ?? 'candidate';
if (!/^[a-zA-Z0-9_-]+$/.test(label))
    throw new Error('Use a simple artifact label.');
const args = process.argv.slice(3);
if (args.length && (args.length !== 2 || args[0] !== '--shard')) throw new Error('Use [LABEL] [--shard INDEX/COUNT].');
for (const suite of browserSuites(args[1])) {
    const start = Date.now();
    console.log(`Browser suite: ${suite}`);
    const result = spawnSync(process.execPath, [fileURLToPath(new URL(`./${suite}.mjs`, import.meta.url)), label], { stdio: 'inherit', env: process.env });
    console.log(`Browser suite: ${suite} ${result.status === 0 ? 'passed' : 'failed'} in ${((Date.now() - start) / 1000).toFixed(1)}s`);
    if (result.error)
        throw result.error;
    if (result.status !== 0)
        process.exit(result.status ?? 1);
}
