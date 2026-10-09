import { runtime } from './runtime.js';
const port = Number(new URL(process.env.APP_ORIGIN ?? 'http://127.0.0.1:3000').port || 3000);
runtime().listen(port, '127.0.0.1', () => console.log(`Profile MCP listening on 127.0.0.1:${port}`));
