import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { config } from 'dotenv';
import app from './index';
import { connectDB } from './db/mongodb';
import { MongoKVNamespace } from './adapters/KVNamespaceAdapter';
import { MongoR2Bucket } from './adapters/R2BucketAdapter';
import { DEFAULT_MODEL } from './ai/providers';

// Load environment variables from .dev.vars if present
config({ path: '.dev.vars' });

// Initialize MongoDB
connectDB(process.env.MONGODB_URI);

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8787;

// Create MongoDB-backed adapter instances
const metadataAdapter = new MongoKVNamespace('METADATA');
const filesAdapter = new MongoR2Bucket('blueprint-ai');

const serverApp = new Hono<any>();

// Middleware to inject MongoDB adapters into the Hono context
// This makes c.env.METADATA and c.env.FILES available to all route handlers
serverApp.use('*', async (c, next) => {
  c.env = {
    METADATA: metadataAdapter as any,
    FILES: filesAdapter as any,
    CLERK_ISSUER: process.env.CLERK_ISSUER || '',
    CLERK_JWKS_URL: process.env.CLERK_JWKS_URL || '',
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
    GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY || '',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || '',
    CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET || '',
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || '',
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || '',
  };

  await next();
});

// Mount the original application routes
serverApp.route('/', app);

console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
console.log("!!!   THIS IS THE V3 WORKER RUNNING ON PORT 8787               !!!");
console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
console.log(`Starting Node.js Hono server on port ${port}...`);
console.log(`[DEBUG] DEFAULT_MODEL: ${DEFAULT_MODEL}`);
console.log(`[DEBUG] Registry Reloaded at: ${new Date().toISOString()}`);

// Make duplicate dev server launches easier to understand.
process.on('uncaughtException', (error: NodeJS.ErrnoException) => {
  if (error?.code === 'EADDRINUSE') {
    console.error(
      `[Server] Port ${port} is already in use. Another dev server is already running.`
    );
    console.error('[Server] Stop the existing process or start with a different PORT.');
    process.exit(1);
  }

  throw error;
});

const server = serve({
  fetch: serverApp.fetch,
  port,
});

// Configure Node.js HTTP server timeouts to 10 minutes to support long streaming responses
const httpServer = server as any;
httpServer.timeout = 600000;
httpServer.headersTimeout = 600000;
httpServer.requestTimeout = 600000;
httpServer.keepAliveTimeout = 600000;

