import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import Provider from 'oidc-provider';
import { createApp } from '../dist/src/app.js';
if (typeof Server !== 'function' || typeof Provider !== 'function' || typeof createApp !== 'function') throw new Error('ESM import failed');
console.log('Native Node ESM imports passed');
