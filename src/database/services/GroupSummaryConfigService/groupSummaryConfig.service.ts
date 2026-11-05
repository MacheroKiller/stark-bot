import type { GroupSummaryConfig } from "../../interfaces/groupSummaryConfig.interface";
import { getGroupSummaryConfigCollection } from "../../models/groupSummaryConfig.model";

/**
 * Service responsible for managing the weekly-summary (Gemini) configuration
 * for each WhatsApp group.
 *
 * A document existing for a group IS the enabled state — see
 * GroupSummaryConfig for why there is no separate `enabled` field.
 *
 * NOTE: this service holds in-memory state (the enabled-groups cache), so
 * it must be registered as a SINGLETON in the DI container. A new instance
 * per use would reset the cache constantly and defeat its purpose.
 */
export class GroupSummaryConfigService {
  /**
   * In-memory cache of enabled groupWhatsappId values. Checked on the hot
   * path of every incoming message (see MessageHistoryService.record call
   * site in the messages.upsert handler), so it cannot be a database query
   * per message — it has to be O(1) in memory.
   */
  private enabledGroupIds = new Set<string>();

  /**
   * Populates the in-memory cache from the database.
   *
   * Must be called once during bootstrap, after initDatabase and before
   * the WhatsApp socket starts receiving messages — otherwise every
   * message arriving before this resolves would be treated as "not
   * enabled" and silently skipped.
   */
  async loadCache(): Promise<void> {
    const docs = await getGroupSummaryConfigCollection()
      .find({}, { projection: { groupWhatsappId: 1 } })
      .toArray();

    this.enabledGroupIds = new Set(docs.map((doc) => doc.groupWhatsappId));
  }

  /**
   * In-memory check — does NOT hit the database. Safe to call on every
   * incoming message.
   *
   * @param groupWhatsappId - WhatsApp group identifier.
   */
  isEnabled(groupWhatsappId: string): boolean {
    return this.enabledGroupIds.has(groupWhatsappId);
  }

  /**
   * Finds the summary configuration for a specific group.
   *
   * @param groupWhatsappId - WhatsApp group identifier.
   * @returns The matching config, or null if the group isn't configured.
   */
  async findByGroupId(
    groupWhatsappId: string,
  ): Promise<GroupSummaryConfig | null> {
    return getGroupSummaryConfigCollection().findOne({ groupWhatsappId });
  }

  /**
   * Sets (or creates) the prompt template for a group.
   *
   * Used by /setsummaryprompt. If no document existed for this group, it
   * does now — and from this moment on the group is enabled for the
   * weekly summary. Messages sent before this call were never logged and
   * will not appear in any future report.
   *
   * @param groupWhatsappId - WhatsApp group identifier.
   * @param promptTemplate - Prompt to use for this group's weekly report.
   */
  async setPromptTemplate(
    groupWhatsappId: string,
    promptTemplate: string,
  ): Promise<void> {
    const now = new Date();

    await getGroupSummaryConfigCollection().updateOne(
      { groupWhatsappId },
      {
        $set: { promptTemplate, updatedAt: now },
        $setOnInsert: { groupWhatsappId, lastSummaryAt: null, createdAt: now },
      },
      { upsert: true },
    );

    this.enabledGroupIds.add(groupWhatsappId);
  }

  /**
   * Records that a weekly summary was just generated for a group.
   *
   * @param groupWhatsappId - WhatsApp group identifier.
   * @param when - Timestamp to record. Defaults to now.
   */
  async markSummarized(
    groupWhatsappId: string,
    when: Date = new Date(),
  ): Promise<void> {
    await getGroupSummaryConfigCollection().updateOne(
      { groupWhatsappId },
      { $set: { lastSummaryAt: when, updatedAt: when } },
    );
  }
}
