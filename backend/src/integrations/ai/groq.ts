import Groq from "groq-sdk";
import { env } from "../../config/env.js";

export const groq = env.GROQ_API_KEY ? new Groq({ apiKey: env.GROQ_API_KEY }) : null;

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
        }
      }
    } catch {
      // ignore
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
  messages: Groq.Chat.Completions.ChatCompletionMessageParam[],
  options: { max_tokens?: number; temperature?: number } = {}
) {
  if (!groq) return null;
  const candidateModels = await getCandidateModels();
  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      return await groq.chat.completions.create({
        model,
        messages,
        ...options,
      });
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
        continue;
      }
      throw err;
    }
  }
  if (lastError) throw lastError;
  return null;
}

export async function generateInvoiceDescription(itemName: string): Promise<string> {
  if (!groq) return itemName;

  const response = await createCompletionWithFallback(
    [
      { role: "system", content: "You are a professional invoice assistant. Generate clear, professional service/product descriptions for invoices. Keep descriptions concise and business-appropriate." },
      { role: "user", content: `Generate a professional invoice description for: ${itemName}` },
    ],
    { max_tokens: 100, temperature: 0.7 }
  );

  return response?.choices[0]?.message?.content || itemName;
}

export async function categorizeExpense(description: string): Promise<string> {
  if (!groq) return "General";

  const response = await createCompletionWithFallback(
    [
      { role: "system", content: "Categorize business expenses into one of: Software, Marketing, Operations, Travel, Professional Services, Office, Utilities, Other. Reply with only the category name." },
      { role: "user", content: description },
    ],
    { max_tokens: 20, temperature: 0 }
  );

  return response?.choices[0]?.message?.content?.trim() || "Other";
}
