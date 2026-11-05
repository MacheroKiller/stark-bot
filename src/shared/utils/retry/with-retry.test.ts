import { describe, it, expect, mock } from "bun:test";
import { withRetry } from "./with-retry";

// Delays mínimos para que los tests corran rápido — el comportamiento del
// backoff en sí (fórmula) no se prueba aquí con tiempos reales, solo el
// conteo de intentos y la decisión de reintentar o no.
const FAST = { baseDelayMs: 1, multiplier: 1, jitterRatio: 0 };

describe("withRetry", () => {
  it("retorna el resultado sin reintentar si el primer intento funciona", async () => {
    const fn = mock(async () => "ok");

    const result = await withRetry(fn, { ...FAST, isRetryable: () => true });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("reintenta cuando el error es retryable y luego tiene éxito", async () => {
    let calls = 0;
    const fn = mock(async () => {
      calls++;
      if (calls < 3) throw { status: 503 };
      return "ok";
    });

    const result = await withRetry(fn, {
      ...FAST,
      maxAttempts: 5,
      isRetryable: (e: any) => e?.status === 503,
    });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("NO reintenta un error no-retryable, aunque queden intentos", async () => {
    const fn = mock(async () => {
      throw { status: 400 };
    });

    await expect(
      withRetry(fn, {
        ...FAST,
        maxAttempts: 5,
        isRetryable: (e: any) => e?.status === 503,
      }),
    ).rejects.toEqual({ status: 400 });

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("lanza el último error tal cual cuando se agotan los intentos", async () => {
    const finalError = { status: 503, message: "still unavailable" };
    const fn = mock(async () => {
      throw finalError;
    });

    await expect(
      withRetry(fn, {
        ...FAST,
        maxAttempts: 3,
        isRetryable: () => true,
      }),
    ).rejects.toBe(finalError);

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("llama onRetry con el número de intento y el error, antes de cada espera", async () => {
    let calls = 0;
    const fn = mock(async () => {
      calls++;
      if (calls < 2) throw { status: 429 };
      return "ok";
    });
    const onRetry = mock(() => { });

    await withRetry(fn, {
      ...FAST,
      maxAttempts: 3,
      isRetryable: () => true,
      onRetry,
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry.mock.calls[0][0]).toBe(1); // attempt 1 falló, se registra antes del 2do intento
  });
});
