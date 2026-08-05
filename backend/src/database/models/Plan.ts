import mongoose, { Schema, Document } from "mongoose";
import type { PlanKey } from "../../common/types/index.js";

export interface IPlanLimits {
  invoicesPerMonth: number;      // -1 = unlimited
  customers: number;             // -1 = unlimited
  aiGenerationsPerMonth: number; // -1 = unlimited
  templatesAllowed: string[];    // template ids from the Phase 3 registry
}

export interface IPlan {
  _id: mongoose.Types.ObjectId;
  key: PlanKey;
  name: string;
  stripePriceId?: string;        // set from the operator's Stripe account
  limits: IPlanLimits;
  priceMonthly: number;
  createdAt: Date;
  updatedAt: Date;
}

export type PlanDocument = IPlan & Document;

const planSchema = new Schema<PlanDocument>(
  {
    key: { type: String, enum: ["free", "pro", "business"], required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    stripePriceId: { type: String, trim: true },
    limits: {
      invoicesPerMonth: { type: Number, required: true },
      customers: { type: Number, required: true },
      aiGenerationsPerMonth: { type: Number, required: true },
      templatesAllowed: { type: [String], default: [] },
    },
    priceMonthly: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

export const Plan = mongoose.model<PlanDocument>("Plan", planSchema);
