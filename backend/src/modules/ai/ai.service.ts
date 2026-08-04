import Groq from "groq-sdk";
import { z } from "zod";
import { env } from "../../config/env.js";
import { Customer, User } from "../../database/models/index.js";
import { ServiceUnavailableError, RateLimitError, ValidationError } from "../../common/errors/index.js";
import { incrementRateLimit } from "../../common/cache/redis.js";
import { buildSystemPrompt, buildUserPrompt } from "./ai.prompts.js";
import { aiInvoiceOutputSchema, type AiInvoiceOutput, type GenerateInvoiceInput, type ChatInput } from "./ai.validation.js";
import { logger } from "../../observability/logger.js";
import type { ITaxComponent } from "../../common/types/index.js";

const groq = env.GROQ_API_KEY ? new Groq({ apiKey: env.GROQ_API_KEY }) : null;

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
    const response = await groq.chat.completions.create(
      {
        model: "llama-3.3-70b-versatile",
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
    return await parseAndValidate(rawContent, userId, settings, systemPrompt, userPrompt, controller);
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
        const retryResponse = await groq!.chat.completions.create(
          {
            model: "llama-3.3-70b-versatile",
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

  // Customer resolution: fuzzy-match (case-insensitive) against existing customers
  // scoped by userId. Return matched customerId or a suggestedCustomer.
  const customer = await Customer.findOne({
    userId,
    name: { $regex: new RegExp(`^${escapeRegex(customerName)}$`, "i") },
  })
    .select("_id name")
    .lean();

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

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
    const response = await groq.chat.completions.create(
      {
        model: "llama-3.3-70b-versatile",
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

    return { reply: response.choices[0]?.message?.content ?? "" };
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === "AbortError") {
      throw new ServiceUnavailableError("AI request timeout");
    }
    throw error;
  }
}
