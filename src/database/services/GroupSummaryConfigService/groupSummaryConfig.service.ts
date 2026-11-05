import type { GroupSummaryConfig } from "../../interfaces/groupSummaryConfig.interface";
import { getGroupSummaryConfigCollection } from "../../models/groupSummaryConfig.model";

/**
 * Service responsible for managing the weekly-summary (Gemini) configuration
 * for each WhatsApp group.
 *
 * A document existing for a group IS the enabled state — see
 * GroupSummaryConfig for why there is no separate `enabled` field.
 *
 * IMPORTANT — module-scoped cache, not instance-scoped:
 * This codebase instantiates services freely with `new X()` wherever
 * they're needed (HandleCommand's default constructor params,
 * MessageUpsertEvents, etc.) — there's no DI container handing out a single
 * shared instance. A normal `private` class field would mean every
 * `new GroupSummaryConfigService()` gets its OWN cache, so a write from one
 * instance (e.g. the /setsummaryprompt command) would never be visible to
 * another instance's isEnabled() check (e.g. the messages.upsert handler).
 *
 * The cache therefore lives at MODULE scope: every instance in the process
 * reads and writes the same Set.
 */
let enabledGroupIds = new Set<string>();

export class GroupSummaryConfigService {
  /**
   * Populates the module-level cache from the database.
   *
   * Must be called once during bootstrap, after initDatabase and before
   * the WhatsApp client starts — otherwise every message arriving before
   * this resolves would be treated as "not enabled" and silently skipped.
   * Safe to call again later to force a refresh (e.g. after editing Mongo
   * by hand).
   */
  async loadCache(): Promise<void> {
    const docs = await getGroupSummaryConfigCollection()
      .find({}, { projection: { groupWhatsappId: 1 } })
      .toArray();

    enabledGroupIds = new Set(docs.map((doc) => doc.groupWhatsappId));
  }

  /**
   * In-memory check — does NOT hit the database. Safe to call on every
   * incoming message.
   *
   * @param groupWhatsappId - WhatsApp group identifier.
   */
  isEnabled(groupWhatsappId: string): boolean {
    return enabledGroupIds.has(groupWhatsappId);
  }

  /**
   * Returns every group that has weekly summaries configured.
   * Used by the scheduler to decide which groups to process.
   */
  async findAll(): Promise<GroupSummaryConfig[]> {
    return getGroupSummaryConfigCollection().find({}).toArray();
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

    enabledGroupIds.add(groupWhatsappId);
  }

  /**
   * Records that a weekly summary was just generated and sent for a group.
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
