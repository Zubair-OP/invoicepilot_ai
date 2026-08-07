import mongoose, { Schema, Document } from "mongoose";

export type AiUsageKind = "generate" | "chat";

// Durable audit trail for AI usage. The plan-limit counter for AI lives in a
// short-TTL Redis counter (billing.limits) because enforcement only needs a
// rough current-period count. Admin analytics needs history, so every successful
// generation/chat also appends one lightweight row here (best-effort, never fails
// the request).
export interface IAiUsage {
  userId: mongoose.Types.ObjectId;
  kind: AiUsageKind;
  createdAt: Date;
}

export type AiUsageDocument = IAiUsage & Document;

const aiUsageSchema = new Schema<AiUsageDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, enum: ["generate", "chat"], required: true },
  },
  { timestamps: true }
);

// Drives the admin "AI usage over time" aggregation.
aiUsageSchema.index({ createdAt: -1 });

// Supports future per-user AI history and per-tenant cost tracking.
aiUsageSchema.index({ userId: 1, createdAt: -1 });

export const AiUsage = mongoose.model<AiUsageDocument>("AiUsage", aiUsageSchema);
