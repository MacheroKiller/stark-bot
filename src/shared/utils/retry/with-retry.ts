/**
 * shared/utils/retry/with-retry.ts
 *
 * Helper genérico de reintentos con backoff exponencial + jitter.
 * No sabe nada de Gemini, Satrack, ni de ningún API en particular —
 * recibe la función a ejecutar y un predicado `isRetryable(error)` que
 * decide si vale la pena reintentar ese error específico.
 */

export interface RetryOptions {
  /** Intentos totales, incluyendo el primero. Default: 4. */
  maxAttempts?: number;
  /** Delay base en ms antes del primer reintento. Default: 30_000 (30s). */
  baseDelayMs?: number;
  /** Factor de crecimiento exponencial entre reintentos. Default: 4. */
  multiplier?: number;
  /** Variación aleatoria sobre el delay calculado, ej. 0.2 = ±20%. Default: 0.2. */
  jitterRatio?: number;
  /** Decide si ESTE error amerita reintento. Default: nunca reintenta. */
  isRetryable?: (error: unknown) => boolean;
  /** Se llama antes de cada espera — para loguear el intento fallido. */
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
}

const DEFAULTS: Required<
  Pick<
    RetryOptions,
    "maxAttempts" | "baseDelayMs" | "multiplier" | "jitterRatio"
  >
> = {
  maxAttempts: 4,
  baseDelayMs: 30_000,
  multiplier: 4,
  jitterRatio: 0.2,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = DEFAULTS.maxAttempts,
    baseDelayMs = DEFAULTS.baseDelayMs,
    multiplier = DEFAULTS.multiplier,
    jitterRatio = DEFAULTS.jitterRatio,
    isRetryable = () => false,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const isLastAttempt = attempt === maxAttempts;
      if (isLastAttempt || !isRetryable(error)) {
        throw error;
      }

      const delayMs = calculateDelay(
        baseDelayMs,
        multiplier,
        attempt,
        jitterRatio,
      );
      onRetry?.(attempt, delayMs, error);
      await sleep(delayMs);
    }
  }

  // Inalcanzable (el loop siempre retorna o lanza), pero TS lo exige.
  throw lastError;
}

function calculateDelay(
  baseDelayMs: number,
  multiplier: number,
  attempt: number,
  jitterRatio: number,
): number {
  const raw = baseDelayMs * multiplier ** (attempt - 1);
  const jitter = raw * jitterRatio * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(raw + jitter));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
