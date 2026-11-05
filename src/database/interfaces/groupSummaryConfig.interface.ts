/**
 * database/interfaces/groupSummaryConfig.interface.ts
 *
 * A document existing for a group IS the enabled state — there is no
 * separate `enabled` field. This follows from keeping only
 * /setsummaryprompt as the admin command (no /summaryon, /summaryoff).
 */
export interface GroupSummaryConfig {
  groupWhatsappId: string;
  /** Always set by /setsummaryprompt — there is no implicit default here. */
  promptTemplate: string;
  lastSummaryAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
