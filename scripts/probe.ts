// Authentication remains browser-only. This script only probes public service readiness.
if (!process.argv.includes('--live')) throw new Error('Opt-in required: --live --origin=https://approved-deployment');
const origin = process.argv.find(x => x.startsWith('--origin='))?.slice(9);
if (!origin || new URL(origin).protocol !== 'https:') throw new Error('Approved HTTPS origin required');
for (const path of ['/api/health', '/api/ready', '/.well-known/oauth-protected-resource/api/mcp', '/.well-known/oauth-authorization-server']) {
  const response = await fetch(new URL(path, origin), { redirect: 'error', signal: AbortSignal.timeout(10000) });
  console.log(JSON.stringify({ path, status: response.status })); if (!response.ok) process.exitCode = 1;
}
