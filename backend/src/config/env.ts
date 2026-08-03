import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  API_PREFIX: z.string().default("/api/v1"),
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

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("InvoicePilot <onboarding@resend.dev>"),

  MAX_FILE_SIZE_MB: z.coerce.number().default(10),

  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
