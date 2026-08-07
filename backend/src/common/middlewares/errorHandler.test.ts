import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "./errorHandler.js";

// The error handler's only env dependency is NODE_ENV — force production to
// prove internals never leak, and toggle it for the dev branch.
const envState = vi.hoisted(() => ({ NODE_ENV: "production" }));
vi.mock("../../config/env.js", () => ({ env: envState }));
vi.mock("../../observability/logger.js", () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}));

import { NotFoundError } from "../errors/index.js";

function makeRes() {
  const res = { status: vi.fn() };
  (res.status as ReturnType<typeof vi.fn>).mockReturnValue(res);
  (res as unknown as { json: ReturnType<typeof vi.fn> }).json = vi.fn();
  return res as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

const req = { id: "req_1" } as Request;
const next: NextFunction = vi.fn();

describe("errorHandler", () => {
  beforeEach(() => {
    envState.NODE_ENV = "production";
  });

  it("returns AppError details unchanged (client-safe by construction)", () => {
    const res = makeRes();
    errorHandler(new NotFoundError("Invoice"), req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, code: "NOT_FOUND" }));
  });

  it("leaks nothing for a non-AppError in production", () => {
    envState.NODE_ENV = "production";
    const res = makeRes();
    errorHandler(new Error("connection string=mongodb+srv://user:secret@host && password=hunter2"), req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0] as { message: string };
    expect(body.message).toBe("Internal server error");
    expect(JSON.stringify(body)).not.toMatch(/hunter2|secret|mongodb/);
  });

  it("does not crash when a handler throws a non-Error value", () => {
    const res = makeRes();
    errorHandler("boom" as unknown as Error, req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0]).toMatchObject({ message: "Internal server error" });
  });

  it("reveals the message in development only (never a stack)", () => {
    envState.NODE_ENV = "development";
    const res = makeRes();
    errorHandler(new Error("index.js:42 detail"), req, res, next);
    const body = res.json.mock.calls[0][0] as { message: string };
    expect(body.message).toBe("index.js:42 detail");
  });
});
