/**
 * database/interfaces/weeklySummaryReport.interface.ts
 *
 * One generated weekly report. The full history is kept (one document per
 * run per group), not just the latest.
 */
export interface WeeklySummaryReport {
  groupWhatsappId: string;
  periodStart: Date;
  periodEnd: Date;
  /** Full report text exactly as returned by Gemini. */
  content: string;
  /** Model that produced it, e.g. "gemini-3.1-flash-lite". */
  model: string;
  /**
   * Set to true once the report was handed to WhatsApp without throwing.
   * See the note in WeeklySummaryScheduler about sendMessageToGroup
   * swallowing errors.
   */
  delivered: boolean;
  deliveredAt: Date | null;
  generatedAt: Date;
}
