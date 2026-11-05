import { getMessageLogCollection } from "../../models/messageLog.model";

/**
 * Service responsible for storing and retrieving logged messages used to
 * build each group's weekly summary.
 *
 * Only messages from groups with a GroupSummaryConfig document are ever
 * recorded here — see GroupSummaryConfigService.isEnabled, which the
 * caller must check before calling `record`. This service does not
 * re-check eligibility itself.
 */
export class MessageHistoryService {
  /**
   * Stores a single message for later inclusion in a weekly summary.
   *
   * The caller is responsible for checking
   * GroupSummaryConfigService.isEnabled(groupWhatsappId) BEFORE calling
   * this.
   *
   * @param groupWhatsappId - WhatsApp group identifier.
   * @param senderJid - WhatsApp identifier of the sender.
   * @param text - Raw message text.
   * @param timestamp - When the message was actually sent. Defaults to now.
   */
  async record(
    groupWhatsappId: string,
    senderJid: string,
    text: string,
    timestamp: Date = new Date(),
  ): Promise<void> {
    const trimmed = text?.trim();
    if (!trimmed) return; // stickers, reactions, and other textless messages: nothing to summarize

    const now = new Date();

    await getMessageLogCollection().insertOne({
      groupWhatsappId,
      senderJid,
      text: trimmed,
      timestamp,
      createdAt: now, // TTL index field — expires 14 days after insertion
    });
  }

  /**
   * Builds a plain-text transcript for the Gemini prompt.
   *
   * `until` exists so the scheduler can pass an explicit period
   * (periodStart/periodEnd) instead of relying on "now" implicitly, which
   * would drift if the cron ran late.
   *
   * Returns "" (not null) when there are no messages, so the caller can
   * easily decide whether to skip the group for this run
   * (`if (!history) return;`).
   *
   * @param groupWhatsappId - WhatsApp group identifier.
   * @param since - Start of the period (inclusive).
   * @param until - End of the period (inclusive).
   */
  async buildWeeklyHistory(
    groupWhatsappId: string,
    since: Date,
    until: Date,
  ): Promise<string> {
    const messages = await getMessageLogCollection()
      .find({
        groupWhatsappId,
        timestamp: { $gte: since, $lte: until },
      })
      .sort({ timestamp: 1 })
      .toArray();

    if (messages.length === 0) return "";

    return messages
      .map((m) => `[${this.formatTime(m.timestamp)}] ${m.senderJid}: ${m.text}`)
      .join("\n");
  }

  private formatTime(date: Date): string {
    return date.toLocaleString("es-CO", {
      timeZone: "America/Bogota",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}
