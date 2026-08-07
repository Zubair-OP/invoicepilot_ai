import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { validateObjectId } from "./objectId.js";
import { BadRequestError } from "../errors/index.js";

function run(params: Record<string, string>): { next: ReturnType<typeof vi.fn>; error: () => unknown } {
  const req = { params } as unknown as Request;
  const next = vi.fn() as unknown as ReturnType<typeof vi.fn>;
  validateObjectId(req, {} as Response, next as unknown as NextFunction);
  return { next, error: () => next.mock.calls[0]?.[0] };
}

describe("validateObjectId", () => {
  it("passes well-formed ObjectIds through", () => {
    const id = new mongoose.Types.ObjectId().toString();
    const { error } = run({ id });
    expect(error()).toBeUndefined();
  });

  it("rejects a malformed :id with a 400 before any query", () => {
    const { error } = run({ id: "not-an-objectid" });
    expect(error()).toBeInstanceOf(BadRequestError);
    expect((error() as BadRequestError).statusCode).toBe(400);
  });

  it("rejects any param that is malformed, not just `id`", () => {
    const { error } = run({ id: new mongoose.Types.ObjectId().toString(), customerId: "nope" });
    expect((error() as BadRequestError).statusCode).toBe(400);
  });
});
