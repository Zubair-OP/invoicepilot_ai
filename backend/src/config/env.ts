import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  API_PREFIX: z.string().default("/api/v1"),
  // Comma-separated allow-list of frontend origins. In production this must be
  // an explicit list — never `*` — because credentials are enabled (a wildcard
  // origin + credentials is rejected by browsers anyway, and `*` would let any
  // site call the API with a stolen token). A wildcard is rejected below, after
  // parsing, when NODE_ENV is production.
  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  MONGO_URI: z.string().default("mongodb://localhost:27017/invoicepilot"),

  // The only Clerk credential the backend actually uses: it verifies session
  // tokens and authenticates Backend API calls.
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
  // Frontend-only credential — the browser SDK uses it to identify the Clerk
  // instance. Optional here so the API can run before a frontend exists.
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  // Only needed once Clerk webhooks are wired up (Phase 2).
  CLERK_WEBHOOK_SECRET: z.string().optional(),

  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),

  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),

  RESEND_API_KEY: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().default("http://localhost:3000/api/v1/integrations/google/callback"),

  // Nodemailer / SMTP credentials (used instead of Resend when set)
  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  ADMIN_EMAILS: z.string().optional(),

  MAX_FILE_SIZE_MB: z.coerce.number().default(10),

  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  // JSON body size cap. No client uploads exist yet (PDFs are generated
  // server-side and attached to emails, never uploaded), so 1mb comfortably
  // fits every request shape.
  BODY_SIZE_LIMIT: z.string().default("1mb"),

  // Thresholds for the slow request / slow query warn logs (ms).
  SLOW_REQUEST_MS: z.coerce.number().default(1000),
  SLOW_QUERY_MS: z.coerce.number().default(1000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

if (parsed.data.NODE_ENV === "production" && parsed.data.CORS_ORIGIN.split(",").some((origin) => origin.trim() === "*")) {
  console.error("Invalid environment variables: CORS_ORIGIN cannot be '*' in production with credentials enabled");
  process.exit(1);
}

export const env = parsed.data;
