import mongoose, { Schema, Document } from "mongoose";
import type { IUser } from "../../common/types/index.js";

export type UserDocument = IUser & Document;

const userSchema = new Schema<UserDocument>(
  {
    clerkId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    company: { type: String, trim: true },
    avatar: { type: String },
    role: { type: String, enum: ["USER", "ADMIN"], default: "USER" },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);


export const User = mongoose.model<UserDocument>("User", userSchema);
