import Groq from "groq-sdk";
import { env } from "../../config/env.js";

export const groq = env.GROQ_API_KEY ? new Groq({ apiKey: env.GROQ_API_KEY }) : null;

export async function generateInvoiceDescription(itemName: string): Promise<string> {
  if (!groq) return itemName;

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: "You are a professional invoice assistant. Generate clear, professional service/product descriptions for invoices. Keep descriptions concise and business-appropriate." },
      { role: "user", content: `Generate a professional invoice description for: ${itemName}` },
    ],
    max_tokens: 100,
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content || itemName;
}

export async function categorizeExpense(description: string): Promise<string> {
  if (!groq) return "General";

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: "Categorize business expenses into one of: Software, Marketing, Operations, Travel, Professional Services, Office, Utilities, Other. Reply with only the category name." },
      { role: "user", content: description },
    ],
    max_tokens: 20,
    temperature: 0,
  });

  return response.choices[0]?.message?.content?.trim() || "Other";
}
