import mongoose from "mongoose";
import { env } from "../config/env.js";

export async function connectDatabase(): Promise<void> {
  try {
    // `monitorCommands: true` enables the driver's command events, which the
    // slow-query logger in `database/slowQueries.ts` listens to. Slight per
    // command overhead, needed for the Phase 10 observability requirement.
    await mongoose.connect(env.MONGO_URI, { monitorCommands: true });
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  }

  mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected");
  });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
