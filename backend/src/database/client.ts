import mongoose from "mongoose";
import { env } from "../config/env.js";

export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(env.MONGO_URI);
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
