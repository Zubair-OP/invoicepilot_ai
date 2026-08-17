import Groq from "groq-sdk";
import { z } from "zod";
import { env } from "../../config/env.js";
import { Customer, User, AiUsage } from "../../database/models/index.js";
import type { AiUsageKind } from "../../database/models/AiUsage.js";
import { ServiceUnavailableError, RateLimitError, ValidationError } from "../../common/errors/index.js";
import { incrementRateLimit } from "../../common/cache/redis.js";
import { buildSystemPrompt, buildUserPrompt } from "./ai.prompts.js";
import { aiInvoiceOutputSchema, type AiInvoiceOutput, type GenerateInvoiceInput, type ChatInput } from "./ai.validation.js";
import { logger } from "../../observability/logger.js";
import type { ITaxComponent } from "../../common/types/index.js";
import { escapeRegex } from "../../common/utils/regex.js";
import { recordUsage } from "../billing/index.js";

const groq = env.GROQ_API_KEY ? new Groq({ apiKey: env.GROQ_API_KEY }) : null;

let cachedModels: string[] = [];
let lastFetchedTime = 0;

async function getCandidateModels(): Promise<string[]> {
  const models = new Set<string>();
  if (env.GROQ_MODEL) {
    models.add(env.GROQ_MODEL);
  }

  const now = Date.now();
  if (groq && (cachedModels.length === 0 || now - lastFetchedTime > 3600000)) {
    try {
      const res = await groq.models.list();
      if (res && Array.isArray(res.data)) {
        const textModels = res.data
          .filter((m: any) => m.active !== false && !m.id.includes("whisper") && !m.id.includes("tts") && !m.id.includes("guard"))
          .map((m: any) => m.id);
        if (textModels.length > 0) {
          cachedModels = textModels;
          lastFetchedTime = now;
          logger.info({ activeGroqModels: cachedModels }, "Discovered active Groq models dynamically");
        }
      }
    } catch (err: any) {
      logger.warn({ err: err?.message }, "Failed to dynamically query Groq models list, using fallbacks");
    }
  }

  for (const m of cachedModels) {
    models.add(m);
  }

  const staticFallbacks = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768",
    "gemma2-9b-it",
    "qwen-2.5-32b",
    "deepseek-r1-distill-llama-70b",
  ];
  for (const m of staticFallbacks) {
    models.add(m);
  }

  return Array.from(models);
}

async function createCompletionWithFallback(
  params: Omit<Groq.Chat.Completions.CompletionCreateParamsNonStreaming, "model">,
  options?: { signal?: AbortSignal }
) {
  if (!groq) {
    throw new ServiceUnavailableError("AI generation unavailable (GROQ_API_KEY not set)");
  }

  const candidateModels = await getCandidateModels();
  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      return await groq.chat.completions.create(
        { ...params, model },
        options
      );
    } catch (err: any) {
      lastError = err;
      const errMsg = String(err?.message || "").toLowerCase();
      const isUnavailable =
        err?.status === 404 ||
        err?.status === 400 ||
        errMsg.includes("model_not_found") ||
        errMsg.includes("does not exist") ||
        errMsg.includes("decommissioned") ||
        errMsg.includes("deprecated") ||
        errMsg.includes("do not have access");

      if (isUnavailable) {
        logger.warn({ model, error: err?.message }, "Groq model unavailable, trying fallback model");
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

interface InvoiceDraft {
  customerId?: string;
  suggestedCustomer?: { name: string };
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
  currency?: string;
  taxComponents?: ITaxComponent[];
  discount?: number;
  dueDate?: string;
  notes?: string;
}

/**
 * Generates a structured invoice draft from a plain-language description. Returns
 * a draft object; the caller reviews and then calls POST /invoices to persist.
 * This keeps AI out of the write path — a bad generation costs nothing.
 */
export async function generateInvoice(
  userId: string,
  input: GenerateInvoiceInput
): Promise<InvoiceDraft> {
  // Guard: missing API key → clear 503, not a crash.
  if (!groq) {
    throw new ServiceUnavailableError("AI generation unavailable (GROQ_API_KEY not set)");
  }

  // Guard: rate limit per userId (not IP — IP limits are trivially shared and don't
  // map to cost). 10 requests/hour. Fails open when Redis is down (a cache outage
  // must not block legitimate work).
  const rateLimit = await incrementRateLimit(`ai:generate:${userId}`, 10, 3600);
  if (!rateLimit.allowed) {
    throw new RateLimitError(`AI generation limit exceeded (${rateLimit.limit}/hour)`);
  }

  // Load the tenant's settings and inject them as context so output matches their
  // business defaults: currency, tax structure, payment terms.
  const user = await User.findOne({ _id: userId, deletedAt: { $exists: false } })
    .select("settings")
    .lean();
  const settings = user?.settings ?? {
    defaultCurrency: "USD",
    defaultPaymentTermsDays: 30,
    defaultTaxComponents: [] as ITaxComponent[],
    invoicePrefix: "INV",
    templateId: "classic",
  };

  const systemPrompt = buildSystemPrompt(settings);
  const userPrompt = buildUserPrompt(input.prompt);

  // Guard: request timeout (~30s) so a hung upstream can't pin a connection.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    // Structured output: Groq JSON mode ensures parseable JSON. The response is
    // still validated through Zod — never trust raw model output.
    const response = await createCompletionWithFallback(
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000,
        temperature: 0.2,
      },
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      throw new ServiceUnavailableError("AI returned no content");
    }

    // Log token usage for cost tracking.
    logger.info(
      {
        userId,
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens,
      },
      "AI invoice generation"
    );

    // Parse + validate. On failure, retry once with the validation error appended
    // to the prompt, then fail cleanly with a 422 — never return unvalidated output.
    const draft = await parseAndValidate(rawContent, userId, settings, systemPrompt, userPrompt, controller);
    // Best-effort: consume one unit of the tenant's monthly AI quota, and append
    // a durable row for the admin AI-usage analytics.
    await recordUsage("aiGenerationsPerMonth", userId);
    await recordAiUsage(userId, "generate");
    return draft;
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === "AbortError") {
      throw new ServiceUnavailableError("AI request timeout");
    }
    throw error;
  }
}

async function parseAndValidate(
  rawContent: string,
  userId: string,
  settings: { defaultCurrency: string; defaultTaxComponents: ITaxComponent[] },
  systemPrompt: string,
  userPrompt: string,
  controller: AbortController
): Promise<InvoiceDraft> {
  try {
    const parsed: unknown = JSON.parse(rawContent);
    const validated = aiInvoiceOutputSchema.parse(parsed);
    return await buildDraft(userId, validated, settings);
  } catch (error) {
    // Retry once with the validation error appended.
    if (error instanceof z.ZodError) {
      const errorSummary = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      const retryPrompt = `${userPrompt}\n\nThe previous response failed validation: ${errorSummary}. Please correct and return valid JSON.`;

      try {
        const retryResponse = await createCompletionWithFallback(
          {
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: retryPrompt },
            ],
            response_format: { type: "json_object" },
            max_tokens: 1000,
            temperature: 0.2,
          },
          { signal: controller.signal }
        );

        const retryContent = retryResponse.choices[0]?.message?.content;
        if (!retryContent) throw new ServiceUnavailableError("AI retry returned no content");

        const retryParsed: unknown = JSON.parse(retryContent);
        const retryValidated = aiInvoiceOutputSchema.parse(retryParsed);
        return await buildDraft(userId, retryValidated, settings);
      } catch (retryError) {
        // Second failure → fail cleanly with a 422.
        logger.warn({ userId, error: retryError }, "AI invoice validation failed after retry");
        throw new ValidationError({ prompt: ["AI could not generate valid invoice data"] });
      }
    }
    throw error;
  }
}

/**
 * Builds the draft from validated AI output. Fuzzy-matches the customer name
 * against existing customers; returns either a matched customerId or a
 * suggestedCustomer for the client to confirm. Never auto-creates a customer.
 *
 * The AI proposes name/rate for tax components; the server recomputes every
 * amount with computeTotals() — the model must never determine money.
 */
async function buildDraft(
  userId: string,
  output: AiInvoiceOutput,
  settings: { defaultCurrency: string; defaultTaxComponents: ITaxComponent[] }
): Promise<InvoiceDraft> {
  const { customerName, items, currency, taxComponents, discount, dueDate, notes } = output;

  // Customer resolution: match case-insensitive exact, then fallback to partial substring match
  let customer = await Customer.findOne({
    userId,
    name: { $regex: new RegExp(`^${escapeRegex(customerName)}$`, "i") },
  })
    .select("_id name")
    .lean();

  if (!customer && customerName.trim()) {
    customer = await Customer.findOne({
      userId,
      name: { $regex: escapeRegex(customerName.trim()), $options: "i" },
    })
      .select("_id name")
      .lean();
  }

  return {
    customerId: customer?._id.toString(),
    suggestedCustomer: customer ? undefined : { name: customerName },
    items,
    currency: currency ?? settings.defaultCurrency,
    // The AI proposes name/rate; amount is 0 and will be recomputed in the invoice
    // service's computeTotals(). Never trust AI-supplied amounts.
    taxComponents: taxComponents?.map((tc) => ({ ...tc, amount: 0 })) ?? settings.defaultTaxComponents,
    discount: discount ?? 0,
    dueDate,
    notes,
  };
}

/**
 * Multi-turn refinement chat. Shares the same guard rails as generation: 503 on
 * missing key, per-user rate limit, request timeout. Returns the assistant's
 * reply text — the client drives when to finalize into a draft via generateInvoice.
 */
export async function chat(userId: string, input: ChatInput): Promise<{ reply: string }> {
  if (!groq) {
    throw new ServiceUnavailableError("AI generation unavailable (GROQ_API_KEY not set)");
  }

  const rateLimit = await incrementRateLimit(`ai:generate:${userId}`, 10, 3600);
  if (!rateLimit.allowed) {
    throw new RateLimitError(`AI generation limit exceeded (${rateLimit.limit}/hour)`);
  }

  const user = await User.findOne({ _id: userId, deletedAt: { $exists: false } })
    .select("settings")
    .lean();
  const settings = user?.settings ?? {
    defaultCurrency: "USD",
    defaultPaymentTermsDays: 30,
    defaultTaxComponents: [] as ITaxComponent[],
    invoicePrefix: "INV",
    templateId: "classic",
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await createCompletionWithFallback(
      {
        messages: [
          { role: "system", content: buildSystemPrompt(settings) },
          ...input.messages,
        ],
        max_tokens: 1000,
        temperature: 0.3,
      },
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    logger.info(
      { userId, totalTokens: response.usage?.total_tokens },
      "AI invoice chat"
    );

    // Best-effort: consume one unit of the tenant's monthly AI quota, and append
    // a durable row for the admin AI-usage analytics.
    await recordUsage("aiGenerationsPerMonth", userId);
    await recordAiUsage(userId, "chat");

    return { reply: response.choices[0]?.message?.content ?? "" };
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === "AbortError") {
      throw new ServiceUnavailableError("AI request timeout");
    }
    throw error;
  }
}

/**
 * Appends a durable AI-usage row for the admin analytics. Best-effort — a
 * logging failure must never fail the generation that already succeeded.
 */
async function recordAiUsage(userId: string, kind: AiUsageKind): Promise<void> {
  try {
    await AiUsage.create({ userId, kind });
  } catch (error) {
    logger.warn({ err: error, userId, kind }, "Failed to record AI usage analytics");
  }
}
