import mongoose, { Schema, Document } from "mongoose";
import type { ICustomer } from "../../common/types/index.js";

export type CustomerDocument = ICustomer & Document;

const customerSchema = new Schema<CustomerDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    taxId: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);


export const Customer = mongoose.model<CustomerDocument>("Customer", customerSchema);
