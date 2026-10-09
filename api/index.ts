import type { Request, Response } from 'express';
import { runtime } from '../src/runtime.js';
let app: ReturnType<typeof runtime> | undefined;
export default function handler(req: Request, res: Response) {
  try { app ??= runtime(); return app(req, res); }
  catch { res.setHeader('Cache-Control', 'no-store'); res.statusCode = 503; res.end(JSON.stringify({ error: 'SERVICE_NOT_CONFIGURED' })); }
}
