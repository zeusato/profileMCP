import { createApp } from './app.js';
import { readSettings } from './config.js';
import { Vault } from './crypto.js';
import { postgresRpc, Store } from './store.js';
export function runtime() { const settings = readSettings(); const db = postgresRpc(settings.databaseUrl, settings.databaseCa); const store = new Store(db.rpc, new Vault(settings.keyring, settings.hmacKey), settings.teamId); return createApp(settings, store).app; }
