// Pre-push scan; reports paths/categories only. Never print matched values.
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
const git = args => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const paths = git(['diff', '--cached', '--name-only', '-z', '--diff-filter=ACM']).split('\0').filter(Boolean);
const failures = [];
const needles = [];
try {
  const env = JSON.parse(await readFile('.runtime/env.production.json', 'utf8'));
  for (const [k,v] of Object.entries(env)) if (/DATABASE_URL|KEY|COOKIE_SECRET/.test(k) && typeof v === 'string' && v.length >= 24) needles.push(v);
  if(env.DATABASE_URL)needles.push(decodeURIComponent(new URL(env.DATABASE_URL).password));
  if(env.SESSION_ENCRYPTION_KEYRING)needles.push(...Object.values(JSON.parse(env.SESSION_ENCRYPTION_KEYRING).keys));
  if(env.OAUTH_SIGNING_KEYS)for(const key of JSON.parse(env.OAUTH_SIGNING_KEYS).keys)for(const name of ['d','p','q'])if(key[name])needles.push(key[name]);
} catch(error) { if(error.code!=='ENOENT')throw new Error('Private scan configuration unreadable; no values printed'); }
for(const path of paths) {
  if(/(^|\/)(\.runtime|\.vercel|logs|credentials|sessions|node_modules)(\/|$)/.test(path) || /(^|\/)\.env(?!\.example$)/.test(path) || path.startsWith('supabase/.temp/'))failures.push({path,reason:'private-path'});
  const text = git(['show',`:${path}`]);
  if(needles.some(value=>value.length>=24&&text.includes(value)))failures.push({path,reason:'known-private-material'});
  if(/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}|(?:sbp_|gh[pousr]_)[A-Za-z0-9]{30,}/.test(text))failures.push({path,reason:'secret-pattern'});
}
console.log(JSON.stringify({stagedFiles:paths.length,status:failures.length?'failed':'passed',localPrivateMaterialCompared:needles.length>0,failures},null,2));
if(failures.length)process.exitCode=1;
