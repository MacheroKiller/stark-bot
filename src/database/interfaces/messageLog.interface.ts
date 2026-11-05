/**
 * database/interfaces/messageLog.interface.ts
 *
 * Only created for groups that have a GroupSummaryConfig document
 * (opt-in via /setsummaryprompt). `createdAt` is the field the TTL index
 * runs on — Mongo deletes expired documents on its own (14 days).
 */
export interface MessageLog {
  groupWhatsappId: string;
  senderJid: string;
  /**
   * WhatsApp display name (Baileys `pushName`) at the time of the message.
   * Null when WhatsApp didn't provide one — the transcript then falls back
   * to the phone number taken from `senderJid`.
   */
  senderName: string | null;
  text: string;
  /** Actual WhatsApp message time, from the Baileys event. */
  timestamp: Date;
  /** Insertion time — this is the TTL index field. */
  createdAt: Date;
}
