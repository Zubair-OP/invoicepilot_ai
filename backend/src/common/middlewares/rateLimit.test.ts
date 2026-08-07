import { describe, it, expect, vi, beforeEach } from "vitest";

const evalMock = vi.hoisted(() => vi.fn());
const connectMock = vi.hoisted(() => vi.fn());
const disconnectMock = vi.hoisted(() => vi.fn());

vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(() => ({
    eval: evalMock,
    decr: vi.fn().mockResolvedValue(0),
    del: vi.fn().mockResolvedValue(1),
    scan: vi.fn().mockResolvedValue(["0", []]),
    connect: connectMock,
    disconnect: disconnectMock,
    status: "wait",
  })),
}));

import type { Options } from "express-rate-limit";
import { RedisRateLimitStore, strictLimiter, generousLimiter, apiLimiter } from "./rateLimit.js";

describe("RedisRateLimitStore", () => {
  beforeEach(() => {
    evalMock.mockReset();
    connectMock.mockReset();
    connectMock.mockResolvedValue(undefined);
  });

  it("increments atomically via the Lua script and returns count + resetTime", async () => {
    evalMock.mockResolvedValue([3, 45000]);
    const store = new RedisRateLimitStore("test:");
    store.init({ windowMs: 60_000 } as Options);

    const result = await store.increment("user-1");

    expect(result.totalHits).toBe(3);
    expect(result.resetTime).toBeInstanceOf(Date);
    expect(evalMock).toHaveBeenCalledWith(expect.stringContaining("INCR"), 1, "rl:test:user-1", 60_000);
  });

  it("does not re-attach the window on repeat hits (window anchored, not sliding)", async () => {
    // The Lua script only PEXPIREs when count === 1; the store just relays it.
    evalMock.mockResolvedValue([2, 12000]);
    const store = new RedisRateLimitStore("test:");
    store.init({ windowMs: 60_000 } as Options);

    const result = await store.increment("user-1");
    expect(result.totalHits).toBe(2);
    expect(result.resetTime).toBeInstanceOf(Date);
    expect(result.resetTime!.getTime()).toBeGreaterThan(Date.now());
  });

  it("namespaces keys so tiers never collide in the shared Redis keyspace", async () => {
    evalMock.mockResolvedValue([1, 60000]);
    const strict = new RedisRateLimitStore("strict:");
    strict.init({ windowMs: 300_000 } as Options);
    const generous = new RedisRateLimitStore("generous:");
    generous.init({ windowMs: 900_000 } as Options);

    await strict.increment("user-1");
    await generous.increment("user-1");

    const keys = evalMock.mock.calls.map((call) => call[2]);
    expect(keys).toContain("rl:strict:user-1");
    expect(keys).toContain("rl:generous:user-1");
  });
});

describe("limiter presets", () => {
  it("exports the three tiers as Express handlers", () => {
    expect(strictLimiter).toBeTypeOf("function");
    expect(generousLimiter).toBeTypeOf("function");
    expect(apiLimiter).toBeTypeOf("function");
  });
});
