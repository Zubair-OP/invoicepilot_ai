import { logger } from "./logger.js";

/**
 * Installs handlers for process-level failures. An unhandled rejection or
 * exception leaves the process in an undefined state, so the correct behaviour
 * is to log the cause then exit(1), letting the supervisor (systemd, Docker,
 * Railway/Render/Fly) restart a fresh process. Never attempt to "continue"
 * after one of these — a half-finished request/transaction may already be
 * corrupt.
 */
export function installProcessErrorHandlers(): void {
  process.on("unhandledRejection", (reason: unknown) => {
    logger.fatal({ err: reason }, "Unhandled promise rejection — exiting");
    process.exit(1);
  });

  process.on("uncaughtException", (error: Error) => {
    logger.fatal({ err: error }, "Uncaught exception — exiting");
    process.exit(1);
  });
}
