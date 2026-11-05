import { GoogleGenAI } from "@google/genai";
import logger from "../../shared/utils/logger/logger";
import { withRetry } from "../../shared/utils/retry/with-retry";

/**
 * Used when a group has no usable prompt of its own. Must keep both
 * placeholders.
 */
export const DEFAULT_PROMPT_TEMPLATE = `Eres un asistente que resume la actividad semanal de un grupo de WhatsApp.
Fecha del informe: {{CURRENT_DATE}}

Analiza las siguientes conversaciones de la semana e identifica los temas
principales, tareas realizadas, problemas reportados, pendientes y
decisiones tomadas. Genera un resumen organizado por categorías, en
español, listo para enviarse directamente por WhatsApp (sin markdown
pesado, usa emojis con moderación para los títulos de sección).

Conversaciones de la semana:
{{WEEKLY_HISTORY}}`;

export interface WeeklySummaryInput {
  groupName: string;
  currentDate: string;
  weeklyHistory: string;
  /**
   * Prompt of the group (GroupSummaryConfig.promptTemplate), with the
   * placeholders {{CURRENT_DATE}} and {{WEEKLY_HISTORY}}. Falls back to
   * DEFAULT_PROMPT_TEMPLATE when missing or malformed.
   */
  promptTemplate?: string | null;
}

export interface SummaryServiceConfig {
  /** Gemini API key. */
  apiKey: string;
  /** Gemini model identifier. Defaults to gemini-3.1-flash-lite. */
  model?: string;
  /** Retry overrides — mostly useful for tests. */
  retry?: {
    maxAttempts?: number;
    baseDelayMs?: number;
  };
}

/** HTTP statuses from Gemini that are transient and worth retrying. */
const RETRYABLE_STATUS_CODES = new Set([429, 503]);

/**
 * @google/genai throws an ApiError carrying a numeric `status`. This is
 * duck-typed on purpose: it avoids importing the SDK's error class from an
 * internal path that can change between versions.
 */
export function isRetryableGeminiError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" && RETRYABLE_STATUS_CODES.has(status);
}

export class SummaryService {
  private readonly ai: GoogleGenAI;
  private readonly model: string;
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;

  constructor(config: SummaryServiceConfig) {
    this.ai = new GoogleGenAI({ apiKey: config.apiKey });
    this.model = config.model ?? "gemini-3.1-flash-lite";
    this.maxAttempts = config.retry?.maxAttempts ?? 4;
    // Runs in a background weekly job: nobody waits on it, so a long
    // backoff (30s → 2min → 8min) is fine and gives Gemini time to recover.
    this.baseDelayMs = config.retry?.baseDelayMs ?? 30_000;
  }

  /** Model in use — stored next to each generated report. */
  get modelName(): string {
    return this.model;
  }

  /**
   * Calls Gemini and returns a WhatsApp-ready summary.
   * Transient errors (429, 503) are retried with backoff; any other error
   * is thrown immediately.
   */
  async generateWeeklySummary(input: WeeklySummaryInput): Promise<string> {
    const prompt = this.buildPrompt(input);

    logger.info(
      `[SummaryService] Generating summary for ${input.groupName} (model=${this.model})`,
    );

    const response = await withRetry(
      () =>
        this.ai.models.generateContent({
          model: this.model,
          contents: prompt,
        }),
      {
        maxAttempts: this.maxAttempts,
        baseDelayMs: this.baseDelayMs,
        multiplier: 4,
        jitterRatio: 0.2,
        isRetryable: isRetryableGeminiError,
        onRetry: (attempt, delayMs, error) => {
          const status = (error as { status?: unknown })?.status;
          logger.warn(
            `[SummaryService] Attempt ${attempt} failed (status=${status}) for ${input.groupName}. Retrying in ${Math.round(delayMs / 1000)}s...`,
          );
        },
      },
    );

    const result = response.text?.trim();

    if (!result) {
      throw new Error("Gemini returned an empty response");
    }

    logger.info(`[SummaryService] Summary generated (${result.length} chars)`);

    return result;
  }

  private buildPrompt(input: WeeklySummaryInput): string {
    const custom = input.promptTemplate?.trim();
    const hasPlaceholders =
      !!custom &&
      custom.includes("{{CURRENT_DATE}}") &&
      custom.includes("{{WEEKLY_HISTORY}}");

    if (custom && !hasPlaceholders) {
      // /setsummaryprompt already validates this on save; this only guards
      // against a document edited by hand in Mongo.
      logger.warn(
        `[SummaryService] Prompt of ${input.groupName} is missing required placeholders — using the default prompt`,
      );
    }

    const template = hasPlaceholders ? custom : DEFAULT_PROMPT_TEMPLATE;

    return template
      .replace(/{{CURRENT_DATE}}/g, input.currentDate)
      .replace(/{{WEEKLY_HISTORY}}/g, input.weeklyHistory);
  }
}
