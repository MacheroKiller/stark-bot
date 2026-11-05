import { GoogleGenAI } from "@google/genai";
import { withRetry } from "../../../shared/utils/retry/with-retry";
import logger from "../../../shared/utils/logger/logger";

export interface MinimalLogger {
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export const consoleLogger: MinimalLogger = {
  info: (m, meta) => console.log(`[INFO] ${m}`, meta ?? ""),
  warn: (m, meta) => console.warn(`[WARN] ${m}`, meta ?? ""),
  error: (m, meta) => console.error(`[ERROR] ${m}`, meta ?? ""),
};

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
  promptTemplate?: string | null;
}

export interface SummaryServiceConfig {
  apiKey: string;
  model?: string;
  /** Overrides para el retry — pensados sobre todo para tests. */
  retry?: {
    maxAttempts?: number;
    baseDelayMs?: number;
  };
}

/** Códigos HTTP de Gemini que son transitorios y ameritan reintento. */
const RETRYABLE_STATUS_CODES = new Set([429, 503]);

/**
 * Las excepciones de @google/genai (ApiError) traen `status` como número.
 * Se hace duck-typing en vez de importar la clase ApiError para no acoplar
 * esta función a una ruta de export interna del SDK que puede cambiar
 * entre versiones.
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

  constructor(private readonly config: SummaryServiceConfig) {
    this.ai = new GoogleGenAI({ apiKey: config.apiKey });
    this.model = config.model ?? "gemini-2.5-flash";
    this.maxAttempts = config.retry?.maxAttempts ?? 4;
    this.baseDelayMs = config.retry?.baseDelayMs ?? 30_000;
  }

  get modelName(): string {
    return this.model;
  }

  async generateWeeklySummary(input: WeeklySummaryInput): Promise<string> {
    const prompt = this.buildPrompt(input);

    logger.info(
      `[SummaryService] Generating summary for ${input.groupName} (model=${this.model})`,
    );

    const response = await withRetry(
      () =>
        this.ai.models.generateContent({ model: this.model, contents: prompt }),
      {
        maxAttempts: this.maxAttempts,
        baseDelayMs: this.baseDelayMs,
        multiplier: 4,
        jitterRatio: 0.2,
        isRetryable: isRetryableGeminiError,
        onRetry: (attempt, delayMs, error) => {
          const status = (error as { status?: unknown })?.status;
          logger.warn(
            `[SummaryService] Intento ${attempt} falló (status=${status}) para ${input.groupName}. ` +
            `Reintentando en ${Math.round(delayMs / 1000)}s…`,
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
    const template = input.promptTemplate?.trim() || DEFAULT_PROMPT_TEMPLATE;

    const usable =
      template.includes("{{CURRENT_DATE}}") &&
        template.includes("{{WEEKLY_HISTORY}}")
        ? template
        : DEFAULT_PROMPT_TEMPLATE;

    if (usable !== template) {
      logger.warn(
        `[SummaryService] promptTemplate for ${input.groupName} missing required placeholders — using DEFAULT_PROMPT_TEMPLATE instead`,
      );
    }

    return usable
      .replace(/{{CURRENT_DATE}}/g, input.currentDate)
      .replace(/{{WEEKLY_HISTORY}}/g, input.weeklyHistory);
  }
}
