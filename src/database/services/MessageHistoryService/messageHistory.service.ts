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
   * @param groupWhatsappId - WhatsApp group identifier.
   * @param senderJid - WhatsApp identifier of the sender.
   * @param senderName - Display name (Baileys `pushName`), if available.
   * @param text - Raw message text.
   * @param timestamp - When the message was actually sent. Defaults to now.
   */
  async record(
    groupWhatsappId: string,
    senderJid: string,
    senderName: string | null | undefined,
    text: string,
    timestamp: Date = new Date(),
  ): Promise<void> {
    const trimmed = text?.trim();
    if (!trimmed) return; // stickers, reactions, other textless messages: nothing to summarize

    await getMessageLogCollection().insertOne({
      groupWhatsappId,
      senderJid,
      senderName: senderName?.trim() || null,
      text: trimmed,
      timestamp,
      createdAt: new Date(), // TTL index field — expires 14 days after insertion
    });
  }

  /**
   * Builds a plain-text transcript for the Gemini prompt, one line per
   * message: `[Fri 08:15] Jean Paul: text`.
   *
   * `until` exists so the scheduler can pass an explicit period instead of
   * relying on "now" implicitly, which would drift if the cron ran late.
   *
   * Returns "" (not null) when there are no messages, so the caller can
   * easily skip the group for this run (`if (!history) return;`).
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
      .map(
        (m) =>
          `[${this.formatTime(m.timestamp)}] ${this.displayName(m.senderName, m.senderJid)}: ${m.text}`,
      )
      .join("\n");
  }

  /**
   * Name shown to the LLM. Falls back to the phone number (the part of the
   * JID before "@", and before any ":device" suffix) when WhatsApp gave no
   * display name.
   */
  private displayName(senderName: string | null, senderJid: string): string {
    if (senderName) return senderName;
    return senderJid.split("@")[0]?.split(":")[0] || senderJid;
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
