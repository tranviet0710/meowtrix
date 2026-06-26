// temporal/worker.ts — Temporal worker entry point
// Starts a Temporal worker that executes the Search Protocol workflow and its activities.

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
    workflowsPath: require.resolve('./workflows/searchProtocol'),
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
