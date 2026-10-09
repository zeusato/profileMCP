import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
const file = process.argv[2];
if (!file || !/^\.runtime\/[a-z-]+\.sql$/.test(file)) throw new Error('Only reviewed .runtime SQL files are accepted');
let output;
try { output = execFileSync('powershell.exe', ['-NoProfile', '-Command', `npx --yes supabase db query --linked --file '${file}'`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
catch (error) { await writeFile('.runtime/provision-error.txt', String(error.stderr ?? error.stdout ?? error.message)); throw new Error('Private SQL failed; details retained in ignored local file, not printed'); }
if (output.includes('"_tag":"Error"')) throw new Error('Management API rejected private SQL');
console.log('Private SQL applied successfully.');
