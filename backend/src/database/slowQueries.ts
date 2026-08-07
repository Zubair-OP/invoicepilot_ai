import mongoose from "mongoose";
import type { CommandStartedEvent, CommandSucceededEvent, CommandFailedEvent } from "mongodb";
import { logger } from "../observability/logger.js";
import { env } from "../config/env.js";

/**
 * Logs database commands that exceed `SLOW_QUERY_MS`.
 *
 * Uses the MongoDB driver's command-monitoring events (only fire when
 * `monitorCommands: true` is passed to `connectDatabase`), measuring elapsed
 * time per command by requestId. This avoids per-query Mongoose hooks and stays
 * accurate for every CRUD + aggregation command in one place.
 */
const TRACKED_COMMANDS = new Set([
  "find",
  "aggregate",
  "count",
  "update",
  "delete",
  "insert",
  "getMore",
]);

const startedAt = new Map<number, number>();

export function enableSlowQueryLogging(): void {
  const client = mongoose.connection.getClient();

  client.on("commandStarted", (event: CommandStartedEvent) => {
    if (TRACKED_COMMANDS.has(event.commandName)) {
      startedAt.set(event.requestId, Date.now());
    }
  });

  client.on("commandSucceeded", (event: CommandSucceededEvent) => {
    const begin = startedAt.get(event.requestId);
    if (begin === undefined) return;
    startedAt.delete(event.requestId);

    const durationMs = Date.now() - begin;
    if (durationMs >= env.SLOW_QUERY_MS) {
      logger.warn(
        { command: event.commandName, durationMs, db: event.databaseName },
        "Slow database query"
      );
    }
  });

  client.on("commandFailed", (event: CommandFailedEvent) => {
    startedAt.delete(event.requestId);
  });
}
