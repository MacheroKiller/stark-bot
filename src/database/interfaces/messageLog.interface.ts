/**
 * database/interfaces/messageLog.interface.ts
 *
 * Only created for groups that have a GroupSummaryConfig document
 * (opt-in via /setsummaryprompt). `createdAt` is the field the TTL index
 * runs on — Mongo deletes expired documents on its own, nothing to clean
 * up manually.
 */
export interface MessageLog {
  groupWhatsappId: string;
  senderJid: string;
  text: string;
  /** Actual WhatsApp message time, from the Baileys event. */
  timestamp: Date;
  /** Insertion time — this is the TTL index field (14-day expiry). */
  createdAt: Date;
}
