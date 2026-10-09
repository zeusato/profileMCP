import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const get=p=>JSON.parse(read(p));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const failures=[];
let assertions=0;
function check(ok,message){assertions++;if(!ok)failures.push(message);}
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?(['.git','node_modules','.runtime','.vercel','dist','.temp','coverage'].includes(x.name)?[]:walk(path.join(dir,x.name))):[path.join(dir,x.name)]);
const files=walk(root);
for(const f of files.filter(x=>x.endsWith('.json'))){try{JSON.parse(fs.readFileSync(f,'utf8'));check(true,'JSON');}catch(e){check(false,'Invalid JSON '+path.relative(root,f));}}
for(const f of files.filter(x=>x.endsWith('.md'))){
 const text=fs.readFileSync(f,'utf8');
 for(const m of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)){
  const href=m[1].replace(/^<|>$/g,'').split('#')[0];
  if(!href||/^[a-z]+:/i.test(href))continue;
  const target=path.resolve(path.dirname(f),decodeURIComponent(href));
  if(target===path.join(root,'config/document-validation.json'))continue;
  check(fs.existsSync(target),`Broken local link ${path.relative(root,f)} -> ${href}`);
 }
}
const catalog=get('config/sha-read-candidates.json');
const routes=catalog.routes;
const count=get('config/document-counts.json');
check(routes.length===40&&count.readRoutes===40,'Read route count');
check(new Set(routes.map(x=>x.id)).size===routes.length,'Unique operation IDs');
check(new Set(routes.map(x=>x.method+' '+x.path)).size===routes.length,'Unique method/path');
const denied=get('config/sha-denied-routes.json');
const denySet=new Set(denied.businessWrites.map(x=>x.method+' '+x.path));
check(denySet.size===4&&denied.default==='deny','Trading writes/default deny');
const tests=new Set();
const testMap=read('docs/api/TEST-MAP.md');
const endpoints=read('docs/api/ENDPOINTS.md');
for(const r of routes){
 check(r.enabled===false&&r.status==='planned-candidate','No candidate enabled '+r.id);
 check(['GET','POST'].includes(r.method)&&r.host==='https://api.shs.com.vn','Fixed transport '+r.id);
 check(!denySet.has(r.method+' '+r.path)&&!r.path.includes('/auth/'),'No business/auth write '+r.id);
 check(r.fieldMap.length>0&&r.provenance.length>0&&r.tests.length===5&&!!r.requestBinding&&!!r.rawResponse,'Traceability '+r.id);
 check(r.inputSchema.additionalProperties===false&&r.inputSchema.properties.operation.const===r.id,'Strict input '+r.id);
 check(r.inputSchema.required.every(k=>k in r.inputSchema.properties),'Input required fields '+r.id);
 check(r.provenance.every(p=>Number.isInteger(p.line)&&p.line>0&&/^[a-f0-9]{64}$/.test(p.sha256)),'Provenance shape '+r.id);
 check(endpoints.includes('## '+r.id),'Endpoint document '+r.id);
 for(const t of r.tests){check(!tests.has(t)&&testMap.includes(t),'Test-map ID '+t);tests.add(t);}
}
check(tests.size===200,'200 planned operation test IDs');
const t=get('config/tool-input-schemas.json');
check(t.tools.length===17&&t.metadataTools.length===2,'Tool counts');
for(const tool of t.tools){
 check(tool.annotations.readOnlyHint===true&&tool.annotations.destructiveHint===false,'Tool annotations '+tool.name);
 check(tool.operations.length===tool.inputSchema.oneOf.length,'Tool schema coverage '+tool.name);
 check(tool.operations.every(id=>routes.some(r=>r.id===id&&r.tool===tool.name)),'Tool operation mapping '+tool.name);
}
const discovery=get('config/discovery-inventory.json');
check(discovery.pathCount===69&&discovery.methodPathCount===70&&discovery.entries.length===70,'Swagger inventory counts');
check(discovery.entries.every(x=>x.enabled===false),'Discovery disabled');
const codeInventory=get('config/code-route-inventory.json');
check(codeInventory.uniquePaths===37&&codeInventory.entries.length===37,'Code literal route inventory');
check(codeInventory.entries.every(x=>x.enabled===false&&x.provenance.length>0),'Code discovery remains disabled and sourced');
const auth=get('config/sha-auth-routes.json');
check(auth.routes.length===3&&auth.routes.every(x=>x.toolExposed===false&&x.enabled===false)&&auth.refresh.enabled===false,'Auth separated, refresh disabled');
const sql=read('docs/database/SCHEMA.sql');
const tables=[...sql.matchAll(/CREATE TABLE profile_mcp\.([a-z_]+)/g)].map(x=>x[1]);
check(tables.length===11,'SQL table count');
for(const name of tables){check(sql.includes(`ALTER TABLE profile_mcp.${name} ENABLE ROW LEVEL SECURITY;`)&&sql.includes(`ALTER TABLE profile_mcp.${name} FORCE ROW LEVEL SECURITY;`),'SQL RLS '+name);}
check(!/CREATE POLICY|GRANT ALL|CREATE ROLE/i.test(sql),'No permissive runtime grants in base schema');
const cloud=get('config/cloud-setup.json');
check(cloud.migrationSha256===sha(sql),'Applied migration hash matches saved SQL');
check(cloud.result.tableCount===11&&cloud.result.dataApiEnabled===false,'Cloud evidence summary');
const manifest=get('config/source-manifest.json');
check(manifest.copiedSourceFiles===false&&manifest.files.every(x=>/^[a-f0-9]{64}$/.test(x.sha256)),'Source manifest');
let sourceHashChecks='not-requested';
if(process.argv.includes('--verify-source')){
 sourceHashChecks='performed';
 for(const entry of manifest.files){const p=path.join(manifest.sourceRootAtReview,entry.path);check(fs.existsSync(p)&&sha(fs.readFileSync(p))===entry.sha256,'Source unchanged '+entry.path);}
}
for(const f of files.filter(x=>/\.(md|json|sql)$/.test(x))){
 const text=fs.readFileSync(f,'utf8');
 check(!/eyJ[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(text),'No JWT-shaped secret '+path.relative(root,f));
 check(!/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(text),'No private key '+path.relative(root,f));
}
const report={checkedAt:new Date().toISOString(),scope:'document-consistency-only; not runtime/API acceptance',status:failures.length?'failed':'passed',assertions,files:files.length,readRoutes:routes.length,businessTools:t.tools.length,metadataTools:t.metadataTools.length,plannedOperationTestIds:tests.size,sourceHashChecks,failures};
fs.writeFileSync(path.join(root,'config/document-validation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(failures.length)process.exitCode=1;
