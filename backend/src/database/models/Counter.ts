import mongoose, { Schema, Document } from "mongoose";

export interface ICounter {
  _id: string;  // e.g. "invoice:<userId>:2026"
  seq: number;
}

export type CounterDocument = ICounter & Document<string>;

/**
 * Atomic sequence generator.
 *
 * Why this exists: the previous implementation used Math.random() to build
 * invoice numbers, which collides. Two concurrent requests could also read the
 * same "highest existing number" and both write it. A findOneAndUpdate with
 * $inc is atomic at the document level in MongoDB, so each caller is guaranteed
 * a distinct value even under concurrency.
 */
const counterSchema = new Schema<CounterDocument>({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

export const Counter = mongoose.model<CounterDocument>("Counter", counterSchema);

/**
 * Returns the next value in the named sequence, creating it at 1 on first use.
 */
export async function nextSequence(key: string): Promise<number> {
  const counter = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  // `new: true` with `upsert: true` always returns a document; the null branch is
  // unreachable in practice but Mongoose's types allow it.
  if (!counter) {
    throw new Error(`Failed to generate sequence for key: ${key}`);
  }

  return counter.seq;
}
