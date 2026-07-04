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

import { NativeConnection, Worker, NativeConnectionOptions } from '@temporalio/worker';
import * as activities from './activities';
import {
  getTemporalAddress,
  getTemporalNamespace,
  getTemporalTaskQueue,
  getWorkerConnectionOptions,
} from '../lib/temporalClient';

const TASK_QUEUE = getTemporalTaskQueue();

/**
 * Run the Temporal worker.
 *
 * The worker connects to the Temporal server and registers:
 * - Workflow: searchProtocolWorkflow (defined in ./workflows/searchProtocol.ts)
 * - Activities: all exported functions from ./activities/index.ts
 *
 * Environment variables required:
 * - TEMPORAL_ADDRESS: Temporal server address (default: localhost:7233)
 * - TEMPORAL_NAMESPACE: Temporal namespace (default: default)
 * - TEMPORAL_API_KEY: API key for Temporal Cloud (optional, preferred for Cloud)
 * - TEMPORAL_TLS_CERT: Client certificate for mTLS connection (optional)
 * - TEMPORAL_TLS_KEY: Client private key for mTLS connection (optional)
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key
 */
async function run(): Promise<void> {
  const address = getTemporalAddress();
  const namespace = getTemporalNamespace();

  // Auth mode (apiKey / mTLS / plaintext) is decided by getWorkerConnectionOptions().
  const connectionOptions = getWorkerConnectionOptions() as NativeConnectionOptions;

  if (connectionOptions.apiKey) {
    console.log(
      '[Temporal Worker] API key authentication enabled for Temporal Cloud.',
    );
  } else if (connectionOptions.tls && typeof connectionOptions.tls === 'object') {
    console.log(
      '[Temporal Worker] mTLS client certificate authentication enabled.',
    );
  }

  const connection = await NativeConnection.connect(connectionOptions);

  const worker = await Worker.create({
    connection,
    namespace,
    workflowsPath: require.resolve('./workflows'),
    activities,
    taskQueue: TASK_QUEUE,
  });

  console.log(`[Temporal Worker] Starting on task queue: ${TASK_QUEUE}`);
  console.log(`[Temporal Worker] Using namespace: ${namespace}`);
  console.log(`[Temporal Worker] Connected to: ${address}`);

  await worker.run();
}

run().catch((err) => {
  console.error('[Temporal Worker] Fatal error:', err);
  process.exit(1);
});
