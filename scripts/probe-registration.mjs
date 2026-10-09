// Public OAuth registration smoke. Never prints client secrets or identifiers.
import assert from 'node:assert/strict';
const origin = 'https://profile-mcp.vercel.app';
const discovery = await fetch(`${origin}/.well-known/oauth-authorization-server`).then(r => r.json());
console.log(JSON.stringify({issuer:discovery.issuer,registration:discovery.registration_endpoint,scopes:discovery.scopes_supported,methods:discovery.token_endpoint_auth_methods_supported}));
assert.equal(discovery.issuer, origin);
for (const method of ['none', 'client_secret_post', 'client_secret_basic']) {
  const response = await fetch(discovery.registration_endpoint, {method:'POST',headers:{'Content-Type':'application/json'},redirect:'error',body:JSON.stringify({
    client_name:'Profile MCP registration smoke',redirect_uris:['https://claude.ai/api/mcp/auth_callback'],
    response_types:['code'],grant_types:['authorization_code','refresh_token'],token_endpoint_auth_method:method
  })});
  const result = await response.json();
  console.log(JSON.stringify({method,status:response.status,error:result.error,description:response.status===201?undefined:result.error_description,clientIssued:typeof result.client_id==='string'}));
  if(response.status!==201)process.exitCode=1;
}
