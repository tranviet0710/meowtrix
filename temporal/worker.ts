// temporal/worker.ts — Temporal worker entry point
// Starts a Temporal worker that executes the Search Protocol workflow and its activities.

// Load .env.local before importing anything that reads env vars.
// The worker runs as a standalone Node process (npm run worker) and does NOT
// inherit Next.js's automatic env loading — activities that talk to Supabase
// need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be present.
import { config as loadEnv } from 'dotenv';
import path from 'path';
loadEnv({ path: path.resolve(process.cwd(), '.env.local') });
// Also load .env as a fallback for any values not present in .env.local
loadEnv({ path: path.resolve(process.cwd(), '.env') });

// @supabase/supabase-js unconditionally instantiates a RealtimeClient in its
// constructor, which requires a global WebSocket. Node.js < 22 does not
// provide one, so we shim it here with `ws`. We only use REST (postgrest)
// from activities, but the shim is required just to let the client build.
import WebSocket from 'ws';
// Type-cast because `ws` is not fully API-compatible with the browser
// WebSocket but is enough for supabase-js to run its constructor checks.
if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === 'undefined') {
  (globalThis as { WebSocket: unknown }).WebSocket = WebSocket;
}

import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities';

const TASK_QUEUE = 'meowtrix-search-protocol';

/**
 * Run the Temporal worker.
 *
 * The worker connects to the Temporal server and registers:
 * - Workflow: searchProtocolWorkflow (defined in ./workflows/searchProtocol.ts)
 * - Activities: all exported functions from ./activities/index.ts
 *
 * Environment variables required:
 * - TEMPORAL_ADDRESS: Temporal server address (default: localhost:7233)
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key
 */
async function run(): Promise<void> {
  const address = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';

  const connection = await NativeConnection.connect({ address });

  const worker = await Worker.create({
    connection,
    workflowsPath: require.resolve('./workflows'),
    activities,
    taskQueue: TASK_QUEUE,
  });

  console.log(`[Temporal Worker] Starting on task queue: ${TASK_QUEUE}`);
  console.log(`[Temporal Worker] Connected to: ${address}`);

  await worker.run();
}

run().catch((err) => {
  console.error('[Temporal Worker] Fatal error:', err);
  process.exit(1);
});
