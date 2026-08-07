import pino from "pino";
import { env } from "../config/env.js";
import { logContext } from "./context.js";

/**
 * Redact secrets at the serializer boundary so they can never reach a log line,
 * regardless of which caller logs them. Paths cover the common locations:
 * request headers (via `pino.stdSerializers.req`), cookies, and nested API
 * keys / tokens / secrets / passwords.
 */
const REDACT_PATHS = [
  "authorization",
  "cookie",
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers.set-cookie",
  "*.apiKey",
  "*.api_key",
  "*.token",
  "*.accessToken",
  "*.refreshToken",
  "*.secret",
  "*.clientSecret",
  "*.password",
  "*.passwordHash",
  "password",
];

export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss" } }
      : undefined,
  // Pull the correlation id out of the AsyncLocalStorage context so every log
  // line inside a request or job carries it automatically.
  mixin() {
    const context = logContext.getStore();
    return context && Object.keys(context).length > 0 ? { ...context } : {};
  },
  redact: {
    paths: REDACT_PATHS,
    censor: "[REDACTED]",
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

export function createContextLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
