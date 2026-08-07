import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request (and per-job) correlation context.
 *
 * The `requestId` middleware and the BullMQ workers run their work inside this
 * store; the Pino `mixin` in `logger.ts` reads it on every log call so a
 * `requestId` / `jobId` lands on every line without each call site having to
 * pass it explicitly. AsyncLocalStorage follows the promise chain, so logs
 * emitted deep inside services keep their correlation id.
 */
export interface LogContext {
  requestId?: string;
  jobId?: string;
}

export const logContext = new AsyncLocalStorage<LogContext>();

export function runWithLogContext<T>(context: LogContext, fn: () => T): T {
  return logContext.run(context, fn);
}
