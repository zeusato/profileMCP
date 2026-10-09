import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Settings } from './config.js';
import { AppError } from './errors.js';
export class Vault {
  constructor(private readonly ring: Settings['keyring'], private readonly hmacKey: string) {}
  digest(value: string): string { return createHmac('sha256', Buffer.from(this.hmacKey, 'base64url')).update(value).digest('hex'); }
  nonce(): string { return randomBytes(32).toString('base64url'); }
  equal(a: string, b: string): boolean { const x = Buffer.from(a); const y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }
  seal(value: unknown, aad: string): string {
    const iv = randomBytes(12); const kid = this.ring.active;
    const cipher = createCipheriv('aes-256-gcm', Buffer.from(this.ring.keys[kid]!, 'base64url'), iv);
    cipher.setAAD(Buffer.from(`profile_mcp:v1:${kid}:${aad}`));
    return JSON.stringify({ v: 1, kid, iv: iv.toString('base64url'), tag: (() => { const data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]); return { data: data.toString('base64url'), auth: cipher.getAuthTag().toString('base64url') }; })() });
  }
  open<T>(text: string, aad: string): T {
    try {
      const blob = JSON.parse(text); if (blob.v !== 1 || !this.ring.keys[blob.kid]) throw new Error();
      const decipher = createDecipheriv('aes-256-gcm', Buffer.from(this.ring.keys[blob.kid]!, 'base64url'), Buffer.from(blob.iv, 'base64url'));
      decipher.setAAD(Buffer.from(`profile_mcp:v1:${blob.kid}:${aad}`)); decipher.setAuthTag(Buffer.from(blob.tag.auth, 'base64url'));
      return JSON.parse(Buffer.concat([decipher.update(Buffer.from(blob.tag.data, 'base64url')), decipher.final()]).toString());
    } catch { throw new AppError('STORE_UNAVAILABLE', 503); }
  }
  get keyId() { return this.ring.active; }
}
