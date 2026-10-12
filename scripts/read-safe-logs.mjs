// Print only transport facts and explicitly allowlisted diagnostic fields.
import { execFileSync } from 'node:child_process';
let raw;
try { raw=execFileSync(process.execPath,['node_modules/vercel/dist/vc.js','logs','--environment','production','--since','2h','--limit','100','--json'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000}); }
catch { throw new Error('Log retrieval failed; raw output withheld'); }
let first=true;
for(const line of raw.split('\n')) {
  let row; try{row=JSON.parse(line);}catch{continue;}
  if(first){console.log(JSON.stringify({availableFields:Object.keys(row)}));first=false;}
  const path=String(row.requestPath ?? row.path ?? row.request?.path ?? '').split('?')[0];
  const known=['/reg','/token','/api/mcp','/api/ready','/.well-known/oauth-authorization-server'];
  const safe={time:row.timestamp??row.time,path:known.includes(path)?path:(path.startsWith('/interaction/')?`/interaction/[redacted]${/^\/interaction\/[^/]+\/(login|verify|consent|restart)$/.exec(path)?.[1]?'/'+path.split('/')[3]:''}`:(/^\/auth\/[^/]+$/.test(path)?'/auth/[redacted]':(path==='/auth'?'/auth':'other'))),method:row.requestMethod??row.method,status:row.responseStatusCode??row.statusCode??row.status,duration:row.duration};
  console.log(JSON.stringify(safe));
  // Registration diagnostics (src/oauth.ts) are re-validated here; only code, allowlisted reason and field names pass.
  let event; try{event=JSON.parse(String(row.message ?? ''));}catch{}
  if(event?.event==='oauth.registration_rejected'){
    const word=v=>typeof v==='string'&&/^[A-Za-z0-9 _.-]{1,80}$/.test(v)?v:'unclassified';
    console.log(JSON.stringify({event:event.event,error:word(event.error),reason:word(event.reason),fields:Array.isArray(event.fields)?event.fields.filter(f=>/^[a-z_]{1,64}$/.test(f)).slice(0,40):[]}));
  }
  if(event?.event==='oauth.interaction_failed'){
    const reasons=['provider_session_missing','interaction_mismatch','flow_cookie_missing','flow_cookie_invalid','flow_expired','flow_consumed','flow_mismatch','challenge_expired','login_expired','csrf_mismatch','authorization_mismatch','member_not_allowed'];
    const codes=['INVALID_INPUT','UNAUTHENTICATED','REAUTH_REQUIRED','FORBIDDEN_SCOPE','CAPABILITY_UNAVAILABLE','UPSTREAM_AUTH_FAILED','UPSTREAM_REJECTED','UPSTREAM_SHAPE_CHANGED','RATE_LIMITED','UPSTREAM_TIMEOUT','STORE_UNAVAILABLE'];
    console.log(JSON.stringify({event:event.event,requestId:typeof event.requestId==='string'&&/^[a-f0-9-]{36}$/.test(event.requestId)?event.requestId:null,step:['login','verify','consent','restart','page'].includes(event.step)?event.step:'unclassified',error:codes.includes(event.error)?event.error:'unclassified',reason:reasons.includes(event.reason)?event.reason:'unclassified'}));
  }
  // Key names are non-sensitive, useful across CLI schema revisions.
  if(!path) console.log(JSON.stringify({availableFields:Object.keys(row)}));
}
if(first) console.log(JSON.stringify({status:'no_logs_returned',since:'2h',note:'Absence of logs does not prove absence of failed requests.'}));
