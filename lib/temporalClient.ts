// lib/temporalClient.ts — Shared Temporal connection helpers
//
// Builds a `ConnectionOptions` object suitable for both `@temporalio/client`
// (used from Next.js API routes) and, in a slightly different shape, for
// `@temporalio/worker`'s `NativeConnection`. Centralising the logic means
// we only have one place to reason about Temporal Cloud auth modes:
//
//   1. TEMPORAL_API_KEY set  → Bearer auth over TLS, namespace via metadata
//      (preferred for Temporal Cloud, works with the regional gRPC endpoint).
//   2. TEMPORAL_TLS_CERT+KEY → mTLS with a client cert (legacy Cloud auth).
//   3. Neither                → plaintext connection (local dev / self-host).
//
// Callers still create the `Connection` / `Client` themselves so they retain
// full control over lifetime (routes generally connect once per request and
// let the process exit close things down).

import type { ConnectionOptions as ClientConnectionOptions } from "@temporalio/client";

export const DEFAULT_TEMPORAL_ADDRESS = "localhost:7233";
export const DEFAULT_TEMPORAL_NAMESPACE = "default";
export const DEFAULT_TEMPORAL_TASK_QUEUE = "meowtrix-search-protocol";

/**
 * Read the Temporal server address from `TEMPORAL_ADDRESS`, falling back to
 * `localhost:7233` for local development.
 */
export function getTemporalAddress(): string {
  return process.env.TEMPORAL_ADDRESS ?? DEFAULT_TEMPORAL_ADDRESS;
}

/**
 * Read the Temporal namespace from `TEMPORAL_NAMESPACE`, falling back to
 * `default`.
 */
export function getTemporalNamespace(): string {
  return process.env.TEMPORAL_NAMESPACE ?? DEFAULT_TEMPORAL_NAMESPACE;
}

/**
 * Read the Temporal task queue from `TEMPORAL_TASK_QUEUE`, falling back to
 * the shared default.
 */
export function getTemporalTaskQueue(): string {
  return process.env.TEMPORAL_TASK_QUEUE ?? DEFAULT_TEMPORAL_TASK_QUEUE;
}

/**
 * Return `true` if any Temporal connection info is configured. Used by API
 * routes to short-circuit when Temporal is intentionally disabled (e.g. on
 * PR previews without a Cloud connection).
 */
export function isTemporalConfigured(): boolean {
  return Boolean(process.env.TEMPORAL_ADDRESS);
}

/**
 * Build the shared connection option shape used by both the client SDK and
 * the native worker connection. The two SDKs happen to accept the same field
 * names (`address`, `tls`, `apiKey`, `metadata`), so we return a single
 * object and each caller narrows it to its own type.
 */
interface SharedTemporalConnectionOptions {
  address: string;
  tls?: ClientConnectionOptions["tls"];
  apiKey?: string;
  metadata?: Record<string, string>;
}

function buildSharedConnectionOptions(): SharedTemporalConnectionOptions {
  const address = getTemporalAddress();
  const namespace = getTemporalNamespace();
  const { TEMPORAL_API_KEY, TEMPORAL_TLS_CERT, TEMPORAL_TLS_KEY } = process.env;

  const options: SharedTemporalConnectionOptions = { address };

  if (TEMPORAL_API_KEY) {
    // API-key auth: TLS + Bearer + namespace header. Temporal Cloud rejects
    // the request without the `temporal-namespace` metadata entry.
    options.tls = true;
    options.apiKey = TEMPORAL_API_KEY;
    options.metadata = { "temporal-namespace": namespace };
  } else if (TEMPORAL_TLS_CERT && TEMPORAL_TLS_KEY) {
    options.tls = {
      clientCertPair: {
        crt: Buffer.from(TEMPORAL_TLS_CERT),
        key: Buffer.from(TEMPORAL_TLS_KEY),
      },
    };
  }

  return options;
}

/**
 * Options for `@temporalio/client`'s `Connection.connect(...)`.
 *
 * Use from Next.js API routes:
 *
 *   const connection = await Connection.connect(getClientConnectionOptions());
 *   const client = new Client({ connection, namespace: getTemporalNamespace() });
 */
export function getClientConnectionOptions(): ClientConnectionOptions {
  return buildSharedConnectionOptions() as ClientConnectionOptions;
}

/**
 * Options for `@temporalio/worker`'s `NativeConnection.connect(...)`.
 *
 * The worker's `NativeConnectionOptions` uses the same field names as the
 * client's `ConnectionOptions` for the fields we care about, so we return the
 * same shape. The worker's `tls` type is slightly narrower (no `serverName`
 * or `serverRootCACertificate` on some paths), but everything we set here is
 * within that narrower type.
 */
export function getWorkerConnectionOptions(): {
  address: string;
  tls?: true | { clientCertPair: { crt: Buffer; key: Buffer } };
  apiKey?: string;
  metadata?: Record<string, string>;
} {
  return buildSharedConnectionOptions() as ReturnType<
    typeof getWorkerConnectionOptions
  >;
}
