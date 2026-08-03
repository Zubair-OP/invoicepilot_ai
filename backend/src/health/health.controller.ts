import { Request, Response } from "express";
import mongoose from "mongoose";

export async function healthCheck(_req: Request, res: Response) {
  const checks: Record<string, string> = {};

  try {
    const state = mongoose.connection.readyState;
    checks.database = state === 1 ? "ok" : "error";
  } catch {
    checks.database = "error";
  }

  const status = Object.values(checks).every((s) => s === "ok") ? "healthy" : "degraded";

  res.status(status === "healthy" ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks,
  });
}
