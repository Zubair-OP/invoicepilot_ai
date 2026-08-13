import mongoose, { Schema, Document } from "mongoose";
import type { IUser, IUserSettings, ITaxComponent, IReminderSettings, IUserSubscription } from "../../common/types/index.js";

export type UserDocument = IUser & Document;

// Default tax components pre-fill new invoices; amount is recomputed at invoice
// creation, so it is stored here as 0 and never trusted as a monetary figure.
const settingsTaxComponentSchema = new Schema<ITaxComponent>(
  {
    name: { type: String, required: true, trim: true },
    rate: { type: Number, required: true, min: 0, max: 100 },
    amount: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

// Dunning schedule. `offsets` are whole days relative to an invoice's `dueDate`:
// negative = before due (upcoming reminder), positive = after due (overdue).
// Defaults fire 3 days before, then 1, 7, and 14 days past due. `enabled: false`
// pauses all automated reminders for the tenant (manual sends still work).
const reminderSettingsSchema = new Schema<IReminderSettings>(
  {
    enabled: { type: Boolean, default: true },
    offsets: { type: [Number], default: [-3, 1, 7, 14] },
  },
  { _id: false }
);

// Per-tenant business defaults + invoice appearance. Stored as a subdocument so a
// user always has a populated `settings` object (via schema defaults) rather than
// each call site having to null-check individual fields.
const settingsSchema = new Schema<IUserSettings>(
  {
    businessName: { type: String, trim: true },
    businessEmail: { type: String, trim: true, lowercase: true },
    businessPhone: { type: String, trim: true },
    businessAddress: { type: String, trim: true },
    taxId: { type: String, trim: true },
    logoUrl: { type: String, trim: true },
    defaultCurrency: { type: String, default: "USD", uppercase: true, trim: true },
    defaultPaymentTermsDays: { type: Number, default: 30, min: 0 },
    defaultTaxComponents: { type: [settingsTaxComponentSchema], default: [] },
    invoicePrefix: { type: String, default: "INV", uppercase: true, trim: true },
    templateId: { type: String, default: "classic", trim: true },
    customSmtp: {
      host: { type: String, trim: true },
      port: { type: Number },
      user: { type: String, trim: true },
      pass: { type: String, trim: true },
    },
    reminders: { type: reminderSettingsSchema, default: () => ({}) },
  },
  { _id: false }
);

// Billing state (Phase 8). Defaults to the free plan; `currentPeriodStart` is set
// from Stripe so usage counts run on the subscription period, not the calendar
// month. Default status is "active" so a brand-new free account is never blocked.
const subscriptionSchema = new Schema<IUserSubscription>(
  {
    planKey: { type: String, enum: ["free", "pro", "premium"], default: "free" },
    stripeCustomerId: { type: String, trim: true },
    stripeSubscriptionId: { type: String, trim: true },
    status: { type: String, enum: ["active", "past_due", "canceled", "trialing"], default: "active" },
    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date },
  },
  { _id: false }
);

const userSchema = new Schema<UserDocument>(
  {
    clerkId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    company: { type: String, trim: true },
    avatar: { type: String },
    role: { type: String, enum: ["USER", "ADMIN"], default: "USER" },
    settings: { type: settingsSchema, default: () => ({}) },
    subscription: { type: subscriptionSchema, default: () => ({}) },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);


export const User = mongoose.model<UserDocument>("User", userSchema);
