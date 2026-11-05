import { describe, expect, it, mock } from "bun:test";
import { withRetry } from "./with-retry";

// Tiny delays so the suite runs fast — these tests cover the attempt
// counting and the retry/no-retry decision, not real wall-clock backoff.
const FAST = { baseDelayMs: 1, multiplier: 1, jitterRatio: 0 };

describe("withRetry", () => {
  it("returns the result without retrying when the first attempt succeeds", async () => {
    const fn = mock(async () => "ok");

    const result = await withRetry(fn, { ...FAST, isRetryable: () => true });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries a retryable error and then succeeds", async () => {
    let calls = 0;
    const fn = mock(async () => {
      calls++;
      if (calls < 3) throw { status: 503 };
      return "ok";
    });

    const result = await withRetry(fn, {
      ...FAST,
      maxAttempts: 5,
      isRetryable: (e) => (e as { status?: number })?.status === 503,
    });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry a non-retryable error even if attempts remain", async () => {
    const fn = mock(async () => {
      throw { status: 400 };
    });

    await expect(
      withRetry(fn, {
        ...FAST,
        maxAttempts: 5,
        isRetryable: (e) => (e as { status?: number })?.status === 503,
      }),
    ).rejects.toEqual({ status: 400 });

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("rethrows the last original error when attempts run out", async () => {
    const finalError = { status: 503, message: "still unavailable" };
    const fn = mock(async () => {
      throw finalError;
    });

    await expect(
      withRetry(fn, { ...FAST, maxAttempts: 3, isRetryable: () => true }),
    ).rejects.toBe(finalError);

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("calls onRetry with the failed attempt number before each wait", async () => {
    let calls = 0;
    const fn = mock(async () => {
      calls++;
      if (calls < 3) throw { status: 429 };
      return "ok";
    });
    const onRetry = mock((_attempt: number, _delay: number, _err: unknown) => {});

    await withRetry(fn, {
      ...FAST,
      maxAttempts: 4,
      isRetryable: () => true,
      onRetry,
    });

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry.mock.calls[0]?.[0]).toBe(1);
    expect(onRetry.mock.calls[1]?.[0]).toBe(2);
  });

  it("applies exponential growth to the delay", async () => {
    const delays: number[] = [];
    const fn = mock(async () => {
      throw { status: 503 };
    });

    await withRetry(fn, {
      baseDelayMs: 1,
      multiplier: 4,
      jitterRatio: 0,
      maxAttempts: 4,
      isRetryable: () => true,
      onRetry: (_attempt, delayMs) => delays.push(delayMs),
    }).catch(() => {});

    expect(delays).toEqual([1, 4, 16]);
  });
});
